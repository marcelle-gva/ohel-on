DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.key_column_usage k
    JOIN information_schema.constraint_column_usage c
      ON c.constraint_catalog = k.constraint_catalog
     AND c.constraint_schema = k.constraint_schema
     AND c.constraint_name = k.constraint_name
    WHERE k.constraint_schema = 'public'
      AND k.table_name = 'usuarios'
      AND k.constraint_name = 'usuarios_perfil_id_fkey'
      AND k.column_name = 'grupo_id'
      AND c.table_schema = 'public'
      AND c.table_name = 'grupos'
      AND c.column_name = 'id'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.key_column_usage k
      JOIN information_schema.constraint_column_usage c
        ON c.constraint_catalog = k.constraint_catalog
       AND c.constraint_schema = k.constraint_schema
       AND c.constraint_name = k.constraint_name
      WHERE k.constraint_schema = 'public'
        AND k.table_name = 'usuarios'
        AND k.constraint_name = 'usuarios_grupo_id_fkey'
        AND k.column_name = 'grupo_id'
        AND c.table_schema = 'public'
        AND c.table_name = 'grupos'
        AND c.column_name = 'id'
    ) THEN
      ALTER TABLE public.usuarios DROP CONSTRAINT usuarios_perfil_id_fkey;
    ELSE
      ALTER TABLE public.usuarios RENAME CONSTRAINT usuarios_perfil_id_fkey TO usuarios_grupo_id_fkey;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'usuarios'
      AND constraint_name = 'usuarios_perfil_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.key_column_usage k
    JOIN information_schema.constraint_column_usage c
      ON c.constraint_catalog = k.constraint_catalog
     AND c.constraint_schema = k.constraint_schema
     AND c.constraint_name = k.constraint_name
    WHERE k.constraint_schema = 'public'
      AND k.table_name = 'usuarios'
      AND k.constraint_name = 'usuarios_perfil_id_fkey'
      AND k.column_name = 'perfil_id'
      AND c.table_schema = 'public'
      AND c.table_name = 'perfis'
      AND c.column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'usuarios_perfil_id_fkey existe em outra coluna/relação inesperada; interrompendo sem substituir.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.key_column_usage k
    JOIN information_schema.constraint_column_usage c
      ON c.constraint_catalog = k.constraint_catalog
     AND c.constraint_schema = k.constraint_schema
     AND c.constraint_name = k.constraint_name
    WHERE k.constraint_schema = 'public'
      AND k.table_name = 'usuarios'
      AND k.constraint_name = 'usuarios_perfil_id_fkey'
      AND k.column_name = 'perfil_id'
      AND c.table_schema = 'public'
      AND c.table_name = 'perfis'
      AND c.column_name = 'id'
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_perfil_id_fkey
      FOREIGN KEY (perfil_id)
      REFERENCES public.perfis(id)
      ON DELETE SET NULL;
  END IF;

  CREATE INDEX IF NOT EXISTS usuarios_perfil_id_idx ON public.usuarios (perfil_id);
END
$$;
