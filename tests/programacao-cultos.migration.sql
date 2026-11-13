\set ON_ERROR_STOP on
-- Apenas no banco local descartável criado pelo harness, sem DSN externo.
-- Reproduz grants explícitos que o Supabase aplica ao criar novos objetos.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key);
create table public.igrejas(id uuid primary key);
create table public.usuarios(id uuid primary key, igreja_id uuid, role text);
create table public.culto_modelos(id uuid primary key default gen_random_uuid(), igreja_id uuid not null references igrejas(id), nome text not null, tipo text not null, dia_semana smallint, horario_inicio time, horario_fim time, ativo boolean default true, created_at timestamptz default now(), vigencia_desde timestamptz default now());
create table public.culto_sessoes(id uuid primary key default gen_random_uuid(), igreja_id uuid not null references igrejas(id), modelo_id uuid references culto_modelos(id), titulo text not null, tipo text not null, inicio_em timestamptz not null default now(), fim_em timestamptz, status text not null, link_ao_vivo text, dirigente text, observacoes text, created_by uuid, created_at timestamptz default now());
create unique index uq_culto_sessoes_modelo_ocorrencia on culto_sessoes(igreja_id,modelo_id,inicio_em) where modelo_id is not null;
insert into igrejas values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');
insert into usuarios values ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin'),('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','membro'),('33333333-3333-4333-8333-333333333333','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','admin');
\ir ../supabase/migrations/20261112131500_cultos_editaveis_deduplicacao.sql
\ir ../supabase/migrations/20261112132900_cultos_sem_sobreposicao_e_sync_resiliente.sql
\ir ../supabase/migrations/20261113172500_programacao_cultos_edicao_anual.sql
\ir ../supabase/migrations/20261113172500_programacao_cultos_edicao_anual.sql
\ir ../supabase/migrations/20261113174300_programacao_cultos_privilegios.sql
\ir ../supabase/migrations/20261113174300_programacao_cultos_privilegios.sql
create function pg_temp.assert_ok(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Falhou: %',msg; end if; end$$;
create function pg_temp.expect_error(statement text) returns void language plpgsql as $$begin begin execute statement; exception when others then return; end; raise exception 'Deveria bloquear: %',statement; end$$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
-- Ocorrências antigas e em andamento materializadas com os dados originais.
insert into culto_modelos(id,igreja_id,nome,tipo,dia_semana,horario_inicio,horario_fim,vigencia_desde) values ('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Título antigo','Culto de Domingo',extract(dow from now() at time zone 'America/Sao_Paulo')::smallint,'00:00','23:59:59',now()-interval '15 days');
select materializar_sessoes_culto('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
create temp table sessoes_antes as select * from culto_sessoes;
select pg_temp.assert_ok((select count(*)>=2 from sessoes_antes),'histórico real materializado na fixture');
select pg_temp.assert_ok((select count(*)=1 from sessoes_antes where status='aberto'),'sessão em andamento na fixture');
select editar_programacao_culto('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Título novo','Culto de Domingo',((extract(dow from now() at time zone 'America/Sao_Paulo')::int+1)%7)::smallint,'19:00','21:00');
select materializar_sessoes_culto('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select pg_temp.assert_ok(not exists((select * from sessoes_antes except select * from culto_sessoes) union all (select * from culto_sessoes except select * from sessoes_antes)),'edição preserva todas as sessões, inclusive em andamento');
select pg_temp.assert_ok((select nome='Título novo' and vigencia_desde>=now()-interval '1 minute' from culto_modelos where id='44444444-4444-4444-8444-444444444444'),'modelo editado só vale daqui para frente');
select pg_temp.expect_error($$select criar_programacao_culto('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Conflito','Culto de Domingo',((extract(dow from now() at time zone 'America/Sao_Paulo')::int+1)%7)::smallint,'20:00','22:00')$$);
select pg_temp.expect_error($$select criar_programacao_culto('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Inválido','Culto de Domingo',1::smallint,'21:00','19:00')$$);
select pg_temp.expect_error($$select criar_programacao_culto('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Inválido','Tipo inexistente',1::smallint,'17:00','18:00')$$);
select pg_temp.expect_error($$select editar_programacao_culto('44444444-4444-4444-8444-444444444444','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Cruzar','Culto de Domingo',1::smallint,'17:00','18:00')$$);
select alternar_programacao_culto('44444444-4444-4444-8444-444444444444',false);
select pg_temp.assert_ok((select ativo=false from culto_modelos where id='44444444-4444-4444-8444-444444444444'),'pausa modelo sem excluir');
select pg_temp.assert_ok((select count(*) from culto_sessoes)=(select count(*) from sessoes_antes),'pausa não remove histórico');
select alternar_programacao_culto('44444444-4444-4444-8444-444444444444',true);
select criar_programacao_culto_anual('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2027-04-15','Encontro anual','Culto de Domingo','19:00','21:00','Observação fictícia');
select pg_temp.assert_ok((select ano=2027 and ativo from programacoes_cultos_anuais limit 1),'agenda grava ano da data');
select pg_temp.assert_ok((select count(*) from culto_sessoes)=(select count(*) from sessoes_antes),'agenda anual não cria sessão');
select pg_temp.expect_error($$select criar_programacao_culto_anual('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2027-04-15','Duplicado','Culto de Domingo','20:00','22:00',null)$$);
select editar_programacao_culto_anual((select id from programacoes_cultos_anuais limit 1),'2028-06-10','Encontro editado','Culto de Domingo','18:00','20:00','Nova observação');
select pg_temp.assert_ok((select ano=2028 and titulo='Encontro editado' and data_culto='2028-06-10' from programacoes_cultos_anuais limit 1),'edição anual atualiza também ano');
select editar_tipo_culto((select id from culto_tipos where igreja_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and nome='Culto de Domingo' limit 1),'Culto da Família',true);
select pg_temp.assert_ok((select tipo='Culto da Família' from programacoes_cultos_anuais limit 1),'renome do tipo não quebra nova agenda');
select pg_temp.assert_ok((select tipo='Culto da Família' from culto_modelos where id='44444444-4444-4444-8444-444444444444'),'renome tipo mantém programação fixa');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select pg_temp.expect_error($$select criar_programacao_culto_anual('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2027-04-16','Negado','Culto da Família','19:00','21:00',null)$$);
select pg_temp.expect_error($$select editar_programacao_culto('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Negado','Culto da Família',2::smallint,'19:00','21:00')$$);
-- RLS anual: mesmo que o cliente consulte diretamente, nunca lê outra igreja.
grant usage on schema public,auth to authenticated;
grant select on public.usuarios to authenticated;
set role authenticated;
select pg_temp.assert_ok((select count(*)=1 from programacoes_cultos_anuais),'membro lê agenda da própria igreja');
reset role;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
set role authenticated;
select pg_temp.assert_ok((select count(*)=0 from programacoes_cultos_anuais),'admin de outra igreja não lê agenda alheia');
reset role;
select pg_temp.assert_ok(not has_table_privilege('authenticated','programacoes_cultos_anuais','INSERT'),'sem insert direto que contorne RPC');
select pg_temp.assert_ok(not has_table_privilege('authenticated','programacoes_cultos_anuais','UPDATE'),'sem update direto que contorne RPC');
select pg_temp.assert_ok(not has_table_privilege('authenticated','programacoes_cultos_anuais','TRUNCATE'),'sem truncate que contorne RLS');
select pg_temp.assert_ok(not has_function_privilege('anon','editar_programacao_culto(uuid,uuid,text,text,smallint,time,time)','EXECUTE'),'anônimo não chama edição');
select pg_temp.assert_ok(not has_table_privilege('anon','programacoes_cultos_anuais','SELECT'),'anônimo sem select mesmo com grants padrão');
select pg_temp.assert_ok(not has_function_privilege('authenticated','exigir_admin_igreja(uuid)','EXECUTE'),'helper interno não exposto ao cliente');
select pg_temp.assert_ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('criar_programacao_culto','editar_programacao_culto','alternar_programacao_culto','criar_programacao_culto_anual','editar_programacao_culto_anual','alternar_programacao_culto_anual') and has_function_privilege('anon',p.oid,'EXECUTE')),'nenhuma RPC nova com grant anônimo');
select pg_temp.assert_ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('criar_programacao_culto','editar_programacao_culto','alternar_programacao_culto','criar_programacao_culto_anual','editar_programacao_culto_anual','alternar_programacao_culto_anual') and not has_function_privilege('authenticated',p.oid,'EXECUTE')),'RPCs permanecem disponíveis ao cliente autenticado e validam admin');
\echo PROGRAMACAO_CULTOS_MIGRATION_LOCAL_OK
