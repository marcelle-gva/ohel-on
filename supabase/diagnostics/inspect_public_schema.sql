-- Read-only database inventory. Run each query separately in the Supabase SQL Editor.

-- 1. Columns and types for all public tables.
SELECT
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 2. Primary keys, unique constraints, and foreign keys, including referenced columns.
SELECT
  source_table.relname AS table_name,
  constraint_info.conname AS constraint_name,
  CASE constraint_info.contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'f' THEN 'FOREIGN KEY'
  END AS constraint_type,
  source_column.attname AS column_name,
  referenced_table.relname AS referenced_table,
  referenced_column.attname AS referenced_column
FROM pg_constraint AS constraint_info
JOIN pg_class AS source_table
  ON source_table.oid = constraint_info.conrelid
JOIN pg_namespace AS source_schema
  ON source_schema.oid = source_table.relnamespace
CROSS JOIN LATERAL unnest(constraint_info.conkey) WITH ORDINALITY AS source_key(attnum, position)
JOIN pg_attribute AS source_column
  ON source_column.attrelid = source_table.oid
  AND source_column.attnum = source_key.attnum
LEFT JOIN pg_class AS referenced_table
  ON referenced_table.oid = constraint_info.confrelid
LEFT JOIN LATERAL unnest(constraint_info.confkey) WITH ORDINALITY AS referenced_key(attnum, position)
  ON referenced_key.position = source_key.position
LEFT JOIN pg_attribute AS referenced_column
  ON referenced_column.attrelid = constraint_info.confrelid
  AND referenced_column.attnum = referenced_key.attnum
WHERE source_schema.nspname = 'public'
  AND constraint_info.contype IN ('p', 'u', 'f')
ORDER BY source_table.relname, constraint_info.conname, source_key.position;

-- 3. RLS status and policies for all public tables.
SELECT
  tables.tablename,
  tables.rowsecurity AS rls_enabled,
  tables.forcerowsecurity AS rls_forced,
  policies.policyname,
  policies.permissive,
  policies.roles,
  policies.cmd,
  policies.qual AS using_expression,
  policies.with_check AS check_expression
FROM (
  SELECT
    cls.relname AS tablename,
    cls.relrowsecurity AS rowsecurity,
    cls.relforcerowsecurity AS forcerowsecurity
  FROM pg_class AS cls
  JOIN pg_namespace AS ns ON ns.oid = cls.relnamespace
  WHERE ns.nspname = 'public'
    AND cls.relkind IN ('r', 'p')
) AS tables
LEFT JOIN pg_policies AS policies
  ON policies.schemaname = 'public'
  AND policies.tablename = tables.tablename
ORDER BY tables.tablename, policies.policyname;
