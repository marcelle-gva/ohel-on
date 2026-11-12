BEGIN;

CREATE TABLE IF NOT EXISTS public.culto_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 2 AND 60),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_culto_tipos_igreja_nome
  ON public.culto_tipos (igreja_id, lower(btrim(nome)));

ALTER TABLE public.culto_tipos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS culto_tipos_ler_igreja ON public.culto_tipos;
CREATE POLICY culto_tipos_ler_igreja
  ON public.culto_tipos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.igreja_id = culto_tipos.igreja_id
    )
  );

DROP POLICY IF EXISTS culto_tipos_criar_admin ON public.culto_tipos;
CREATE POLICY culto_tipos_criar_admin
  ON public.culto_tipos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.igreja_id = culto_tipos.igreja_id
        AND lower(coalesce(u.role::text, '')) = 'admin'
    )
  );

GRANT SELECT, INSERT ON public.culto_tipos TO authenticated;
REVOKE UPDATE, DELETE ON public.culto_tipos FROM anon, authenticated;

-- Keep the existing select values available to every current and future church.
CREATE OR REPLACE FUNCTION public.semear_tipos_culto_igreja()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.culto_tipos (igreja_id, nome)
  SELECT NEW.id, tipo.nome
  FROM (VALUES
    ('Culto de Domingo'),
    ('Culto de Quarta-feira'),
    ('Culto de Oração'),
    ('Culto de Ceia'),
    ('Culto Especial'),
    ('Outro')
  ) AS tipo(nome)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_semear_tipos_culto_igreja ON public.igrejas;
CREATE TRIGGER trg_semear_tipos_culto_igreja
  AFTER INSERT ON public.igrejas
  FOR EACH ROW EXECUTE FUNCTION public.semear_tipos_culto_igreja();

INSERT INTO public.culto_tipos (igreja_id, nome)
SELECT igreja.id, tipo.nome
FROM public.igrejas igreja
CROSS JOIN (VALUES
  ('Culto de Domingo'),
  ('Culto de Quarta-feira'),
  ('Culto de Oração'),
  ('Culto de Ceia'),
  ('Culto Especial'),
  ('Outro')
) AS tipo(nome)
ON CONFLICT DO NOTHING;

-- Preserve any values already used by schedules or historical sessions.
INSERT INTO public.culto_tipos (igreja_id, nome)
SELECT DISTINCT existentes.igreja_id, btrim(existentes.tipo)
FROM (
  SELECT igreja_id, tipo FROM public.culto_modelos
  UNION
  SELECT igreja_id, tipo FROM public.culto_sessoes
) existentes
WHERE nullif(btrim(existentes.tipo), '') IS NOT NULL
ON CONFLICT DO NOTHING;

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

  SELECT t.id, t.igreja_id, t.nome
  INTO v_tipo
  FROM public.culto_tipos t
  JOIN public.usuarios u ON u.id = auth.uid()
    AND u.igreja_id = t.igreja_id
    AND lower(coalesce(u.role::text, '')) = 'admin'
  WHERE t.id = p_tipo_id
  FOR UPDATE OF t;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tipo de culto não encontrado ou acesso não autorizado.'
      USING ERRCODE = '42501';
  END IF;
  IF length(v_nome) < 2 OR length(v_nome) > 60 THEN
    RAISE EXCEPTION 'O nome deve ter entre 2 e 60 caracteres.'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.culto_tipos outro
    WHERE outro.igreja_id = v_tipo.igreja_id
      AND outro.id <> p_tipo_id
      AND lower(btrim(outro.nome)) = lower(v_nome)
  ) THEN
    RAISE EXCEPTION 'Já existe um tipo de culto com esse nome.'
      USING ERRCODE = '23505';
  END IF;

  IF v_tipo.nome <> v_nome THEN
    UPDATE public.culto_modelos
    SET tipo = v_nome
    WHERE igreja_id = v_tipo.igreja_id AND lower(btrim(tipo)) = lower(btrim(v_tipo.nome));

    UPDATE public.culto_sessoes
    SET tipo = v_nome
    WHERE igreja_id = v_tipo.igreja_id AND lower(btrim(tipo)) = lower(btrim(v_tipo.nome));
  END IF;

  UPDATE public.culto_tipos
  SET nome = v_nome, ativo = coalesce(p_ativo, ativo), updated_at = now()
  WHERE id = p_tipo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.editar_tipo_culto(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_tipo_culto(uuid, text, boolean) TO authenticated;

-- A fixed schedule is identified by its church, weekday and start time. Disabling
-- a model keeps its past sessions and allows the same slot to be reused later.
CREATE UNIQUE INDEX IF NOT EXISTS uq_culto_modelos_igreja_dia_horario_ativo
  ON public.culto_modelos (igreja_id, dia_semana, horario_inicio)
  WHERE ativo = true AND dia_semana IS NOT NULL AND horario_inicio IS NOT NULL;

-- A single dated occurrence cannot be generated by two different fixed models.
CREATE UNIQUE INDEX IF NOT EXISTS uq_culto_sessoes_igreja_inicio
  ON public.culto_sessoes (igreja_id, inicio_em);

-- A church has one active worship session at a time, including manual starts.
CREATE UNIQUE INDEX IF NOT EXISTS uq_culto_sessoes_igreja_aberto
  ON public.culto_sessoes (igreja_id)
  WHERE status = 'aberto';

COMMIT;
