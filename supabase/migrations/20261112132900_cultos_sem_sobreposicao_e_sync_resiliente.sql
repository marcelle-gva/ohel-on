BEGIN;

-- Serialize schedule writes per church/day so concurrent admins cannot create
-- overlapping intervals between the validation query and commit.
CREATE OR REPLACE FUNCTION public.validar_intervalo_culto_modelo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT NEW.ativo THEN
    RETURN NEW;
  END IF;

  IF NEW.dia_semana NOT BETWEEN 0 AND 6
     OR NEW.horario_inicio IS NULL
     OR NEW.horario_fim IS NULL
     OR NEW.horario_fim <= NEW.horario_inicio THEN
    RAISE EXCEPTION 'O dia e intervalo de horário do culto são inválidos.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(NEW.igreja_id::text || ':' || NEW.dia_semana::text)::bigint
  );

  IF EXISTS (
    SELECT 1
    FROM public.culto_modelos outro
    WHERE outro.igreja_id = NEW.igreja_id
      AND outro.dia_semana = NEW.dia_semana
      AND outro.ativo = true
      AND outro.id <> NEW.id
      AND NEW.horario_inicio < outro.horario_fim
      AND NEW.horario_fim > outro.horario_inicio
  ) THEN
    RAISE EXCEPTION 'Já existe um culto ativo com horário sobreposto nesse dia.'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_intervalo_culto_modelo ON public.culto_modelos;
CREATE TRIGGER trg_validar_intervalo_culto_modelo
  BEFORE INSERT OR UPDATE ON public.culto_modelos
  FOR EACH ROW EXECUTE FUNCTION public.validar_intervalo_culto_modelo();

CREATE OR REPLACE FUNCTION public.materializar_sessoes_culto(p_igreja_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fuso CONSTANT text := 'America/Sao_Paulo';
  v_agora_utc timestamptz := now();
  v_data_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_model record;
  v_data_inicio date;
  v_data_culto date;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_status text;
  v_afetadas integer := 0;
  v_contagem integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF p_igreja_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.igreja_id = p_igreja_id
    ) THEN
      RAISE EXCEPTION 'Usuário não autorizado para sincronizar esta programação.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.culto_sessoes s
  SET status = 'encerrado'
  WHERE s.status = 'aberto'
    AND s.modelo_id IS NOT NULL
    AND s.fim_em IS NOT NULL
    AND s.fim_em <= v_agora_utc
    AND (p_igreja_id IS NULL OR s.igreja_id = p_igreja_id);
  GET DIAGNOSTICS v_contagem = ROW_COUNT;

  FOR v_model IN
    SELECT m.id, m.igreja_id, m.nome, m.tipo, m.dia_semana,
           m.horario_inicio, m.horario_fim, m.vigencia_desde
    FROM public.culto_modelos m
    WHERE m.ativo = true
      AND m.dia_semana BETWEEN 0 AND 6
      AND m.horario_inicio IS NOT NULL
      AND m.horario_fim IS NOT NULL
      AND m.horario_fim > m.horario_inicio
      AND (p_igreja_id IS NULL OR m.igreja_id = p_igreja_id)
    ORDER BY m.igreja_id, m.dia_semana, m.horario_inicio
  LOOP
    v_data_inicio := (v_model.vigencia_desde AT TIME ZONE v_fuso)::date;

    FOR v_data_culto IN
      SELECT serie.dia::date
      FROM generate_series(v_data_inicio::timestamp, v_data_hoje::timestamp, interval '1 day') AS serie(dia)
      WHERE EXTRACT(DOW FROM serie.dia)::smallint = v_model.dia_semana
        AND ((serie.dia::date + v_model.horario_inicio) AT TIME ZONE v_fuso) >= v_model.vigencia_desde
        AND ((serie.dia::date + v_model.horario_inicio) AT TIME ZONE v_fuso) <= v_agora_utc
    LOOP
      v_inicio := (v_data_culto + v_model.horario_inicio) AT TIME ZONE v_fuso;
      v_fim := (v_data_culto + v_model.horario_fim) AT TIME ZONE v_fuso;
      v_status := CASE WHEN v_fim > v_agora_utc THEN 'aberto' ELSE 'encerrado' END;

      -- If a manual or other session overlaps this occurrence, keep the existing
      -- session as the record for that period instead of creating a duplicate.
      IF EXISTS (
        SELECT 1
        FROM public.culto_sessoes existente
        WHERE existente.igreja_id = v_model.igreja_id
          AND existente.inicio_em < v_fim
          AND (
            existente.fim_em > v_inicio
            OR (existente.fim_em IS NULL AND existente.status = 'aberto')
          )
          AND NOT (
            existente.modelo_id = v_model.id
            AND existente.inicio_em = v_inicio
          )
      ) THEN
        CONTINUE;
      END IF;

      -- The filtered unique index also guards manual starts that race with the
      -- scheduled job. Treat such a collision as a skipped occurrence, not as a
      -- failed cron run or failed page synchronization.
      v_afetadas := 0;
      BEGIN
        INSERT INTO public.culto_sessoes (
          igreja_id, modelo_id, titulo, tipo, inicio_em, fim_em, status
        ) VALUES (
          v_model.igreja_id, v_model.id, v_model.nome, v_model.tipo,
          v_inicio, v_fim, v_status
        )
        ON CONFLICT (igreja_id, modelo_id, inicio_em)
          WHERE modelo_id IS NOT NULL
        DO UPDATE SET status = EXCLUDED.status
        WHERE public.culto_sessoes.status = 'aberto'
          AND EXCLUDED.status = 'encerrado';
        GET DIAGNOSTICS v_afetadas = ROW_COUNT;
      EXCEPTION WHEN unique_violation THEN
        v_afetadas := 0;
      END;

      v_contagem := v_contagem + v_afetadas;
    END LOOP;
  END LOOP;

  RETURN v_contagem;
END;
$$;

REVOKE ALL ON FUNCTION public.materializar_sessoes_culto(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.materializar_sessoes_culto(uuid) TO authenticated, service_role;

COMMIT;
