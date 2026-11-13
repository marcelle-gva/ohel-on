DROP POLICY IF EXISTS "Permitir insercao publica de louvores" ON public.louvores;
REVOKE INSERT ON TABLE public.louvores FROM anon;
