-- Apenas fixtures descartáveis: nunca executar no Supabase de produção.
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
CREATE TABLE public.igrejas(id uuid PRIMARY KEY);
CREATE TABLE public.grupos(id uuid PRIMARY KEY, igreja_id uuid, nome text);
CREATE TABLE public.usuarios(id uuid PRIMARY KEY, igreja_id uuid, grupo_id uuid, role text);
CREATE TABLE public.grupos_permissoes(grupo_id uuid, modulo text, acao text);
CREATE TABLE public.pedidos_oracao(id uuid PRIMARY KEY, igreja_id uuid, status text DEFAULT 'Pendente', visibilidade text DEFAULT 'Público', descricao text);
CREATE TABLE public.culto_registros(id uuid PRIMARY KEY, igreja_id uuid, origem_tabela text, payload jsonb);
CREATE FUNCTION public.has_church_module_permission(p_igreja_id uuid,p_modulo text,p_acoes text[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT EXISTS(SELECT 1 FROM public.usuarios u LEFT JOIN public.grupos_permissoes gp ON gp.grupo_id=u.grupo_id WHERE u.id=auth.uid() AND u.igreja_id=p_igreja_id AND (u.role='admin' OR (gp.modulo=p_modulo AND gp.acao=ANY(p_acoes)))) $$;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,anon;
ALTER TABLE pedidos_oracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE culto_registros ENABLE ROW LEVEL SECURITY;
CREATE POLICY church_read ON pedidos_oracao FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM usuarios u WHERE u.id=auth.uid() AND u.igreja_id=pedidos_oracao.igreja_id));
CREATE POLICY church_read ON culto_registros FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM usuarios u WHERE u.id=auth.uid() AND u.igreja_id=culto_registros.igreja_id));
CREATE POLICY public_insert ON pedidos_oracao FOR INSERT TO anon WITH CHECK (EXISTS(SELECT 1 FROM igrejas i WHERE i.id=igreja_id));
CREATE POLICY admin_delete ON pedidos_oracao FOR DELETE TO authenticated USING (EXISTS(SELECT 1 FROM usuarios u WHERE u.id=auth.uid() AND u.igreja_id=pedidos_oracao.igreja_id AND u.role='admin'));
INSERT INTO igrejas VALUES ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
INSERT INTO grupos VALUES ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Liderança'),('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Monitor');
INSERT INTO grupos_permissoes VALUES ('20000000-0000-0000-0000-000000000002','monitor-midia','ler');
INSERT INTO usuarios VALUES
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',NULL,'admin'),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',NULL,'membro'),
 ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','membro'),
 ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','monitor');
INSERT INTO pedidos_oracao VALUES
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Em Oração','Público','Publicada fictícia'),
 ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Pendente','Público','Pendente fictícia'),
 ('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Em Oração','Privado','Privada fictícia'),
 ('40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','Em Oração','Público','Outra igreja fictícia');
INSERT INTO culto_registros SELECT id,igreja_id,'pedidos_oracao',jsonb_build_object('visibilidade',visibilidade) FROM pedidos_oracao;
INSERT INTO culto_registros VALUES ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',NULL,'{"registros":[{"tipo":"oracao","payload":{"visibilidade":"Privado"}}]}'::jsonb);
\ir ../supabase/migrations/20261113202400_oracoes_privacidade.sql
\ir ../supabase/migrations/20261113202400_oracoes_privacidade.sql
CREATE FUNCTION pg_temp.assert_ok(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT coalesce(ok,false) THEN RAISE EXCEPTION '%',message; END IF; END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000002',false);
SELECT pg_temp.assert_ok((SELECT count(*) FROM pedidos_oracao)=1,'membro vê só pública aprovada da igreja');
SELECT pg_temp.assert_ok((SELECT count(*) FROM culto_registros)=2,'membro não lê snapshot privado nem outra igreja');
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000004',false);
SELECT pg_temp.assert_ok((SELECT count(*) FROM pedidos_oracao)=2,'Monitor preserva pendentes públicas mas não privadas');
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',false);
SELECT pg_temp.assert_ok((SELECT count(*) FROM pedidos_oracao)=3,'Liderança preserva gestão própria igreja');
SELECT pg_temp.assert_ok((SELECT count(*) FROM culto_registros)=4,'Liderança vê histórico privado próprio');
SELECT set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',false);
DELETE FROM pedidos_oracao WHERE id='40000000-0000-0000-0000-000000000003' RETURNING id;
SELECT pg_temp.assert_ok((SELECT count(*) FROM culto_registros)=4,'exclusão física preserva snapshot');
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
 BEGIN
  INSERT INTO pedidos_oracao VALUES ('40000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','Em Oração','Público','Tentativa fictícia');
  RAISE EXCEPTION 'aprovação anônima passou indevidamente';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
INSERT INTO pedidos_oracao(id,igreja_id,descricao) VALUES ('40000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','QR fictício');
RESET ROLE;
SELECT pg_temp.assert_ok((SELECT count(*) FROM pedidos_oracao WHERE status='Pendente')=2,'QR mantém pedido pendente');
SELECT pg_temp.assert_ok(NOT has_function_privilege('anon','public.pode_consultar_oracao_restrita(uuid)','EXECUTE'),'helper não exposto ao público');
SELECT 'ORAÇÕES SQL: OK — privacidade, tenant, exclusão, snapshot e reaplicação' AS resultado;
