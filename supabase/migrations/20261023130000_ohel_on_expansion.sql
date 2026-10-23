ALTER TABLE public.departamentos_membros
  ADD COLUMN IF NOT EXISTS departamento_id uuid;

DO $department_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.departamentos_membros'::regclass
      AND confrelid = 'public.departamentos'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[
        (
          SELECT attnum
          FROM pg_attribute
          WHERE attrelid = 'public.departamentos_membros'::regclass
            AND attname = 'departamento_id'
            AND NOT attisdropped
        )
      ]::smallint[]
  ) THEN
    ALTER TABLE public.departamentos_membros
      ADD CONSTRAINT departamentos_membros_departamento_id_fkey
      FOREIGN KEY (departamento_id)
      REFERENCES public.departamentos(id)
      ON DELETE SET NULL;
  END IF;
END;
$department_fk$;

WITH department_matches AS (
  SELECT
    association.id AS association_id,
    department.id AS department_id,
    count(*) OVER (PARTITION BY association.id) AS match_count
  FROM public.departamentos_membros AS association
  JOIN public.membros AS member ON member.id = association.membro_id
  JOIN public.departamentos AS department
    ON department.igreja_id = member.igreja_id
   AND lower(btrim(department.nome)) = lower(btrim(association.departamento))
  WHERE association.departamento_id IS NULL
)
UPDATE public.departamentos_membros AS association
SET departamento_id = matches.department_id
FROM department_matches AS matches
WHERE matches.association_id = association.id
  AND matches.match_count = 1;

CREATE OR REPLACE FUNCTION public.validate_member_department_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
DECLARE
  v_member_church uuid;
  v_department_church uuid;
BEGIN
  SELECT member.igreja_id
  INTO v_member_church
  FROM public.membros AS member
  WHERE member.id = NEW.membro_id;

  IF v_member_church IS NULL THEN
    RAISE EXCEPTION 'O membro informado não existe.';
  END IF;

  IF NEW.departamento_id IS NOT NULL THEN
    SELECT department.igreja_id
    INTO v_department_church
    FROM public.departamentos AS department
    WHERE department.id = NEW.departamento_id;

    IF v_department_church IS NULL OR v_department_church <> v_member_church THEN
      RAISE EXCEPTION 'O departamento deve pertencer à mesma igreja do membro.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_member_department_link
  ON public.departamentos_membros;
CREATE TRIGGER validate_member_department_link
BEFORE INSERT OR UPDATE OF membro_id, departamento_id
ON public.departamentos_membros
FOR EACH ROW
EXECUTE FUNCTION public.validate_member_department_link();

DROP POLICY IF EXISTS "Ver departamentos da propria igreja"
  ON public.departamentos_membros;
DROP POLICY IF EXISTS "ohel_member_departments_select"
  ON public.departamentos_membros;
DROP POLICY IF EXISTS "ohel_member_departments_insert"
  ON public.departamentos_membros;
DROP POLICY IF EXISTS "ohel_member_departments_update"
  ON public.departamentos_membros;
DROP POLICY IF EXISTS "ohel_member_departments_delete"
  ON public.departamentos_membros;

CREATE POLICY "ohel_member_departments_select"
ON public.departamentos_membros FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.membros AS member
    WHERE member.id = membro_id
      AND public.has_church_module_permission(
        member.igreja_id,
        'membros',
        ARRAY['ler']::text[]
      )
  )
);
CREATE POLICY "ohel_member_departments_insert"
ON public.departamentos_membros FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.membros AS member
    WHERE member.id = membro_id
      AND public.has_church_module_permission(
        member.igreja_id,
        'membros',
        ARRAY['criar', 'editar']::text[]
      )
  )
);
CREATE POLICY "ohel_member_departments_update"
ON public.departamentos_membros FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.membros AS member
    WHERE member.id = membro_id
      AND public.has_church_module_permission(
        member.igreja_id,
        'membros',
        ARRAY['editar']::text[]
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.membros AS member
    WHERE member.id = membro_id
      AND public.has_church_module_permission(
        member.igreja_id,
        'membros',
        ARRAY['editar']::text[]
      )
  )
);
CREATE POLICY "ohel_member_departments_delete"
ON public.departamentos_membros FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.membros AS member
    WHERE member.id = membro_id
      AND public.has_church_module_permission(
        member.igreja_id,
        'membros',
        ARRAY['editar', 'excluir']::text[]
      )
  )
);

CREATE OR REPLACE FUNCTION public.save_member_departments(
  p_membro_id uuid,
  p_departamento_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_igreja_id uuid;
  v_department_count integer;
  v_requested_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'É necessário estar autenticado.';
  END IF;

  SELECT member.igreja_id
  INTO v_igreja_id
  FROM public.membros AS member
  WHERE member.id = p_membro_id;

  IF v_igreja_id IS NULL
     OR NOT public.has_church_module_permission(
       v_igreja_id,
       'membros',
       ARRAY['criar', 'editar']::text[]
     ) THEN
    RAISE EXCEPTION 'Você não tem permissão para alterar os departamentos deste membro.';
  END IF;

  SELECT count(DISTINCT requested.id)
  INTO v_requested_count
  FROM unnest(COALESCE(p_departamento_ids, ARRAY[]::uuid[])) AS requested(id);

  SELECT count(*)
  INTO v_department_count
  FROM public.departamentos AS department
  WHERE department.id = ANY(COALESCE(p_departamento_ids, ARRAY[]::uuid[]))
    AND department.igreja_id = v_igreja_id;

  IF v_department_count <> v_requested_count THEN
    RAISE EXCEPTION 'Um ou mais departamentos não pertencem à igreja do membro.';
  END IF;

  DELETE FROM public.departamentos_membros AS association
  WHERE association.membro_id = p_membro_id
    AND association.departamento_id IS NOT NULL
    AND NOT (
      association.departamento_id = ANY(
        COALESCE(p_departamento_ids, ARRAY[]::uuid[])
      )
    );

  INSERT INTO public.departamentos_membros (
    membro_id,
    departamento_id,
    departamento,
    funcao,
    data_inicio
  )
  SELECT
    p_membro_id,
    department.id,
    department.nome,
    'Membro',
    current_date
  FROM public.departamentos AS department
  WHERE department.id = ANY(COALESCE(p_departamento_ids, ARRAY[]::uuid[]))
    AND department.igreja_id = v_igreja_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.departamentos_membros AS association
      WHERE association.membro_id = p_membro_id
        AND (
          association.departamento_id = department.id
          OR (
            association.departamento_id IS NULL
            AND lower(btrim(association.departamento)) =
                lower(btrim(department.nome))
          )
        )
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_member_departments(uuid, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_member_departments(uuid, uuid[])
  TO authenticated;

CREATE TABLE IF NOT EXISTS public.config_checkin_fusos (
  igreja_id uuid PRIMARY KEY REFERENCES public.igrejas(id) ON DELETE CASCADE,
  fuso_horario text NOT NULL DEFAULT 'America/Sao_Paulo',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.config_checkin_fusos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.config_checkin_fusos FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.config_checkin_fusos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.config_checkin_fusos TO service_role;

DROP POLICY IF EXISTS ohel_checkin_timezone_select ON public.config_checkin_fusos;
DROP POLICY IF EXISTS ohel_checkin_timezone_insert ON public.config_checkin_fusos;
DROP POLICY IF EXISTS ohel_checkin_timezone_update ON public.config_checkin_fusos;
CREATE POLICY ohel_checkin_timezone_select
ON public.config_checkin_fusos FOR SELECT TO authenticated
USING (
  igreja_id = (
    SELECT usuario.igreja_id
    FROM public.usuarios AS usuario
    WHERE usuario.id = auth.uid()
  )
);
CREATE POLICY ohel_checkin_timezone_insert
ON public.config_checkin_fusos FOR INSERT TO authenticated
WITH CHECK (
  public.has_church_module_permission(
    igreja_id,
    'configuracoes',
    ARRAY['criar', 'editar']::text[]
  )
);
CREATE POLICY ohel_checkin_timezone_update
ON public.config_checkin_fusos FOR UPDATE TO authenticated
USING (
  public.has_church_module_permission(
    igreja_id,
    'configuracoes',
    ARRAY['editar']::text[]
  )
)
WITH CHECK (
  public.has_church_module_permission(
    igreja_id,
    'configuracoes',
    ARRAY['editar']::text[]
  )
);

INSERT INTO public.config_checkin_fusos (igreja_id)
SELECT church.id
FROM public.igrejas AS church
ON CONFLICT (igreja_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.checkin_qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkin_qr_tokens_igreja_expiry_idx
  ON public.checkin_qr_tokens (igreja_id, expires_at);
ALTER TABLE public.checkin_qr_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkin_qr_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.checkin_qr_tokens TO service_role;

ALTER TABLE public.membros
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at timestamptz;

CREATE TABLE IF NOT EXISTS public.patrimonio_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (igreja_id, nome)
);

CREATE TABLE IF NOT EXISTS public.patrimonio_localizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (igreja_id, nome)
);

ALTER TABLE public.patrimonio_tipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrimonio_localizacoes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.patrimonio_tipos, public.patrimonio_localizacoes
  TO authenticated;

DROP POLICY IF EXISTS "ohel_asset_types_select" ON public.patrimonio_tipos;
DROP POLICY IF EXISTS "ohel_asset_types_insert" ON public.patrimonio_tipos;
DROP POLICY IF EXISTS "ohel_asset_types_update" ON public.patrimonio_tipos;
DROP POLICY IF EXISTS "ohel_asset_types_delete" ON public.patrimonio_tipos;
CREATE POLICY "ohel_asset_types_select"
ON public.patrimonio_tipos FOR SELECT TO authenticated
USING (
  public.has_church_module_permission(igreja_id, 'patrimonio', ARRAY['ler']::text[])
  OR public.has_church_module_permission(igreja_id, 'configuracoes', ARRAY['ler']::text[])
);
CREATE POLICY "ohel_asset_types_insert"
ON public.patrimonio_tipos FOR INSERT TO authenticated
WITH CHECK (public.has_church_module_permission(igreja_id, 'configuracoes', ARRAY['criar', 'editar']::text[]));
CREATE POLICY "ohel_asset_types_update"
ON public.patrimonio_tipos FOR UPDATE TO authenticated
USING (public.has_church_module_permission(igreja_id, 'configuracoes', ARRAY['editar']::text[]))
WITH CHECK (public.has_church_module_permission(igreja_id, 'configuracoes', ARRAY['editar']::text[]));
CREATE POLICY "ohel_asset_types_delete"
ON public.patrimonio_tipos FOR DELETE TO authenticated
USING (public.has_church_module_permission(igreja_id, 'configuracoes', ARRAY['excluir']::text[]));

DROP POLICY IF EXISTS "ohel_asset_locations_select" ON public.patrimonio_localizacoes;
DROP POLICY IF EXISTS "ohel_asset_locations_insert" ON public.patrimonio_localizacoes;
DROP POLICY IF EXISTS "ohel_asset_locations_update" ON public.patrimonio_localizacoes;
DROP POLICY IF EXISTS "ohel_asset_locations_delete" ON public.patrimonio_localizacoes;
CREATE POLICY "ohel_asset_locations_select"
ON public.patrimonio_localizacoes FOR SELECT TO authenticated
USING (
  public.has_church_module_permission(igreja_id, 'patrimonio', ARRAY['ler']::text[])
  OR public.has_church_module_permission(igreja_id, 'configuracoes', ARRAY['ler']::text[])
);
CREATE POLICY "ohel_asset_locations_insert"
ON public.patrimonio_localizacoes FOR INSERT TO authenticated
WITH CHECK (public.has_church_module_permission(igreja_id, 'configuracoes', ARRAY['criar', 'editar']::text[]));
CREATE POLICY "ohel_asset_locations_update"
ON public.patrimonio_localizacoes FOR UPDATE TO authenticated
USING (public.has_church_module_permission(igreja_id, 'configuracoes', ARRAY['editar']::text[]))
WITH CHECK (public.has_church_module_permission(igreja_id, 'configuracoes', ARRAY['editar']::text[]));
CREATE POLICY "ohel_asset_locations_delete"
ON public.patrimonio_localizacoes FOR DELETE TO authenticated
USING (public.has_church_module_permission(igreja_id, 'configuracoes', ARRAY['excluir']::text[]));

INSERT INTO public.patrimonio_tipos (igreja_id, nome)
SELECT church.id, asset_type.nome
FROM public.igrejas AS church
CROSS JOIN unnest(ARRAY[
  'Som / Áudio',
  'Instrumentos Musicais',
  'Informática / TI',
  'Móveis e Utensílios',
  'Veículos',
  'Imóvel',
  'Outros'
]::text[]) AS asset_type(nome)
ON CONFLICT (igreja_id, nome) DO NOTHING;

INSERT INTO public.patrimonio_tipos (igreja_id, nome)
SELECT DISTINCT asset.igreja_id, btrim(asset.tipo)
FROM public.patrimonio_bens AS asset
WHERE asset.tipo IS NOT NULL AND length(btrim(asset.tipo)) > 0
ON CONFLICT (igreja_id, nome) DO NOTHING;

INSERT INTO public.patrimonio_localizacoes (igreja_id, nome)
SELECT DISTINCT asset.igreja_id, btrim(asset.localizacao)
FROM public.patrimonio_bens AS asset
WHERE asset.localizacao IS NOT NULL AND length(btrim(asset.localizacao)) > 0
ON CONFLICT (igreja_id, nome) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_patrimonio_master_data()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  INSERT INTO public.patrimonio_tipos (igreja_id, nome)
  SELECT NEW.id, asset_type.nome
  FROM unnest(ARRAY[
    'Som / Áudio',
    'Instrumentos Musicais',
    'Informática / TI',
    'Móveis e Utensílios',
    'Veículos',
    'Imóvel',
    'Outros'
  ]::text[]) AS asset_type(nome)
  ON CONFLICT (igreja_id, nome) DO NOTHING;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS seed_patrimonio_master_data
  ON public.igrejas;
CREATE TRIGGER seed_patrimonio_master_data
AFTER INSERT ON public.igrejas
FOR EACH ROW
EXECUTE FUNCTION public.seed_patrimonio_master_data();

CREATE TABLE IF NOT EXISTS public.salas_infantis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  faixa_etaria text,
  capacidade integer CHECK (capacidade IS NULL OR capacidade > 0),
  responsavel text,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (igreja_id, nome)
);

CREATE TABLE IF NOT EXISTS public.criancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  sala_id uuid REFERENCES public.salas_infantis(id) ON DELETE SET NULL,
  nome text NOT NULL,
  data_nascimento date,
  sexo text,
  responsavel_nome text NOT NULL,
  responsavel_telefone text NOT NULL,
  responsavel_email text,
  responsavel_whatsapp_opt_in boolean NOT NULL DEFAULT false,
  alergias text,
  observacoes text,
  foto_url text,
  status text NOT NULL DEFAULT 'Ativo'
    CHECK (status IN ('Ativo', 'Inativo')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.checkins_infantis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  crianca_id uuid NOT NULL REFERENCES public.criancas(id) ON DELETE RESTRICT,
  sala_id uuid REFERENCES public.salas_infantis(id) ON DELETE SET NULL,
  responsavel_retirada text NOT NULL,
  codigo_retirada text NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  checkin_at timestamptz NOT NULL DEFAULT now(),
  checkout_at timestamptz,
  checkin_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  checkout_por uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS checkins_infantis_uma_sessao_ativa
  ON public.checkins_infantis (crianca_id)
  WHERE checkout_at IS NULL;
CREATE INDEX IF NOT EXISTS checkins_infantis_igreja_data_idx
  ON public.checkins_infantis (igreja_id, checkin_at DESC);

ALTER TABLE public.salas_infantis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.criancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins_infantis ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.salas_infantis, public.criancas, public.checkins_infantis
  TO authenticated;

DROP POLICY IF EXISTS "ohel_kids_rooms_select" ON public.salas_infantis;
DROP POLICY IF EXISTS "ohel_kids_rooms_insert" ON public.salas_infantis;
DROP POLICY IF EXISTS "ohel_kids_rooms_update" ON public.salas_infantis;
DROP POLICY IF EXISTS "ohel_kids_rooms_delete" ON public.salas_infantis;
CREATE POLICY "ohel_kids_rooms_select"
ON public.salas_infantis FOR SELECT TO authenticated
USING (public.has_church_module_permission(igreja_id, 'infantil', ARRAY['ler']::text[]));
CREATE POLICY "ohel_kids_rooms_insert"
ON public.salas_infantis FOR INSERT TO authenticated
WITH CHECK (public.has_church_module_permission(igreja_id, 'infantil', ARRAY['criar']::text[]));
CREATE POLICY "ohel_kids_rooms_update"
ON public.salas_infantis FOR UPDATE TO authenticated
USING (public.has_church_module_permission(igreja_id, 'infantil', ARRAY['editar']::text[]))
WITH CHECK (public.has_church_module_permission(igreja_id, 'infantil', ARRAY['editar']::text[]));
CREATE POLICY "ohel_kids_rooms_delete"
ON public.salas_infantis FOR DELETE TO authenticated
USING (public.has_church_module_permission(igreja_id, 'infantil', ARRAY['excluir']::text[]));

DROP POLICY IF EXISTS "ohel_kids_children_select" ON public.criancas;
DROP POLICY IF EXISTS "ohel_kids_children_insert" ON public.criancas;
DROP POLICY IF EXISTS "ohel_kids_children_update" ON public.criancas;
DROP POLICY IF EXISTS "ohel_kids_children_delete" ON public.criancas;
CREATE POLICY "ohel_kids_children_select"
ON public.criancas FOR SELECT TO authenticated
USING (public.has_church_module_permission(igreja_id, 'infantil', ARRAY['ler']::text[]));
CREATE POLICY "ohel_kids_children_insert"
ON public.criancas FOR INSERT TO authenticated
WITH CHECK (
  public.has_church_module_permission(igreja_id, 'infantil', ARRAY['criar']::text[])
  AND (
    sala_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.salas_infantis AS room
      WHERE room.id = sala_id AND room.igreja_id = igreja_id
    )
  )
);
CREATE POLICY "ohel_kids_children_update"
ON public.criancas FOR UPDATE TO authenticated
USING (public.has_church_module_permission(igreja_id, 'infantil', ARRAY['editar']::text[]))
WITH CHECK (
  public.has_church_module_permission(igreja_id, 'infantil', ARRAY['editar']::text[])
  AND (
    sala_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.salas_infantis AS room
      WHERE room.id = sala_id AND room.igreja_id = igreja_id
    )
  )
);
CREATE POLICY "ohel_kids_children_delete"
ON public.criancas FOR DELETE TO authenticated
USING (public.has_church_module_permission(igreja_id, 'infantil', ARRAY['excluir']::text[]));

DROP POLICY IF EXISTS "ohel_kids_checkins_select" ON public.checkins_infantis;
DROP POLICY IF EXISTS "ohel_kids_checkins_insert" ON public.checkins_infantis;
DROP POLICY IF EXISTS "ohel_kids_checkins_update" ON public.checkins_infantis;
DROP POLICY IF EXISTS "ohel_kids_checkins_delete" ON public.checkins_infantis;
CREATE POLICY "ohel_kids_checkins_select"
ON public.checkins_infantis FOR SELECT TO authenticated
USING (public.has_church_module_permission(igreja_id, 'infantil', ARRAY['ler']::text[]));
CREATE POLICY "ohel_kids_checkins_insert"
ON public.checkins_infantis FOR INSERT TO authenticated
WITH CHECK (
  public.has_church_module_permission(igreja_id, 'infantil', ARRAY['criar', 'editar']::text[])
  AND EXISTS (
    SELECT 1 FROM public.criancas AS child
    WHERE child.id = crianca_id AND child.igreja_id = igreja_id
  )
  AND (
    sala_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.salas_infantis AS room
      WHERE room.id = sala_id AND room.igreja_id = igreja_id
    )
  )
);
CREATE POLICY "ohel_kids_checkins_update"
ON public.checkins_infantis FOR UPDATE TO authenticated
USING (public.has_church_module_permission(igreja_id, 'infantil', ARRAY['editar']::text[]))
WITH CHECK (
  public.has_church_module_permission(igreja_id, 'infantil', ARRAY['editar']::text[])
  AND EXISTS (
    SELECT 1 FROM public.criancas AS child
    WHERE child.id = crianca_id AND child.igreja_id = igreja_id
  )
  AND (
    sala_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.salas_infantis AS room
      WHERE room.id = sala_id AND room.igreja_id = igreja_id
    )
  )
);
CREATE POLICY "ohel_kids_checkins_delete"
ON public.checkins_infantis FOR DELETE TO authenticated
USING (public.has_church_module_permission(igreja_id, 'infantil', ARRAY['excluir']::text[]));

CREATE TABLE IF NOT EXISTS public.relatorios_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  fonte text NOT NULL CHECK (fonte IN ('membros', 'transacoes', 'eventos', 'patrimonio')),
  titulo text NOT NULL,
  subtitulo text,
  colunas text[] NOT NULL DEFAULT ARRAY[]::text[],
  orientacao text NOT NULL DEFAULT 'paisagem'
    CHECK (orientacao IN ('retrato', 'paisagem')),
  totalizador boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (igreja_id, nome)
);

ALTER TABLE public.relatorios_modelos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorios_modelos TO authenticated;
DROP POLICY IF EXISTS "ohel_report_templates_select" ON public.relatorios_modelos;
DROP POLICY IF EXISTS "ohel_report_templates_insert" ON public.relatorios_modelos;
DROP POLICY IF EXISTS "ohel_report_templates_update" ON public.relatorios_modelos;
DROP POLICY IF EXISTS "ohel_report_templates_delete" ON public.relatorios_modelos;
CREATE POLICY "ohel_report_templates_select"
ON public.relatorios_modelos FOR SELECT TO authenticated
USING (public.has_church_module_permission(igreja_id, 'relatorios', ARRAY['ler']::text[]));
CREATE POLICY "ohel_report_templates_insert"
ON public.relatorios_modelos FOR INSERT TO authenticated
WITH CHECK (public.has_church_module_permission(igreja_id, 'relatorios', ARRAY['criar']::text[]));
CREATE POLICY "ohel_report_templates_update"
ON public.relatorios_modelos FOR UPDATE TO authenticated
USING (public.has_church_module_permission(igreja_id, 'relatorios', ARRAY['editar']::text[]))
WITH CHECK (public.has_church_module_permission(igreja_id, 'relatorios', ARRAY['editar']::text[]));
CREATE POLICY "ohel_report_templates_delete"
ON public.relatorios_modelos FOR DELETE TO authenticated
USING (public.has_church_module_permission(igreja_id, 'relatorios', ARRAY['excluir']::text[]));

CREATE TABLE IF NOT EXISTS public.configuracoes_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL UNIQUE REFERENCES public.igrejas(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL,
  business_account_id text NOT NULL,
  display_phone_number text,
  access_token_encrypted text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mensagens_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  destinatario_membro_id uuid REFERENCES public.membros(id) ON DELETE SET NULL,
  destinatario_crianca_id uuid REFERENCES public.criancas(id) ON DELETE SET NULL,
  destinatario_telefone text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('texto', 'modelo')),
  conteudo text NOT NULL,
  nome_modelo text,
  idioma_modelo text,
  status text NOT NULL DEFAULT 'aceita'
    CHECK (status IN ('aceita', 'enviada', 'entregue', 'lida', 'falhou')),
  provider_message_id text,
  erro text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mensagens_whatsapp
  ADD COLUMN IF NOT EXISTS destinatario_crianca_id uuid
  REFERENCES public.criancas(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mensagens_whatsapp_provider_id_idx
  ON public.mensagens_whatsapp (provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mensagens_whatsapp_igreja_data_idx
  ON public.mensagens_whatsapp (igreja_id, created_at DESC);

ALTER TABLE public.configuracoes_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_whatsapp ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.configuracoes_whatsapp FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.mensagens_whatsapp FROM PUBLIC, anon;
GRANT SELECT ON public.mensagens_whatsapp TO authenticated;
DROP POLICY IF EXISTS "ohel_whatsapp_messages_select" ON public.mensagens_whatsapp;
CREATE POLICY "ohel_whatsapp_messages_select"
ON public.mensagens_whatsapp FOR SELECT TO authenticated
USING (public.has_church_module_permission(igreja_id, 'comunicacoes', ARRAY['ler']::text[]));

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admins FROM PUBLIC, anon, authenticated;

DO $platform_admin_seed$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = 'marcelle.gva@gmail.com'
  ) THEN
    RAISE EXCEPTION 'Crie ou confirme a conta marcelle.gva@gmail.com no Supabase Auth antes de aplicar esta migration.';
  END IF;

  INSERT INTO public.platform_admins (user_id, email)
  SELECT id, lower(email)
  FROM auth.users
  WHERE lower(email) = 'marcelle.gva@gmail.com'
  ON CONFLICT DO NOTHING;
END;
$platform_admin_seed$;

ALTER TABLE public.igreja_signup_tokens
  ADD COLUMN IF NOT EXISTS invited_email text;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins AS platform_admin
    WHERE platform_admin.user_id = auth.uid()
  );
$function$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_list_churches()
RETURNS TABLE (
  igreja_id uuid,
  igreja_nome text,
  criado_em timestamptz,
  total_membros bigint,
  total_usuarios bigint,
  emails_administradores text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.';
  END IF;

  RETURN QUERY
  SELECT
    church.id,
    church.nome,
    church.created_at,
    (SELECT count(*) FROM public.membros AS member WHERE member.igreja_id = church.id),
    (SELECT count(*) FROM public.usuarios AS user_account WHERE user_account.igreja_id = church.id),
    COALESCE(
      (
        SELECT array_agg(user_account.email ORDER BY user_account.email)
        FROM public.usuarios AS user_account
        WHERE user_account.igreja_id = church.id
          AND user_account.role = 'admin'
          AND user_account.email IS NOT NULL
      ),
      ARRAY[]::text[]
    )
  FROM public.igrejas AS church
  ORDER BY church.nome;
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_create_church_admin_invite(
  p_nome_igreja text,
  p_email_admin text
)
RETURNS TABLE (
  igreja_id uuid,
  igreja_nome text,
  email_admin text,
  convite_token uuid,
  expira_em timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_igreja_id uuid;
  v_token uuid := gen_random_uuid();
  v_nome text := btrim(p_nome_igreja);
  v_email text := lower(btrim(p_email_admin));
  v_expira_em timestamptz := now() + interval '7 days';
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à administração da plataforma.';
  END IF;
  IF v_nome IS NULL OR length(v_nome) = 0 THEN
    RAISE EXCEPTION 'O nome da igreja é obrigatório.';
  END IF;
  IF v_email IS NULL OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido para o novo administrador.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM auth.users AS existing_user
    WHERE lower(existing_user.email) = v_email
  ) THEN
    RAISE EXCEPTION 'Este e-mail já possui uma conta. Cada conta pode estar vinculada a uma única igreja.';
  END IF;

  INSERT INTO public.igrejas (nome)
  VALUES (v_nome)
  RETURNING id INTO v_igreja_id;

  INSERT INTO public.igreja_signup_tokens (
    token,
    igreja_id,
    expires_at,
    invited_email
  )
  VALUES (v_token, v_igreja_id, v_expira_em, v_email);

  RETURN QUERY SELECT v_igreja_id, v_nome, v_email, v_token, v_expira_em;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_igreja_id uuid;
  v_role text := 'membro';
  v_signup_token text;
BEGIN
  v_signup_token := NEW.raw_user_meta_data ->> 'church_signup_token';

  IF v_signup_token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    UPDATE public.igreja_signup_tokens AS token
    SET consumed_at = now()
    WHERE token.token = v_signup_token::uuid
      AND token.consumed_at IS NULL
      AND token.expires_at > now()
      AND (
        token.invited_email IS NULL
        OR lower(token.invited_email) = lower(NEW.email)
      )
    RETURNING token.igreja_id INTO v_igreja_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Convite inválido, expirado ou destinado a outro e-mail.';
    END IF;

    v_role := 'admin';
  END IF;

  INSERT INTO public.usuarios (id, igreja_id, nome, email, role)
  VALUES (
    NEW.id,
    v_igreja_id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'nome',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      'Novo Usuário'
    ),
    NEW.email,
    v_role
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.platform_list_churches() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_list_churches() TO authenticated;
REVOKE ALL ON FUNCTION public.platform_create_church_admin_invite(text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_create_church_admin_invite(text, text)
  TO authenticated;
