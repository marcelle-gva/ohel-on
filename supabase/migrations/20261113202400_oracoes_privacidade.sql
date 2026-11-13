-- Privacidade dos pedidos atuais e dos snapshots, sem modificar dados existentes.
BEGIN;

CREATE OR REPLACE FUNCTION public.pode_consultar_oracao_restrita(p_igreja_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT public.has_church_module_permission(p_igreja_id, 'oracoes', ARRAY['ler','editar','aprovar','excluir'])
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      JOIN public.grupos g ON g.id = u.grupo_id AND g.igreja_id = u.igreja_id
      WHERE u.id = auth.uid() AND u.igreja_id = p_igreja_id
        AND lower(trim(g.nome)) IN ('liderança','lideranca')
    );
$$;
REVOKE ALL ON FUNCTION public.pode_consultar_oracao_restrita(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_consultar_oracao_restrita(uuid) TO authenticated, service_role;

-- Soma-se às policies existentes: não abre igreja nem concede edição/aprovação.
DROP POLICY IF EXISTS ohel_oracao_visibilidade_guard ON public.pedidos_oracao;
CREATE POLICY ohel_oracao_visibilidade_guard ON public.pedidos_oracao AS RESTRICTIVE
FOR SELECT TO authenticated USING (
  (visibilidade = 'Público' AND status = 'Em Oração')
  OR public.pode_consultar_oracao_restrita(igreja_id)
  OR (visibilidade = 'Público' AND status = 'Pendente'
      AND public.has_church_module_permission(igreja_id, 'monitor-midia', ARRAY['ler']))
);

-- O QR Code continua recebendo pedidos, mas nunca permite aprovação forjada.
DROP POLICY IF EXISTS ohel_oracao_public_status_guard ON public.pedidos_oracao;
CREATE POLICY ohel_oracao_public_status_guard ON public.pedidos_oracao AS RESTRICTIVE
FOR INSERT TO anon WITH CHECK (status = 'Pendente' AND visibilidade = 'Público');

-- Snapshots históricos sobrevivem à exclusão, mas os privados ficam restritos.
DROP POLICY IF EXISTS ohel_culto_oracao_privada_guard ON public.culto_registros;
CREATE POLICY ohel_culto_oracao_privada_guard ON public.culto_registros AS RESTRICTIVE
FOR SELECT TO authenticated USING (
  (
    (origem_tabela IS DISTINCT FROM 'pedidos_oracao'
     AND NOT jsonb_path_exists(coalesce(payload, '{}'::jsonb), '$.** ? (@.visibilidade == "Privado")'))
    OR (origem_tabela = 'pedidos_oracao' AND payload->>'visibilidade' = 'Público')
    OR public.pode_consultar_oracao_restrita(igreja_id)
  )
);
COMMIT;
