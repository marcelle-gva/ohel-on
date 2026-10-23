CREATE TABLE IF NOT EXISTS public.igreja_signup_tokens (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  consumed_at timestamptz
);

ALTER TABLE public.igreja_signup_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.igreja_signup_tokens FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.iniciar_cadastro_igreja(p_nome text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_igreja_id uuid;
  v_token uuid := gen_random_uuid();
BEGIN
  IF p_nome IS NULL OR length(btrim(p_nome)) = 0 THEN
    RAISE EXCEPTION 'O nome da igreja é obrigatório.';
  END IF;

  INSERT INTO public.igrejas (nome)
  VALUES (btrim(p_nome))
  RETURNING id INTO v_igreja_id;

  INSERT INTO public.igreja_signup_tokens (token, igreja_id)
  VALUES (v_token, v_igreja_id);

  RETURN v_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_church_admin(p_igreja_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios AS u
    WHERE u.id = auth.uid()
      AND u.igreja_id = p_igreja_id
      AND u.role = 'admin'
  );
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
    UPDATE public.igreja_signup_tokens AS t
    SET consumed_at = now()
    WHERE t.token = v_signup_token::uuid
      AND t.consumed_at IS NULL
      AND t.expires_at > now()
    RETURNING t.igreja_id INTO v_igreja_id;

    IF FOUND THEN
      v_role := 'admin';
    END IF;
  END IF;

  INSERT INTO public.usuarios (id, igreja_id, nome, email, role)
  VALUES (
    NEW.id,
    v_igreja_id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome',
             NEW.raw_user_meta_data ->> 'full_name',
             NEW.raw_user_meta_data ->> 'name',
             'Novo Usuário'),
    NEW.email,
    v_role
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_approved_member()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_confirmed_at timestamptz;
  v_igreja_ids uuid[];
  v_igreja_id uuid;
  v_existing_igreja_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT u.igreja_id INTO v_existing_igreja_id
  FROM public.usuarios AS u
  WHERE u.id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'O perfil do usuário ainda não foi criado.';
  END IF;

  IF v_existing_igreja_id IS NOT NULL THEN
    RETURN true;
  END IF;

  SELECT au.email, au.email_confirmed_at
  INTO v_email, v_confirmed_at
  FROM auth.users AS au
  WHERE au.id = v_user_id;

  IF v_email IS NULL OR v_confirmed_at IS NULL THEN
    RETURN false;
  END IF;

  SELECT array_agg(DISTINCT m.igreja_id)
  INTO v_igreja_ids
  FROM public.membros AS m
  WHERE lower(m.email) = lower(v_email)
    AND m.status = 'Ativo'
    AND m.igreja_id IS NOT NULL;

  IF COALESCE(cardinality(v_igreja_ids), 0) <> 1 THEN
    RETURN false;
  END IF;

  v_igreja_id := v_igreja_ids[1];

  UPDATE public.usuarios
  SET igreja_id = v_igreja_id
  WHERE id = v_user_id
    AND (igreja_id IS NULL OR igreja_id = v_igreja_id)
  RETURNING igreja_id INTO v_existing_igreja_id;

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aprovar_pre_cadastro(p_membro_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_membro public.membros%ROWTYPE;
  v_user public.usuarios%ROWTYPE;
BEGIN
  SELECT m.* INTO v_membro
  FROM public.membros AS m
  WHERE m.id = p_membro_id
  FOR UPDATE;

  IF NOT FOUND OR v_membro.status <> 'Pré-Cadastro' THEN
    RAISE EXCEPTION 'Pré-cadastro não encontrado ou já processado.';
  END IF;

  IF NOT public.is_church_admin(v_membro.igreja_id) THEN
    RAISE EXCEPTION 'Somente um administrador da igreja pode aprovar pré-cadastros.';
  END IF;

  IF v_membro.email IS NOT NULL AND btrim(v_membro.email) <> '' THEN
    SELECT u.* INTO v_user
    FROM public.usuarios AS u
    JOIN auth.users AS au ON au.id = u.id
    WHERE lower(u.email) = lower(v_membro.email)
      AND au.email_confirmed_at IS NOT NULL
    FOR UPDATE OF u;

    IF FOUND THEN
      IF v_user.igreja_id IS NOT NULL
         AND v_user.igreja_id <> v_membro.igreja_id THEN
        RAISE EXCEPTION 'A conta Google já está vinculada a outra igreja.';
      END IF;

      UPDATE public.usuarios
      SET igreja_id = v_membro.igreja_id
      WHERE id = v_user.id;
    END IF;
  END IF;

  UPDATE public.membros
  SET status = 'Ativo'
  WHERE id = v_membro.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rejeitar_pre_cadastro(p_membro_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_membro public.membros%ROWTYPE;
BEGIN
  SELECT m.* INTO v_membro
  FROM public.membros AS m
  WHERE m.id = p_membro_id
  FOR UPDATE;

  IF NOT FOUND OR v_membro.status <> 'Pré-Cadastro' THEN
    RAISE EXCEPTION 'Pré-cadastro não encontrado ou já processado.';
  END IF;

  IF NOT public.is_church_admin(v_membro.igreja_id) THEN
    RAISE EXCEPTION 'Somente um administrador da igreja pode rejeitar pré-cadastros.';
  END IF;

  DELETE FROM public.membros WHERE id = v_membro.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_member_status(
  p_membro_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_igreja_id uuid;
BEGIN
  IF p_status IS NULL
     OR p_status NOT IN ('Ativo', 'Inativo', 'Transferido', 'Disciplinado', 'Pré-Cadastro') THEN
    RAISE EXCEPTION 'Status de membro inválido.';
  END IF;

  SELECT igreja_id INTO v_igreja_id
  FROM public.membros
  WHERE id = p_membro_id
  FOR UPDATE;

  IF NOT FOUND OR NOT public.is_church_admin(v_igreja_id) THEN
    RAISE EXCEPTION 'Somente um administrador da igreja pode alterar este status.';
  END IF;

  UPDATE public.membros SET status = p_status WHERE id = p_membro_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_group(
  p_usuario_id uuid,
  p_grupo_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_igreja_id uuid;
BEGIN
  SELECT igreja_id INTO v_igreja_id
  FROM public.usuarios
  WHERE id = p_usuario_id;

  IF NOT FOUND OR v_igreja_id IS NULL
     OR NOT public.is_church_admin(v_igreja_id) THEN
    RAISE EXCEPTION 'Somente um administrador da igreja pode alterar grupos de usuários.';
  END IF;

  IF p_grupo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.grupos
    WHERE id = p_grupo_id AND igreja_id = v_igreja_id
  ) THEN
    RAISE EXCEPTION 'O grupo não pertence à igreja do usuário.';
  END IF;

  UPDATE public.usuarios SET grupo_id = p_grupo_id WHERE id = p_usuario_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.iniciar_cadastro_igreja(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.iniciar_cadastro_igreja(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.is_church_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_church_admin(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.link_approved_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_approved_member() TO authenticated;
REVOKE ALL ON FUNCTION public.aprovar_pre_cadastro(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aprovar_pre_cadastro(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.rejeitar_pre_cadastro(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rejeitar_pre_cadastro(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_update_member_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_member_status(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_user_group(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_group(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Inserir igrejas" ON public.igrejas;
REVOKE INSERT ON public.igrejas FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Ver proprio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "Atualizar perfis da mesma igreja" ON public.usuarios;
DROP POLICY IF EXISTS "Inserir usuarios" ON public.usuarios;
CREATE POLICY "Ver perfil proprio e usuarios da igreja para admin"
ON public.usuarios FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_church_admin(igreja_id));
CREATE POLICY "Atualizar usuarios da propria igreja como admin"
ON public.usuarios FOR UPDATE TO authenticated
USING (public.is_church_admin(igreja_id))
WITH CHECK (public.is_church_admin(igreja_id));
REVOKE INSERT, UPDATE ON public.usuarios FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id, igreja_id, role), UPDATE (role, igreja_id, grupo_id)
ON public.usuarios FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Ver membros da propria igreja" ON public.membros;
CREATE POLICY "Ler membros da propria igreja"
ON public.membros FOR SELECT TO authenticated
USING (
  igreja_id = (SELECT u.igreja_id FROM public.usuarios AS u WHERE u.id = auth.uid())
);
CREATE POLICY "Inserir membros da propria igreja"
ON public.membros FOR INSERT TO authenticated
WITH CHECK (
  igreja_id = (SELECT u.igreja_id FROM public.usuarios AS u WHERE u.id = auth.uid())
  AND (status = 'Pré-Cadastro' OR public.is_church_admin(igreja_id))
);
CREATE POLICY "Atualizar membros da propria igreja"
ON public.membros FOR UPDATE TO authenticated
USING (
  igreja_id = (SELECT u.igreja_id FROM public.usuarios AS u WHERE u.id = auth.uid())
)
WITH CHECK (
  igreja_id = (SELECT u.igreja_id FROM public.usuarios AS u WHERE u.id = auth.uid())
);
CREATE POLICY "Excluir membros da propria igreja"
ON public.membros FOR DELETE TO authenticated
USING (
  igreja_id = (SELECT u.igreja_id FROM public.usuarios AS u WHERE u.id = auth.uid())
  AND (status <> 'Pré-Cadastro' OR public.is_church_admin(igreja_id))
);

DROP POLICY IF EXISTS "Permitir pre-cadastro publico" ON public.membros;
CREATE POLICY "Permitir pre-cadastro publico"
ON public.membros FOR INSERT TO anon
WITH CHECK (
  status = 'Pré-Cadastro'
  AND igreja_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.igrejas AS i WHERE i.id = igreja_id)
);

REVOKE UPDATE ON public.membros FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (id, igreja_id, status) ON public.membros FROM PUBLIC, anon, authenticated;
DO $grant_member_columns$
DECLARE
  v_columns text;
BEGIN
  SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum)
  INTO v_columns
  FROM pg_attribute AS a
  WHERE a.attrelid = 'public.membros'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.attgenerated = ''
    AND a.attidentity = ''
    AND a.attname NOT IN ('id', 'igreja_id', 'status');

  IF v_columns IS NOT NULL THEN
    EXECUTE format('GRANT UPDATE (%s) ON public.membros TO authenticated', v_columns);
  END IF;
END;
$grant_member_columns$;

DROP POLICY IF EXISTS "Permitir leitura publica de oracao" ON public.pedidos_oracao;
DROP POLICY IF EXISTS "Permitir envio publico de oracao" ON public.pedidos_oracao;
CREATE POLICY "Permitir envio publico de oracao"
ON public.pedidos_oracao FOR INSERT TO anon
WITH CHECK (
  igreja_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.igrejas AS i WHERE i.id = igreja_id)
);

CREATE OR REPLACE FUNCTION public.can_access_private_storage_object(
  p_bucket_id text,
  p_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios AS u
    WHERE u.id = auth.uid()
      AND u.igreja_id IS NOT NULL
      AND (
        split_part(p_name, '/', 1) = u.igreja_id::text
        OR (
          p_bucket_id = 'documentos'
          AND (
            EXISTS (
              SELECT 1 FROM public.transacoes AS t
              WHERE t.igreja_id = u.igreja_id
                AND split_part(t.comprovante_url, '/object/public/documentos/', 2) = p_name
            )
            OR EXISTS (
              SELECT 1 FROM public.patrimonio_bens AS b
              WHERE b.igreja_id = u.igreja_id
                AND split_part(b.nota_fiscal_url, '/object/public/documentos/', 2) = p_name
            )
            OR EXISTS (
              SELECT 1
              FROM public.reunioes AS r
              CROSS JOIN LATERAL jsonb_array_elements(
                CASE
                  WHEN jsonb_typeof(r.anexos::jsonb) = 'array' THEN r.anexos::jsonb
                  ELSE '[]'::jsonb
                END
              ) AS a
              WHERE r.igreja_id = u.igreja_id
                AND split_part(a.value ->> 'url', '/object/public/documentos/', 2) = p_name
            )
          )
        )
        OR (
          p_bucket_id = 'comprovantes'
          AND EXISTS (
            SELECT 1 FROM public.eventos_pedidos AS p
            WHERE p.igreja_id = u.igreja_id
              AND split_part(p.comprovante_url, '/object/public/comprovantes/', 2) = p_name
          )
        )
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.can_access_private_storage_object(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_private_storage_object(text, text) TO authenticated;

DROP POLICY IF EXISTS "Leitura docs publica" ON storage.objects;
DROP POLICY IF EXISTS "Leitura comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Upload docs" ON storage.objects;
DROP POLICY IF EXISTS "Update docs" ON storage.objects;
DROP POLICY IF EXISTS "Delete docs" ON storage.objects;
DROP POLICY IF EXISTS "Upload comprovantes" ON storage.objects;

UPDATE storage.buckets
SET public = false
WHERE id IN ('documentos', 'comprovantes');

CREATE POLICY "Acesso privado por igreja"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('documentos', 'comprovantes')
  AND public.can_access_private_storage_object(bucket_id, name)
);
CREATE POLICY "Upload privado na propria igreja"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('documentos', 'comprovantes')
  AND split_part(name, '/', 1) = (
    SELECT u.igreja_id::text FROM public.usuarios AS u WHERE u.id = auth.uid()
  )
);
CREATE POLICY "Atualizar arquivos privados da propria igreja"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('documentos', 'comprovantes')
  AND public.can_access_private_storage_object(bucket_id, name)
)
WITH CHECK (
  bucket_id IN ('documentos', 'comprovantes')
  AND split_part(name, '/', 1) = (
    SELECT u.igreja_id::text FROM public.usuarios AS u WHERE u.id = auth.uid()
  )
);
CREATE POLICY "Excluir arquivos privados da propria igreja"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('documentos', 'comprovantes')
  AND public.can_access_private_storage_object(bucket_id, name)
);
