\set ON_ERROR_STOP on
-- Fixture exclusivamente local/descartável; não contém credenciais nem DSN externo.
create extension if not exists pgcrypto;
create schema if not exists storage;
create table public.igrejas(id uuid primary key, nome text not null);
create table public.usuarios(id uuid primary key, igreja_id uuid, role text not null);
create table public.membros(id uuid primary key, igreja_id uuid not null, nome text not null, status text not null, auth_user_id uuid);
create table storage.buckets(id text primary key, name text not null, public boolean not null default false);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null);
insert into public.igrejas values ('10000000-0000-4000-8000-000000000001', 'Igreja Fictícia');
insert into public.usuarios values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'membro'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'membro');
insert into public.membros values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Ana', 'Ativo', '30000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Bia', 'Ativo', '30000000-0000-4000-8000-000000000002');
\ir ../supabase/migrations/20261113172600_culto_no_lar.sql
\ir ../supabase/migrations/20261113172600_culto_no_lar.sql

create function pg_temp.assert_ok(ok boolean, message text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Falhou: %', message; end if;
end $$;
create function pg_temp.expect_error(statement text)
returns void language plpgsql as $$
begin
  begin execute statement; exception when others then return; end;
  raise exception 'Comando deveria ter sido bloqueado: %', statement;
end $$;

select pg_temp.assert_ok((select public = false from storage.buckets where id = 'culto-lar-fotos'), 'bucket privado');
select pg_temp.assert_ok((select relrowsecurity from pg_class where oid = 'public.culto_lar_posts'::regclass), 'RLS no post');
select pg_temp.assert_ok((select relrowsecurity from pg_class where oid = 'public.culto_lar_decisoes'::regclass), 'RLS no histórico');
select pg_temp.assert_ok(has_table_privilege('service_role', 'public.culto_lar_posts', 'select'), 'service_role lê post');
select pg_temp.assert_ok(not has_table_privilege('authenticated', 'public.culto_lar_posts', 'select'), 'authenticated não lê post direto');
select pg_temp.assert_ok(not has_table_privilege('anon', 'public.culto_lar_decisoes', 'select'), 'anon não lê histórico');
select pg_temp.assert_ok((select count(*) = 2 from pg_policies where schemaname = 'storage' and policyname like 'ohel_culto_lar_storage_deny_%'), 'policies restritivas no bucket');

insert into public.culto_lar_posts (
  id, igreja_id, membro_id, autor_usuario_id, casa_nome, data_culto,
  titulo, referencia, palavra, foto_path, foto_mime
) values (
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'Casa Esperança', '2026-11-13', 'Palavra', 'João 3:16',
  'Texto fictício', '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/a.webp', 'image/webp'
);

select * from public.culto_lar_moderar_post(
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  'Aprovado', null, 1
);
select pg_temp.assert_ok((select status = 'Aprovado' and versao = 2 from public.culto_lar_posts where id = '40000000-0000-4000-8000-000000000001'), 'aprovação CAS');
select pg_temp.assert_ok((select status_anterior = 'Pendente' and status_novo = 'Aprovado' and versao_anterior = 1 from public.culto_lar_decisoes where post_id = '40000000-0000-4000-8000-000000000001'), 'histórico privado anterior');
select pg_temp.expect_error($$select public.culto_lar_moderar_post('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','Rejeitado','revisar',1)$$);
select pg_temp.assert_ok((select count(*) = 1 from public.culto_lar_decisoes where post_id = '40000000-0000-4000-8000-000000000001'), 'conflito não adiciona decisão');
\echo CULTO_LAR_MIGRATION_LOCAL_OK
