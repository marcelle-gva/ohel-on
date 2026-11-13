BEGIN;

-- O Supabase pode conceder privilégios diretamente a anon/authenticated por
-- ALTER DEFAULT PRIVILEGES. Revogar apenas PUBLIC não remove esses grants.
-- As RPCs continuam validando admin e igreja no servidor; este reforço limita
-- também a exposição direta, sem alterar registros, funções ou outras tabelas.
REVOKE ALL ON public.programacoes_cultos_anuais FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.programacoes_cultos_anuais TO authenticated;
REVOKE ALL ON FUNCTION public.exigir_admin_igreja(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.criar_programacao_culto(uuid, text, text, smallint, time, time) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.editar_programacao_culto(uuid, uuid, text, text, smallint, time, time) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.alternar_programacao_culto(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.criar_programacao_culto_anual(uuid, date, text, text, time, time, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.editar_programacao_culto_anual(uuid, date, text, text, time, time, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.alternar_programacao_culto_anual(uuid, boolean) FROM PUBLIC, anon;

COMMIT;
