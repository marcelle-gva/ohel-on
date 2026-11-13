\set ON_ERROR_STOP on
-- Exclusivamente no banco LOCAL descartável criado pelo harness .sh.
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create table public.usuarios(id uuid primary key, igreja_id uuid, role text);
create table public.membros(id uuid primary key, igreja_id uuid, nome text, status text);
create table public.sorteios(id uuid primary key, igreja_id uuid, nome text, numero_inicial integer, numero_final integer, valor_bilhete numeric, status text);
create table public.sorteio_participantes(
 id uuid primary key default gen_random_uuid(), sorteio_id uuid references sorteios(id), igreja_id uuid,
 nome text, telefone text, numero integer, valor numeric, status text, observacoes text,
 unique(sorteio_id,numero)
);
create table public.cestas_basicas(id uuid primary key default gen_random_uuid(), igreja_id uuid not null, nome text not null, descricao text, status text not null default 'aberta', created_at timestamptz default now());
create table public.cesta_itens(id uuid primary key default gen_random_uuid(), igreja_id uuid not null, cesta_id uuid references cestas_basicas(id), nome text not null, unidade text not null default 'unidade', quantidade_necessaria integer not null check(quantidade_necessaria>0));
create table public.cesta_doacoes(id uuid primary key default gen_random_uuid(), igreja_id uuid not null, item_id uuid references cesta_itens(id) on delete cascade, quantidade integer not null, status text not null);

-- Legado antes de aplicar as colunas: não deve ser rateado ou alterado silenciosamente.
insert into cestas_basicas(id,igreja_id,nome) values ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Legada');
insert into cesta_itens(id,igreja_id,cesta_id,nome,quantidade_necessaria) values ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Arroz',7);
\ir ../supabase/migrations/20261113164700_sorteios_vendedores_imagem.sql
\ir ../supabase/migrations/20261113164800_cestas_campanhas_quantidades.sql
-- Reaplicação comprova idempotência de DDL e grants.
\ir ../supabase/migrations/20261113164700_sorteios_vendedores_imagem.sql
\ir ../supabase/migrations/20261113164800_cestas_campanhas_quantidades.sql

create function pg_temp.assert_ok(ok boolean, message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'Falhou: %', message; end if; end $$;
create function pg_temp.expect_error(statement text) returns void language plpgsql as $$ begin begin execute statement; exception when others then return; end; raise exception 'Comando deveria ter sido bloqueado: %',statement; end $$;
select pg_temp.assert_ok((select quantidade_cestas=1 from cestas_basicas where nome='Legada'),'campanha antiga default 1');
select pg_temp.assert_ok((select quantidade_por_cesta is null and quantidade_necessaria=7 from cesta_itens where nome='Arroz'),'meta e reservas legadas preservadas');
select pg_temp.expect_error($$select editar_quantidade_cestas('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2)$$);
select pg_temp.expect_error($$select editar_item_cesta('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Arroz','pacote',7)$$);
select editar_item_cesta('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Arroz','pacote',7);
select editar_quantidade_cestas('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2);
select pg_temp.assert_ok((select quantidade_necessaria=14 from cesta_itens where nome='Arroz'),'meta por cesta multiplicada');
insert into cesta_doacoes(igreja_id,item_id,quantidade,status) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222',10,'reservado');
select pg_temp.expect_error($$select editar_item_cesta('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Arroz','pacote',4)$$);
select pg_temp.expect_error($$select editar_quantidade_cestas('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1)$$);
select pg_temp.assert_ok((select quantidade_cestas=2 from cestas_basicas where nome='Legada'),'recálculo rejeitado preserva campanha');
select pg_temp.assert_ok((select quantidade_necessaria=14 from cesta_itens where nome='Arroz'),'recálculo rejeitado preserva meta');
select pg_temp.expect_error($$select excluir_item_cesta('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$);
update cesta_doacoes set status='cancelado';
select pg_temp.expect_error($$select excluir_item_cesta('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$);
select criar_item_cesta('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Feijão','kg',3);
select pg_temp.assert_ok((select quantidade_necessaria=6 from cesta_itens where nome='Feijão'),'criação usa quantidade atual da campanha');
select excluir_item_cesta((select id from cesta_itens where nome='Feijão'),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select pg_temp.assert_ok(not exists(select 1 from cesta_itens where nome='Feijão'),'exclusão sem histórico permitida');
select pg_temp.assert_ok(not has_function_privilege('authenticated','editar_item_cesta(uuid,uuid,text,text,integer)','EXECUTE'),'RPC edição não pública');
select pg_temp.assert_ok(not has_function_privilege('anon','excluir_item_cesta(uuid,uuid)','EXECUTE'),'RPC exclusão não pública');

insert into usuarios values ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin');
insert into membros values ('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Vendedor A','Ativo'),('55555555-5555-4555-8555-555555555555','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Vendedor B','Ativo');
insert into sorteios values ('66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Prêmio',1,100,10,'ativo');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select set_config('request.jwt.claim.role','authenticated',false);
select registrar_numero_manual_sorteio('66666666-6666-4666-8666-666666666666',5,'44444444-4444-4444-8444-444444444444','Comprador fictício','11999999999',null);
select pg_temp.assert_ok((select origem='manual' and status='reservado' and pagamento_manual_status='nao_informado' from sorteio_participantes where numero=5),'número manual sem confirmar financeiro');
select pg_temp.expect_error($$select registrar_numero_manual_sorteio('66666666-6666-4666-8666-666666666666',5,'44444444-4444-4444-8444-444444444444','Outro comprador','11999999999',null)$$);
select pg_temp.expect_error($$select registrar_numero_manual_sorteio('66666666-6666-4666-8666-666666666666',101,'44444444-4444-4444-8444-444444444444','Comprador','11999999999',null)$$);
select pg_temp.expect_error($$select registrar_numero_manual_sorteio('66666666-6666-4666-8666-666666666666',6,'55555555-5555-4555-8555-555555555555','Comprador','11999999999',null)$$);
select pg_temp.expect_error($$update sorteio_participantes set vendedor_membro_id='55555555-5555-4555-8555-555555555555' where numero=5$$);
select set_config('request.jwt.claim.sub','',false);
select set_config('request.jwt.claim.role','anon',false);
select pg_temp.expect_error($$select registrar_numero_manual_sorteio('66666666-6666-4666-8666-666666666666',7,'44444444-4444-4444-8444-444444444444','Comprador','11999999999',null)$$);
-- Reserva pública antiga mantém defaults online e não quebra sob o novo trigger.
insert into sorteio_participantes(sorteio_id,igreja_id,nome,telefone,numero,valor,status) values ('66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Online fictício','11999999999',8,10,'reservado');
select pg_temp.expect_error($$update sorteio_participantes set origem='manual' where numero=8$$);
select pg_temp.assert_ok((select count(*)=2 from sorteio_participantes),'duplicatas e manipulação não inseriram dados');
select pg_temp.assert_ok(not has_function_privilege('anon','registrar_numero_manual_sorteio(uuid,integer,uuid,text,text,text)','EXECUTE'),'RPC manual indisponível a anônimo');
\echo MIGRACOES_LOCAIS_OK
