BEGIN;

-- Agenda pontual: não materializa sessões e nunca substitui a recorrência semanal.
CREATE TABLE IF NOT EXISTS public.programacoes_cultos_anuais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  ano smallint NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  data_culto date NOT NULL,
  titulo text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 2 AND 120),
  tipo text NOT NULL CHECK (length(btrim(tipo)) BETWEEN 2 AND 60),
  horario_inicio time NOT NULL,
  horario_fim time NOT NULL,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT programacoes_cultos_anuais_ano_data_ck CHECK (date_part('year', data_culto)::smallint = ano),
  CONSTRAINT programacoes_cultos_anuais_horario_ck CHECK (horario_fim > horario_inicio)
);

ALTER TABLE public.programacoes_cultos_anuais ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_programacoes_cultos_anuais_igreja_ano_data
  ON public.programacoes_cultos_anuais (igreja_id, ano, data_culto, horario_inicio);

DROP POLICY IF EXISTS programacoes_cultos_anuais_ler_igreja ON public.programacoes_cultos_anuais;
CREATE POLICY programacoes_cultos_anuais_ler_igreja
  ON public.programacoes_cultos_anuais FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.igreja_id = programacoes_cultos_anuais.igreja_id
    )
  );

DROP POLICY IF EXISTS programacoes_cultos_anuais_escrever_admin ON public.programacoes_cultos_anuais;
CREATE POLICY programacoes_cultos_anuais_escrever_admin
  ON public.programacoes_cultos_anuais FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.igreja_id = programacoes_cultos_anuais.igreja_id
        AND lower(coalesce(u.role::text, '')) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.igreja_id = programacoes_cultos_anuais.igreja_id
        AND lower(coalesce(u.role::text, '')) = 'admin'
    )
  );

REVOKE ALL ON public.programacoes_cultos_anuais FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.programacoes_cultos_anuais TO authenticated;

-- Todas as alterações de programação passam por funções SECURITY DEFINER que derivam
-- igreja e autorização da sessão; o lock da igreja serializa admins concorrentes.
CREATE OR REPLACE FUNCTION public.exigir_admin_igreja(p_igreja_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_igreja_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.igreja_id = p_igreja_id
      AND lower(coalesce(u.role::text, '')) = 'admin'
  ) THEN
    RAISE EXCEPTION 'Apenas um administrador autenticado da própria igreja pode alterar a programação.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.exigir_admin_igreja(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validar_intervalo_culto_modelo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_tipo text;
BEGIN
  NEW.nome := btrim(coalesce(NEW.nome, ''));
  NEW.tipo := btrim(coalesce(NEW.tipo, ''));
  IF length(NEW.nome) < 2 OR length(NEW.nome) > 120 THEN
    RAISE EXCEPTION 'O nome do culto deve ter entre 2 e 120 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF length(NEW.tipo) < 2 OR length(NEW.tipo) > 60 THEN
    RAISE EXCEPTION 'O tipo de culto é inválido.' USING ERRCODE = '22023';
  END IF;
  SELECT t.nome INTO v_tipo
  FROM public.culto_tipos t
  WHERE t.igreja_id = NEW.igreja_id
    AND lower(btrim(t.nome)) = lower(NEW.tipo)
  LIMIT 1;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Selecione um tipo de culto cadastrado para a igreja.' USING ERRCODE = '22023';
  END IF;
  NEW.tipo := v_tipo;

  IF NOT NEW.ativo THEN
    RETURN NEW;
  END IF;
  IF NEW.dia_semana NOT BETWEEN 0 AND 6
     OR NEW.horario_inicio IS NULL
     OR NEW.horario_fim IS NULL
     OR NEW.horario_fim <= NEW.horario_inicio THEN
    RAISE EXCEPTION 'O dia e intervalo de horário do culto são inválidos.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.igreja_id::text || ':' || NEW.dia_semana::text)::bigint);
  IF EXISTS (
    SELECT 1 FROM public.culto_modelos outro
    WHERE outro.igreja_id = NEW.igreja_id
      AND outro.dia_semana = NEW.dia_semana
      AND outro.ativo = true
      AND outro.id <> NEW.id
      AND NEW.horario_inicio < outro.horario_fim
      AND NEW.horario_fim > outro.horario_inicio
  ) THEN
    RAISE EXCEPTION 'Já existe um culto ativo com horário sobreposto nesse dia.' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_intervalo_culto_modelo ON public.culto_modelos;
CREATE TRIGGER trg_validar_intervalo_culto_modelo
  BEFORE INSERT OR UPDATE ON public.culto_modelos
  FOR EACH ROW EXECUTE FUNCTION public.validar_intervalo_culto_modelo();

CREATE OR REPLACE FUNCTION public.criar_programacao_culto(
  p_igreja_id uuid,
  p_nome text,
  p_tipo text,
  p_dia_semana smallint,
  p_horario_inicio time,
  p_horario_fim time
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_tipo text;
  v_id uuid;
  v_nome text := btrim(coalesce(p_nome, ''));
BEGIN
  PERFORM public.exigir_admin_igreja(p_igreja_id);
  PERFORM pg_advisory_xact_lock(hashtext('culto-modelos:' || p_igreja_id::text)::bigint);
  IF length(v_nome) < 2 OR length(v_nome) > 120 THEN
    RAISE EXCEPTION 'O nome do culto deve ter entre 2 e 120 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF p_dia_semana IS NULL OR p_dia_semana NOT BETWEEN 0 AND 6
     OR p_horario_inicio IS NULL OR p_horario_fim IS NULL
     OR p_horario_fim <= p_horario_inicio THEN
    RAISE EXCEPTION 'Informe um dia e um intervalo de horário válido.' USING ERRCODE = '22023';
  END IF;
  SELECT t.nome INTO v_tipo
  FROM public.culto_tipos t
  WHERE t.igreja_id = p_igreja_id
    AND lower(btrim(t.nome)) = lower(btrim(coalesce(p_tipo, '')))
  LIMIT 1;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Selecione um tipo de culto cadastrado para a igreja.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.culto_modelos (igreja_id, nome, tipo, dia_semana, horario_inicio, horario_fim, ativo, vigencia_desde)
  VALUES (p_igreja_id, v_nome, v_tipo, p_dia_semana, p_horario_inicio, p_horario_fim, true, now())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.editar_programacao_culto(
  p_modelo_id uuid,
  p_igreja_id uuid,
  p_nome text,
  p_tipo text,
  p_dia_semana smallint,
  p_horario_inicio time,
  p_horario_fim time
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_model public.culto_modelos%ROWTYPE;
  v_tipo text;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_agora timestamptz := now();
BEGIN
  PERFORM public.exigir_admin_igreja(p_igreja_id);
  PERFORM pg_advisory_xact_lock(hashtext('culto-modelos:' || p_igreja_id::text)::bigint);
  SELECT m.* INTO v_model
  FROM public.culto_modelos m
  WHERE m.id = p_modelo_id AND m.igreja_id = p_igreja_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Programação fixa não encontrada ou não pertence à sua igreja.' USING ERRCODE = '42501';
  END IF;
  IF length(v_nome) < 2 OR length(v_nome) > 120 THEN
    RAISE EXCEPTION 'O nome do culto deve ter entre 2 e 120 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF p_dia_semana IS NULL OR p_dia_semana NOT BETWEEN 0 AND 6
     OR p_horario_inicio IS NULL OR p_horario_fim IS NULL
     OR p_horario_fim <= p_horario_inicio THEN
    RAISE EXCEPTION 'Informe um dia e um intervalo de horário válido.' USING ERRCODE = '22023';
  END IF;
  SELECT t.nome INTO v_tipo
  FROM public.culto_tipos t
  WHERE t.igreja_id = p_igreja_id
    AND lower(btrim(t.nome)) = lower(btrim(coalesce(p_tipo, '')))
  LIMIT 1;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Selecione um tipo de culto cadastrado para a igreja.' USING ERRCODE = '22023';
  END IF;

  -- Materializa usando os dados antigos enquanto o modelo ainda está bloqueado.
  -- Assim a sessão atual e todos os encerramentos anteriores ficam congelados.
  PERFORM public.materializar_sessoes_culto(p_igreja_id);
  UPDATE public.culto_modelos
  SET nome = v_nome,
      tipo = v_tipo,
      dia_semana = p_dia_semana,
      horario_inicio = p_horario_inicio,
      horario_fim = p_horario_fim,
      vigencia_desde = v_agora
  WHERE id = p_modelo_id AND igreja_id = p_igreja_id;
  RETURN p_modelo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.alternar_programacao_culto(
  p_modelo_id uuid,
  p_ativo boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_model public.culto_modelos%ROWTYPE;
  v_igreja_id uuid;
BEGIN
  SELECT m.igreja_id INTO v_igreja_id FROM public.culto_modelos m WHERE m.id = p_modelo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Programação fixa não encontrada.' USING ERRCODE = '40400';
  END IF;
  PERFORM public.exigir_admin_igreja(v_igreja_id);
  PERFORM pg_advisory_xact_lock(hashtext('culto-modelos:' || v_igreja_id::text)::bigint);
  SELECT m.* INTO v_model FROM public.culto_modelos m WHERE m.id = p_modelo_id FOR UPDATE;
  IF NOT p_ativo THEN
    PERFORM public.materializar_sessoes_culto(v_model.igreja_id);
  END IF;
  UPDATE public.culto_modelos
  SET ativo = p_ativo,
      vigencia_desde = CASE WHEN p_ativo THEN now() ELSE vigencia_desde END
  WHERE id = p_modelo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_programacao_culto(uuid, text, text, smallint, time, time) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.editar_programacao_culto(uuid, uuid, text, text, smallint, time, time) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.alternar_programacao_culto(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_programacao_culto(uuid, text, text, smallint, time, time) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_programacao_culto(uuid, uuid, text, text, smallint, time, time) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alternar_programacao_culto(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.validar_programacao_culto_anual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_tipo text;
BEGIN
  NEW.titulo := btrim(coalesce(NEW.titulo, ''));
  NEW.tipo := btrim(coalesce(NEW.tipo, ''));
  NEW.observacoes := nullif(btrim(coalesce(NEW.observacoes, '')), '');
  NEW.updated_at := now();
  IF NEW.ano NOT BETWEEN 2000 AND 2100
     OR date_part('year', NEW.data_culto)::smallint <> NEW.ano THEN
    RAISE EXCEPTION 'O ano deve corresponder à data da programação anual.' USING ERRCODE = '22023';
  END IF;
  IF length(NEW.titulo) < 2 OR length(NEW.titulo) > 120 THEN
    RAISE EXCEPTION 'O título deve ter entre 2 e 120 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF length(NEW.tipo) < 2 OR length(NEW.tipo) > 60 THEN
    RAISE EXCEPTION 'O tipo de culto é inválido.' USING ERRCODE = '22023';
  END IF;
  IF NEW.horario_inicio IS NULL OR NEW.horario_fim IS NULL OR NEW.horario_fim <= NEW.horario_inicio THEN
    RAISE EXCEPTION 'Informe um intervalo de horário válido.' USING ERRCODE = '22023';
  END IF;
  SELECT t.nome INTO v_tipo FROM public.culto_tipos t
  WHERE t.igreja_id = NEW.igreja_id AND lower(btrim(t.nome)) = lower(NEW.tipo) LIMIT 1;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Selecione um tipo de culto cadastrado para a igreja.' USING ERRCODE = '22023';
  END IF;
  NEW.tipo := v_tipo;
  IF NEW.ativo THEN
    PERFORM pg_advisory_xact_lock(hashtext('culto-agenda:' || NEW.igreja_id::text || ':' || NEW.data_culto::text)::bigint);
    IF EXISTS (
      SELECT 1 FROM public.programacoes_cultos_anuais outra
      WHERE outra.igreja_id = NEW.igreja_id AND outra.data_culto = NEW.data_culto
        AND outra.ativo AND outra.id <> NEW.id
        AND NEW.horario_inicio < outra.horario_fim
        AND NEW.horario_fim > outra.horario_inicio
    ) THEN
      RAISE EXCEPTION 'Já existe uma data anual ativa com horário sobreposto.' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_programacao_culto_anual ON public.programacoes_cultos_anuais;
CREATE TRIGGER trg_validar_programacao_culto_anual
  BEFORE INSERT OR UPDATE ON public.programacoes_cultos_anuais
  FOR EACH ROW EXECUTE FUNCTION public.validar_programacao_culto_anual();

CREATE OR REPLACE FUNCTION public.criar_programacao_culto_anual(
  p_igreja_id uuid,
  p_data_culto date,
  p_titulo text,
  p_tipo text,
  p_horario_inicio time,
  p_horario_fim time,
  p_observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_ano smallint := date_part('year', p_data_culto)::smallint;
  v_tipo text;
BEGIN
  PERFORM public.exigir_admin_igreja(p_igreja_id);
  PERFORM pg_advisory_xact_lock(hashtext('culto-agenda:' || p_igreja_id::text || ':' || p_data_culto::text)::bigint);
  IF p_data_culto IS NULL OR v_ano NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'Informe uma data anual válida.' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(coalesce(p_titulo, ''))) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'O título deve ter entre 2 e 120 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF p_horario_inicio IS NULL OR p_horario_fim IS NULL OR p_horario_fim <= p_horario_inicio THEN
    RAISE EXCEPTION 'Informe um intervalo de horário válido.' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(coalesce(p_observacoes, ''))) > 2000 THEN
    RAISE EXCEPTION 'As observações devem ter no máximo 2.000 caracteres.' USING ERRCODE = '22023';
  END IF;
  SELECT t.nome INTO v_tipo FROM public.culto_tipos t
  WHERE t.igreja_id = p_igreja_id AND lower(btrim(t.nome)) = lower(btrim(coalesce(p_tipo, ''))) LIMIT 1;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Selecione um tipo de culto cadastrado para a igreja.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.programacoes_cultos_anuais (igreja_id, ano, data_culto, titulo, tipo, horario_inicio, horario_fim, observacoes, created_by)
  VALUES (p_igreja_id, v_ano, p_data_culto, btrim(p_titulo), v_tipo, p_horario_inicio, p_horario_fim, nullif(btrim(coalesce(p_observacoes, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.editar_programacao_culto_anual(
  p_programacao_id uuid,
  p_data_culto date,
  p_titulo text,
  p_tipo text,
  p_horario_inicio time,
  p_horario_fim time,
  p_observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_item public.programacoes_cultos_anuais%ROWTYPE;
  v_ano smallint := date_part('year', p_data_culto)::smallint;
  v_tipo text;
  v_igreja_id uuid;
BEGIN
  SELECT a.igreja_id INTO v_igreja_id FROM public.programacoes_cultos_anuais a WHERE a.id = p_programacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Programação anual não encontrada.' USING ERRCODE = '40400';
  END IF;
  PERFORM public.exigir_admin_igreja(v_igreja_id);
  PERFORM pg_advisory_xact_lock(hashtext('culto-agenda:' || v_igreja_id::text)::bigint);
  SELECT a.* INTO v_item FROM public.programacoes_cultos_anuais a WHERE a.id = p_programacao_id FOR UPDATE;
  IF p_data_culto IS NULL OR v_ano NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'Informe uma data anual válida.' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(coalesce(p_titulo, ''))) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'O título deve ter entre 2 e 120 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF p_horario_inicio IS NULL OR p_horario_fim IS NULL OR p_horario_fim <= p_horario_inicio THEN
    RAISE EXCEPTION 'Informe um intervalo de horário válido.' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(coalesce(p_observacoes, ''))) > 2000 THEN
    RAISE EXCEPTION 'As observações devem ter no máximo 2.000 caracteres.' USING ERRCODE = '22023';
  END IF;
  SELECT t.nome INTO v_tipo FROM public.culto_tipos t
  WHERE t.igreja_id = v_item.igreja_id AND lower(btrim(t.nome)) = lower(btrim(coalesce(p_tipo, ''))) LIMIT 1;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Selecione um tipo de culto cadastrado para a igreja.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.programacoes_cultos_anuais
  SET ano = v_ano, data_culto = p_data_culto, titulo = btrim(p_titulo), tipo = v_tipo,
      horario_inicio = p_horario_inicio, horario_fim = p_horario_fim,
      observacoes = nullif(btrim(coalesce(p_observacoes, '')), ''), updated_at = now()
  WHERE id = p_programacao_id;
  RETURN p_programacao_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.alternar_programacao_culto_anual(
  p_programacao_id uuid,
  p_ativo boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_item public.programacoes_cultos_anuais%ROWTYPE;
  v_igreja_id uuid;
BEGIN
  SELECT a.igreja_id INTO v_igreja_id FROM public.programacoes_cultos_anuais a WHERE a.id = p_programacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Programação anual não encontrada.' USING ERRCODE = '40400';
  END IF;
  PERFORM public.exigir_admin_igreja(v_igreja_id);
  PERFORM pg_advisory_xact_lock(hashtext('culto-agenda:' || v_igreja_id::text)::bigint);
  SELECT a.* INTO v_item FROM public.programacoes_cultos_anuais a WHERE a.id = p_programacao_id FOR UPDATE;
  UPDATE public.programacoes_cultos_anuais SET ativo = p_ativo, updated_at = now() WHERE id = p_programacao_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_programacao_culto_anual(uuid, date, text, text, time, time, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.editar_programacao_culto_anual(uuid, date, text, text, time, time, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.alternar_programacao_culto_anual(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_programacao_culto_anual(uuid, date, text, text, time, time, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_programacao_culto_anual(uuid, date, text, text, time, time, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alternar_programacao_culto_anual(uuid, boolean) TO authenticated;

-- O renome de um tipo mantém a agenda anual legível e consistente. Sessões históricas
-- seguem o comportamento já existente de editar_tipo_culto; a edição de um modelo
-- individual, por sua vez, nunca toca culto_sessoes.
CREATE OR REPLACE FUNCTION public.editar_tipo_culto(
  p_tipo_id uuid,
  p_nome text,
  p_ativo boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_tipo record;
  v_nome text := btrim(coalesce(p_nome, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = '42501';
  END IF;
  SELECT t.id, t.igreja_id, t.nome INTO v_tipo
  FROM public.culto_tipos t
  JOIN public.usuarios u ON u.id = auth.uid()
    AND u.igreja_id = t.igreja_id
    AND lower(coalesce(u.role::text, '')) = 'admin'
  WHERE t.id = p_tipo_id FOR UPDATE OF t;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tipo de culto não encontrado ou acesso não autorizado.' USING ERRCODE = '42501';
  END IF;
  IF length(v_nome) < 2 OR length(v_nome) > 60 THEN
    RAISE EXCEPTION 'O nome deve ter entre 2 e 60 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.culto_tipos outro
    WHERE outro.igreja_id = v_tipo.igreja_id AND outro.id <> p_tipo_id
      AND lower(btrim(outro.nome)) = lower(v_nome)
  ) THEN
    RAISE EXCEPTION 'Já existe um tipo de culto com esse nome.' USING ERRCODE = '23505';
  END IF;
  UPDATE public.culto_tipos
  SET nome = v_nome, ativo = coalesce(p_ativo, ativo), updated_at = now()
  WHERE id = p_tipo_id;
  IF v_tipo.nome <> v_nome THEN
    UPDATE public.culto_modelos SET tipo = v_nome WHERE igreja_id = v_tipo.igreja_id AND lower(btrim(tipo)) = lower(btrim(v_tipo.nome));
    UPDATE public.culto_sessoes SET tipo = v_nome WHERE igreja_id = v_tipo.igreja_id AND lower(btrim(tipo)) = lower(btrim(v_tipo.nome));
    UPDATE public.programacoes_cultos_anuais SET tipo = v_nome WHERE igreja_id = v_tipo.igreja_id AND lower(btrim(tipo)) = lower(btrim(v_tipo.nome));
  END IF;
END;
$$;

COMMIT;
