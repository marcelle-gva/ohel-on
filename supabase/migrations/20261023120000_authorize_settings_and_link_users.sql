DO $migration$
DECLARE
  v_usuario_group_column smallint;
BEGIN
  SELECT attnum
  INTO v_usuario_group_column
  FROM pg_attribute
  WHERE attrelid = 'public.usuarios'::regclass
    AND attname = 'grupo_id'
    AND NOT attisdropped;

  IF v_usuario_group_column IS NULL THEN
    RAISE EXCEPTION 'A coluna public.usuarios.grupo_id não existe.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.usuarios AS usuario
    LEFT JOIN public.grupos AS grupo ON grupo.id = usuario.grupo_id
    WHERE usuario.grupo_id IS NOT NULL
      AND grupo.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Existem usuários vinculados a grupos inexistentes. Corrija esses registros antes de aplicar esta migration.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS constraint_info
    WHERE constraint_info.conrelid = 'public.usuarios'::regclass
      AND constraint_info.confrelid = 'public.grupos'::regclass
      AND constraint_info.contype = 'f'
      AND constraint_info.conkey = ARRAY[v_usuario_group_column]::smallint[]
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_grupo_id_grupos_fkey
      FOREIGN KEY (grupo_id)
      REFERENCES public.grupos (id)
      ON DELETE SET NULL;
  END IF;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.has_church_module_permission(
  p_igreja_id uuid,
  p_modulo text,
  p_acoes text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT public.is_church_admin(p_igreja_id)
    OR EXISTS (
      SELECT 1
      FROM public.usuarios AS usuario
      JOIN public.grupos_permissoes AS permissao
        ON permissao.grupo_id = usuario.grupo_id
      WHERE usuario.id = auth.uid()
        AND usuario.igreja_id = p_igreja_id
        AND permissao.modulo = p_modulo
        AND permissao.acao = ANY(p_acoes)
    );
$function$;

REVOKE ALL ON FUNCTION public.has_church_module_permission(uuid, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_church_module_permission(uuid, text, text[]) TO authenticated;

DO $policies$
DECLARE
  v_table text;
  v_legacy_policy text;
  v_module text;
BEGIN
  FOR v_table, v_legacy_policy, v_module IN
    SELECT *
    FROM (VALUES
      ('cargos', 'Ver cargos da propria igreja', 'configuracoes'),
      ('departamentos', 'Ver departamentos da propria igreja', 'configuracoes'),
      ('categorias_financeiras', 'Acesso categorias', 'configuracoes'),
      ('formas_pagamento', 'Acesso formas', 'configuracoes'),
      ('config_checkin', 'Acesso config_checkin', 'configuracoes'),
      ('caixas', 'Acesso caixas', 'financeiro'),
      ('fornecedores', 'Acesso fornecedores', 'financeiro')
    ) AS policy_targets(table_name, legacy_policy, module)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_legacy_policy, v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ohel_select_same_church', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ohel_insert_permission', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ohel_update_permission', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'ohel_delete_permission', v_table);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (igreja_id = (SELECT usuario.igreja_id FROM public.usuarios AS usuario WHERE usuario.id = auth.uid()))',
      'ohel_select_same_church',
      v_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_church_module_permission(igreja_id, %L, ARRAY[''criar'']::text[]))',
      'ohel_insert_permission',
      v_table,
      v_module
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_church_module_permission(igreja_id, %L, ARRAY[''editar'']::text[])) WITH CHECK (public.has_church_module_permission(igreja_id, %L, ARRAY[''editar'']::text[]))',
      'ohel_update_permission',
      v_table,
      v_module,
      v_module
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_church_module_permission(igreja_id, %L, ARRAY[''excluir'']::text[]))',
      'ohel_delete_permission',
      v_table,
      v_module
    );
  END LOOP;
END;
$policies$;

DROP POLICY IF EXISTS "Ver grupos da propria igreja" ON public.grupos;
DROP POLICY IF EXISTS "Ver perfis da propria igreja" ON public.grupos;
DROP POLICY IF EXISTS "Ler grupos da propria igreja" ON public.grupos;
DROP POLICY IF EXISTS "Administradores gerenciam grupos" ON public.grupos;
CREATE POLICY "Ler grupos da propria igreja"
ON public.grupos FOR SELECT TO authenticated
USING (
  igreja_id = (
    SELECT usuario.igreja_id
    FROM public.usuarios AS usuario
    WHERE usuario.id = auth.uid()
  )
);
CREATE POLICY "Administradores gerenciam grupos"
ON public.grupos FOR ALL TO authenticated
USING (public.is_church_admin(igreja_id))
WITH CHECK (public.is_church_admin(igreja_id));

DROP POLICY IF EXISTS "Ver permissoes da propria igreja" ON public.grupos_permissoes;
DROP POLICY IF EXISTS "Ler permissoes dos grupos da propria igreja" ON public.grupos_permissoes;
DROP POLICY IF EXISTS "Administradores gerenciam permissoes dos grupos" ON public.grupos_permissoes;
CREATE POLICY "Ler permissoes dos grupos da propria igreja"
ON public.grupos_permissoes FOR SELECT TO authenticated
USING (
  grupo_id IN (
    SELECT grupo.id
    FROM public.grupos AS grupo
    WHERE grupo.igreja_id = (
      SELECT usuario.igreja_id
      FROM public.usuarios AS usuario
      WHERE usuario.id = auth.uid()
    )
  )
);
CREATE POLICY "Administradores gerenciam permissoes dos grupos"
ON public.grupos_permissoes FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.grupos AS grupo
    WHERE grupo.id = grupo_id
      AND public.is_church_admin(grupo.igreja_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.grupos AS grupo
    WHERE grupo.id = grupo_id
      AND public.is_church_admin(grupo.igreja_id)
  )
);

DROP POLICY IF EXISTS "Administradores e configuradores atualizam dados da igreja" ON public.igrejas;
CREATE POLICY "Administradores e configuradores atualizam dados da igreja"
ON public.igrejas FOR UPDATE TO authenticated
USING (
  id = (
    SELECT usuario.igreja_id
    FROM public.usuarios AS usuario
    WHERE usuario.id = auth.uid()
  )
  AND public.has_church_module_permission(id, 'configuracoes', ARRAY['editar'])
)
WITH CHECK (
  id = (
    SELECT usuario.igreja_id
    FROM public.usuarios AS usuario
    WHERE usuario.id = auth.uid()
  )
  AND public.has_church_module_permission(id, 'configuracoes', ARRAY['editar'])
);
