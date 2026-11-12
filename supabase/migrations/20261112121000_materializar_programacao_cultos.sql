BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- One session per scheduled church-service occurrence; manual sessions remain unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_culto_sessoes_modelo_ocorrencia
  ON public.culto_sessoes (igreja_id, modelo_id, inicio_em)
  WHERE modelo_id IS NOT NULL;

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
  -- Interactive calls are restricted to the caller's own church. The scheduled job
  -- calls this function without a user and materializes every church's active program.
  IF auth.uid() IS NOT NULL THEN
    IF p_igreja_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.igreja_id = p_igreja_id
    ) THEN
      RAISE EXCEPTION 'Usuário não autorizado para sincronizar esta programação.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Close scheduled sessions whose planned end time has passed, even if a model
  -- was deactivated after the service started.
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
           m.horario_inicio, m.horario_fim, m.created_at
    FROM public.culto_modelos m
    WHERE m.ativo = true
      AND m.dia_semana BETWEEN 0 AND 6
      AND m.horario_inicio IS NOT NULL
      AND m.horario_fim IS NOT NULL
      AND m.horario_fim > m.horario_inicio
      AND (p_igreja_id IS NULL OR m.igreja_id = p_igreja_id)
    ORDER BY m.igreja_id, m.dia_semana, m.horario_inicio
  LOOP
    v_data_inicio := (v_model.created_at AT TIME ZONE v_fuso)::date;

    FOR v_data_culto IN
      SELECT serie.dia::date
      FROM generate_series(v_data_inicio::timestamp, v_data_hoje::timestamp, interval '1 day') AS serie(dia)
      WHERE EXTRACT(DOW FROM serie.dia)::smallint = v_model.dia_semana
        AND ((serie.dia::date + v_model.horario_inicio) AT TIME ZONE v_fuso) >= v_model.created_at
        AND ((serie.dia::date + v_model.horario_inicio) AT TIME ZONE v_fuso) <= v_agora_utc
    LOOP
      v_inicio := (v_data_culto + v_model.horario_inicio) AT TIME ZONE v_fuso;
      v_fim := (v_data_culto + v_model.horario_fim) AT TIME ZONE v_fuso;
      v_status := CASE WHEN v_fim > v_agora_utc THEN 'aberto' ELSE 'encerrado' END;

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
      v_contagem := v_contagem + v_afetadas;
    END LOOP;
  END LOOP;

  RETURN v_contagem;
END;
$$;

REVOKE ALL ON FUNCTION public.materializar_sessoes_culto(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.materializar_sessoes_culto(uuid) TO authenticated, service_role;

-- Reconcile every five minutes so sessions open near their scheduled start and
-- automatically close at their end time. Page loads also call the same function
-- to synchronize immediately instead of waiting for the next cron tick.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ohel_materializar_sessoes_culto') THEN
    UPDATE cron.job
    SET schedule = '*/5 * * * *',
        command = 'SELECT public.materializar_sessoes_culto(NULL);',
        active = true
    WHERE jobname = 'ohel_materializar_sessoes_culto';
  ELSE
    PERFORM cron.schedule(
      'ohel_materializar_sessoes_culto',
      '*/5 * * * *',
      'SELECT public.materializar_sessoes_culto(NULL);'
    );
  END IF;
END;
$$;

COMMIT;
