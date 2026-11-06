-- OHEL ON — Área do Membro / Monitor: vínculo, provisionamento e RLS defensivo
-- Execute uma única vez no SQL Editor do projeto Supabase correto.
-- Não executar em outro banco: este script assume PostgreSQL/Supabase com os papéis
-- postgres, authenticated e as funções auth.uid(). Não executa alterações de frontend.
--
-- Princípios:
--   * somente membros Ativo recebem baseline usuarios role=membro, sem grupo/perfil;
--   * nenhum cargo/departamento vira privilégio;
--   * ON CONFLICT DO NOTHING preserva admins, tenants e grupos existentes;
--   * policies novas são RESTRICTIVE: as policies legadas continuam existindo, mas não
--     conseguem abrir tabelas de tenant para um membro restrito;
--   * dados do Monitor não são liberados diretamente para membros: o frontend deve usar
--     /api/membros/monitor com service-role whitelisted no servidor.

begin;

-- -----------------------------------------------------------------------------
-- 0) Pré-condições explícitas e campos legados usados pelo código atual
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.membros') is null then
    raise exception 'Pré-condição ausente: public.membros não existe.' using errcode = '42P01';
  end if;
  if to_regclass('public.usuarios') is null then
    raise exception 'Pré-condição ausente: public.usuarios não existe.' using errcode = '42P01';
  end if;
  if to_regclass('public.grupos') is null then
    raise exception 'Pré-condição ausente: public.grupos não existe.' using errcode = '42P01';
  end if;
  if to_regclass('public.grupos_permissoes') is null then
    raise exception 'Pré-condição ausente: public.grupos_permissoes não existe.' using errcode = '42P01';
  end if;
end
$$;

alter table public.membros
  add column if not exists auth_user_id uuid,
  add column if not exists cargo text,
  add column if not exists departamento text;

-- Esta migration também é segura quando o script de acesso de membros anterior
-- ainda não foi executado: cria o tipo/vínculo somente se o campo faltava.
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any (c.conkey)
    where c.conrelid = 'public.membros'::regclass
      and c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and a.attname = 'auth_user_id'
  ) then
    alter table public.membros
      add constraint ohel_membros_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users(id)
      on delete set null;
  end if;
end
$$;

-- perfis é legado/opcional, mas usuarios.perfil_id é usado pelo código atual.
-- O campo precisa aceitar NULL para o baseline de membro sem perfil.
alter table public.usuarios
  add column if not exists perfil_id uuid;
alter table public.usuarios
  alter column perfil_id drop not null;

-- A unicidade parcial torna auth_user_id um vínculo 1:1 sem impedir pré-cadastros
-- legados ainda não vinculados (NULL). Se os dados existentes tiverem duplicatas,
-- a transação aborta intencionalmente para não escolher uma conta silenciosamente.
create unique index if not exists ohel_membros_auth_user_id_uq
  on public.membros (auth_user_id)
  where auth_user_id is not null;

create index if not exists ohel_membros_ativo_auth_igreja_idx
  on public.membros (igreja_id, status, auth_user_id);

-- -----------------------------------------------------------------------------
-- 1) Helpers SECURITY DEFINER: leitura centralizada sem recursão de RLS
-- -----------------------------------------------------------------------------
-- O SQL Editor do Supabase deve executar este bloco como postgres. Os helpers não
-- são expostos a anon/public; somente authenticated precisa avaliá-los em policies.

create schema if not exists helpers;
alter schema helpers owner to postgres;
revoke all on schema helpers from public, anon;
grant usage on schema helpers to authenticated;

create or replace function helpers.is_restricted_member()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, helpers
as $$
  select
    exists (
      select 1
      from public.usuarios u
      where u.id = (select auth.uid())
        and lower(coalesce(u.role::text, '')) = 'membro'
    )
    or exists (
      select 1
      from public.membros m
      where m.auth_user_id = (select auth.uid())
        and not exists (
          select 1
          from public.usuarios u
          where u.id = (select auth.uid())
            and lower(coalesce(u.role::text, '')) = 'admin'
        )
    );
$$;

create or replace function helpers.is_admin_for_tenant(p_igreja_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, helpers
as $$
  select p_igreja_id is not null and exists (
    select 1
    from public.usuarios u
    where u.id = (select auth.uid())
      and lower(coalesce(u.role::text, '')) = 'admin'
      and u.igreja_id = p_igreja_id
  );
$$;

create or replace function helpers.current_user_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, auth, helpers
as $$
  select u.igreja_id
  from public.usuarios u
  where u.id = (select auth.uid())
  limit 1;
$$;

create or replace function helpers.member_owns_membro(p_membro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, helpers
as $$
  select p_membro_id is not null and exists (
    select 1
    from public.membros m
    where m.id = p_membro_id
      and m.auth_user_id = (select auth.uid())
      and m.status = 'Ativo'
      and m.igreja_id = (
        select u.igreja_id
        from public.usuarios u
        where u.id = (select auth.uid())
      )
  );
$$;

create or replace function helpers.member_owns_group(
  p_grupo_id uuid,
  p_igreja_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, helpers
as $$
  select p_grupo_id is not null and exists (
    select 1
    from public.usuarios u
    join public.membros m
      on m.auth_user_id = u.id
     and m.status = 'Ativo'
     and m.igreja_id = u.igreja_id
    join public.grupos g
      on g.id = u.grupo_id
     and g.igreja_id = u.igreja_id
    where u.id = (select auth.uid())
      and lower(coalesce(u.role::text, '')) <> 'admin'
      and g.id = p_grupo_id
      and (p_igreja_id is null or g.igreja_id = p_igreja_id)
  );
$$;

create or replace function helpers.is_admin_for_group(p_grupo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, helpers
as $$
  select p_grupo_id is not null and exists (
    select 1
    from public.grupos g
    where g.id = p_grupo_id
      and helpers.is_admin_for_tenant(g.igreja_id)
  );
$$;

create or replace function helpers.is_admin_for_perfil(p_perfil_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, helpers
as $$
declare
  v_result boolean := false;
begin
  -- perfis é legado/opcional; não faça a criação dos helpers depender dele.
  if p_perfil_id is null or to_regclass('public.perfis') is null then
    return false;
  end if;

  execute '
    select exists (
      select 1
      from public.perfis p
      where p.id = $1
        and helpers.is_admin_for_tenant(p.igreja_id)
    )'
    into v_result
    using p_perfil_id;

  return coalesce(v_result, false);
end;
$$;

-- Mapa fechado: tabela não listada retorna NULL e, para um membro restrito,
-- será negada. Algumas tabelas são compartilhadas por duas telas; nesses casos
-- os dois módulos explícitos evitam negar uma dependência legítima por um mapa
-- incorreto (por exemplo, departamentos em Financeiro e Configurações).
create or replace function helpers.member_table_modules(p_table text)
returns text[]
language sql
immutable
strict
as $$
  select case p_table
    when 'membros' then array['membros']
    when 'congregacoes' then array['congregacoes']
    when 'congregados' then array['congregados']
    when 'visitantes' then array['visitantes']
    when 'visitas' then array['visitas']
    when 'eventos' then array['eventos']
    when 'eventos_regulares' then array['escalas', 'eventos']
    when 'eventos_pedidos' then array['eventos']
    when 'eventos_produtos' then array['eventos']
    when 'eventos_produtos_variacoes' then array['eventos']
    when 'produtos_variacoes' then array['eventos']
    when 'inscricoes_eventos' then array['eventos']
    when 'eventos_inscricoes' then array['eventos']
    when 'reunioes' then array['reunioes']
    when 'escalas' then array['escalas']
    when 'escalados' then array['escalas']
    when 'funcoes_escala' then array['escalas']
    when 'grupos_trabalho' then array['escalas']
    when 'pedidos_oracao' then array['oracoes']
    when 'louvores' then array['monitor-midia']
    when 'checkins' then array['monitor-midia', 'cestas']
    when 'culto_modelos' then array['monitor-midia']
    when 'culto_sessoes' then array['monitor-midia']
    when 'culto_registros' then array['monitor-midia']
    when 'sermoes' then array['gabinete']
    when 'comunicacoes' then array['mural']
    when 'mural' then array['mural']
    when 'categorias_financeiras' then array['financeiro']
    when 'formas_pagamento' then array['financeiro']
    when 'caixas' then array['financeiro']
    when 'contas_pagar' then array['financeiro']
    when 'transacoes' then array['financeiro']
    when 'meses_fechados' then array['financeiro']
    when 'produtos' then array['financeiro']
    when 'fornecedores' then array['financeiro']
    when 'departamentos' then array['financeiro', 'configuracoes']
    when 'modelos_cartas' then array['cartas']
    when 'modelos_certificados' then array['certificados']
    when 'modelos_credenciais' then array['credenciais']
    when 'termos_aceites' then array['credenciais']
    when 'cestas_basicas' then array['cestas']
    when 'cesta_itens' then array['cestas']
    when 'cesta_doacoes' then array['cestas']
    when 'cestas_responsaveis' then array['cestas']
    when 'kids_teens_pre_cadastros' then array['kids-teens']
    when 'patrimonio_bens' then array['patrimonio']
    when 'patrimonio_movimentacoes' then array['patrimonio']
    when 'atendimentos_pastorais' then array['gabinete']
    when 'acompanhamento_emocional' then array['gabinete']
    when 'whatsapp_comunicacoes' then array['gabinete']
    when 'whatsapp_destinatarios' then array['gabinete']
    when 'ebd_classes' then array['ensino']
    when 'ebd_matriculas' then array['ensino']
    when 'ebd_presencas' then array['ensino']
    when 'sorteios' then array['sorteios', 'eventos']
    when 'sorteio_participantes' then array['sorteios', 'eventos']
    when 'config_checkin' then array['configuracoes']
    when 'cargos' then array['configuracoes']
    when 'billing_subscriptions' then array['configuracoes']
    else null::text[]
  end;
$$;

create or replace function helpers.member_module_for_table(p_table text)
returns text
language sql
immutable
strict
as $$
  select (helpers.member_table_modules(p_table))[1];
$$;

create or replace function helpers.member_table_is_monitor_data(p_table text)
returns boolean
language sql
immutable
strict
as $$
  select p_table = any (array[
    -- controles administrativos/PII: não são um módulo de trabalho do membro.
    'admin_convites', 'perfis', 'perfis_permissoes',
    'grupos', 'grupos_permissoes', 'usuarios', 'igrejas',
    'billing_subscriptions', 'billing_webhook_events'
  ]::text[]);
$$;

create or replace function helpers.member_has_permission(
  p_igreja_id uuid,
  p_modulo text,
  p_acoes text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, helpers
as $$
  select p_igreja_id is not null
    and p_modulo is not null
    and coalesce(array_length(p_acoes, 1), 0) > 0
    and exists (
      select 1
      from public.membros m
      join public.usuarios u
        on u.id = (select auth.uid())
       and u.igreja_id = m.igreja_id
      join public.grupos g
        on g.id = u.grupo_id
       and g.igreja_id = m.igreja_id
      join public.grupos_permissoes gp
        on gp.grupo_id = g.id
      where m.auth_user_id = (select auth.uid())
        and m.status = 'Ativo'
        and lower(coalesce(u.role::text, '')) <> 'admin'
        and m.igreja_id = p_igreja_id
        and gp.modulo = p_modulo
        and gp.acao = any (p_acoes)
    );
$$;

create or replace function helpers.member_can_access_table(
  p_table text,
  p_igreja_id uuid,
  p_acoes text[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, helpers
as $$
declare
  v_modulos text[];
  v_lideranca boolean := false;
  v_pode_decidir boolean := false;
begin
  -- Chamadas por policy não devem restringir administradores/contas existentes.
  if not helpers.is_restricted_member() then
    return true;
  end if;

  if p_igreja_id is null
     or p_table is null
     or helpers.member_table_is_monitor_data(p_table) then
    return false;
  end if;

  -- Mantém a regra da API de decisões de oração: permissão de editar/aprovar
  -- sozinha não autoriza um grupo diferente do grupo padrão Liderança.
  if p_table = 'pedidos_oracao' then
    select exists (
      select 1 from public.usuarios u
      join public.grupos g on g.id = u.grupo_id and g.igreja_id = u.igreja_id
      where u.id = (select auth.uid()) and u.igreja_id = p_igreja_id
        and lower(btrim(g.nome)) in ('liderança', 'lideranca')
    ) into v_lideranca;
    v_pode_decidir := v_lideranca and (
      helpers.member_has_permission(p_igreja_id, 'oracoes', ARRAY['aprovar', 'editar'])
      or helpers.member_has_permission(p_igreja_id, 'monitor-oracoes', ARRAY['aprovar', 'editar'])
    );
    if p_acoes && ARRAY['editar', 'aprovar', 'movimentar']::text[] then
      return v_pode_decidir;
    end if;
    if array_position(p_acoes, 'ler') is not null and v_pode_decidir then
      return true;
    end if;
  end if;

  v_modulos := helpers.member_table_modules(p_table);
  if v_modulos is null or coalesce(array_length(v_modulos, 1), 0) = 0 then
    return false;
  end if;

  -- O Monitor, orações, escalas e mural são dados normais de módulo: cada
  -- acesso continua exigindo gp.modulo/acao no mesmo tenant. Somente a lista
  -- fechada de controles acima tem deny absoluto.
  return exists (
    select 1
    from unnest(v_modulos) as modulo
    where helpers.member_has_permission(p_igreja_id, modulo, p_acoes)
  );
end;
$$;

-- Resolve somente relações filhas conhecidas. Relações sem mapa retornam false
-- para membros restritos; não existe fallback de "mesma igreja" por JSON.
create or replace function helpers.member_can_access_child(
  p_table text,
  p_row jsonb,
  p_acoes text[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, helpers
as $$
declare
  v_tenant uuid;
  v_parent uuid;
begin
  if not helpers.is_restricted_member() then
    return true;
  end if;

  if p_table is null or p_row is null then
    return false;
  end if;

  -- A própria lista de permissões do grupo pode ser lida somente para o grupo
  -- atualmente atribuído; escrita continua exclusiva de admin.
  if p_table = 'grupos_permissoes' then
    v_parent := nullif(p_row ->> 'grupo_id', '')::uuid;
    return array_position(p_acoes, 'ler') is not null
       and helpers.member_owns_group(v_parent);
  end if;

  -- Perfis/permissões são controles administrativos, nunca dados do membro.
  if p_table = 'perfis_permissoes' then
    return false;
  end if;

  if p_table = 'eventos_produtos'
     and to_regclass('public.eventos') is not null then
    v_parent := nullif(p_row ->> 'evento_id', '')::uuid;
    execute 'select e.igreja_id from public.eventos e where e.id = $1'
      into v_tenant using v_parent;
    return helpers.member_can_access_table(p_table, v_tenant, p_acoes);
  end if;

  if p_table in ('eventos_produtos_variacoes', 'produtos_variacoes')
     and to_regclass('public.eventos_produtos') is not null
     and to_regclass('public.eventos') is not null then
    v_parent := nullif(p_row ->> 'produto_id', '')::uuid;
    execute '
      select e.igreja_id
      from public.eventos_produtos ep
      join public.eventos e on e.id = ep.evento_id
      where ep.id = $1'
      into v_tenant using v_parent;
    return helpers.member_can_access_table(p_table, v_tenant, p_acoes);
  end if;

  if p_table in ('eventos_pedidos', 'inscricoes_eventos', 'eventos_inscricoes')
     and to_regclass('public.eventos') is not null then
    v_parent := nullif(p_row ->> 'evento_id', '')::uuid;
    execute 'select e.igreja_id from public.eventos e where e.id = $1'
      into v_tenant using v_parent;
    return helpers.member_can_access_table(p_table, v_tenant, p_acoes);
  end if;

  if p_table = 'escalados'
     and to_regclass('public.escalas') is not null then
    v_parent := nullif(p_row ->> 'escala_id', '')::uuid;
    execute 'select e.igreja_id from public.escalas e where e.id = $1'
      into v_tenant using v_parent;
    return helpers.member_can_access_table(p_table, v_tenant, p_acoes);
  end if;

  if p_table = 'ebd_matriculas'
     and to_regclass('public.ebd_classes') is not null then
    v_parent := nullif(coalesce(p_row ->> 'classe_id', p_row ->> 'class_id'), '')::uuid;
    execute 'select e.igreja_id from public.ebd_classes e where e.id = $1'
      into v_tenant using v_parent;
    return helpers.member_can_access_table(p_table, v_tenant, p_acoes);
  end if;

  if p_table = 'ebd_presencas'
     and to_regclass('public.ebd_matriculas') is not null
     and to_regclass('public.ebd_classes') is not null then
    v_parent := nullif(p_row ->> 'matricula_id', '')::uuid;
    execute '
      select c.igreja_id
      from public.ebd_matriculas em
      join public.ebd_classes c on c.id = nullif(
        coalesce(to_jsonb(em) ->> ''classe_id'', to_jsonb(em) ->> ''class_id''),
        ''''
      )::uuid
      where em.id = $1'
      into v_tenant using v_parent;
    return helpers.member_can_access_table(p_table, v_tenant, p_acoes);
  end if;

  if p_table = 'patrimonio_movimentacoes'
     and to_regclass('public.patrimonio_bens') is not null then
    v_parent := nullif(p_row ->> 'bem_id', '')::uuid;
    execute 'select p.igreja_id from public.patrimonio_bens p where p.id = $1'
      into v_tenant using v_parent;
    return helpers.member_can_access_table(p_table, v_tenant, p_acoes);
  end if;

  if p_table = 'whatsapp_destinatarios'
     and to_regclass('public.whatsapp_comunicacoes') is not null then
    v_parent := nullif(p_row ->> 'comunicacao_id', '')::uuid;
    execute 'select w.igreja_id from public.whatsapp_comunicacoes w where w.id = $1'
      into v_tenant using v_parent;
    return helpers.member_can_access_table(p_table, v_tenant, p_acoes);
  end if;

  -- Falha fechada para qualquer filho não mapeado.
  return false;
end;
$$;

-- Helpers só ficam disponíveis para a role que avalia as policies.
revoke all on function helpers.is_restricted_member() from public, anon;
revoke all on function helpers.is_admin_for_tenant(uuid) from public, anon;
revoke all on function helpers.current_user_tenant_id() from public, anon;
revoke all on function helpers.member_owns_membro(uuid) from public, anon;
revoke all on function helpers.member_owns_group(uuid, uuid) from public, anon;
revoke all on function helpers.is_admin_for_group(uuid) from public, anon;
revoke all on function helpers.is_admin_for_perfil(uuid) from public, anon;
revoke all on function helpers.member_table_modules(text) from public, anon;
revoke all on function helpers.member_module_for_table(text) from public, anon;
revoke all on function helpers.member_table_is_monitor_data(text) from public, anon;
revoke all on function helpers.member_has_permission(uuid, text, text[]) from public, anon;
revoke all on function helpers.member_can_access_table(text, uuid, text[]) from public, anon;
revoke all on function helpers.member_can_access_child(text, jsonb, text[]) from public, anon;

grant execute on function helpers.is_restricted_member() to authenticated;
grant execute on function helpers.is_admin_for_tenant(uuid) to authenticated;
grant execute on function helpers.current_user_tenant_id() to authenticated;
grant execute on function helpers.member_owns_membro(uuid) to authenticated;
grant execute on function helpers.member_owns_group(uuid, uuid) to authenticated;
grant execute on function helpers.is_admin_for_group(uuid) to authenticated;
grant execute on function helpers.is_admin_for_perfil(uuid) to authenticated;
grant execute on function helpers.member_table_modules(text) to authenticated;
grant execute on function helpers.member_module_for_table(text) to authenticated;
grant execute on function helpers.member_table_is_monitor_data(text) to authenticated;
grant execute on function helpers.member_has_permission(uuid, text, text[]) to authenticated;
grant execute on function helpers.member_can_access_table(text, uuid, text[]) to authenticated;
grant execute on function helpers.member_can_access_child(text, jsonb, text[]) to authenticated;

-- O owner dos helpers é explicitamente postgres no SQL Editor do Supabase.
alter function helpers.is_restricted_member() owner to postgres;
alter function helpers.is_admin_for_tenant(uuid) owner to postgres;
alter function helpers.current_user_tenant_id() owner to postgres;
alter function helpers.member_owns_membro(uuid) owner to postgres;
alter function helpers.member_owns_group(uuid, uuid) owner to postgres;
alter function helpers.is_admin_for_group(uuid) owner to postgres;
alter function helpers.is_admin_for_perfil(uuid) owner to postgres;
alter function helpers.member_table_modules(text) owner to postgres;
alter function helpers.member_module_for_table(text) owner to postgres;
alter function helpers.member_table_is_monitor_data(text) owner to postgres;
alter function helpers.member_has_permission(uuid, text, text[]) owner to postgres;
alter function helpers.member_can_access_table(text, uuid, text[]) owner to postgres;
alter function helpers.member_can_access_child(text, jsonb, text[]) owner to postgres;

-- -----------------------------------------------------------------------------
-- 2) Trigger AFTER: aprovação provisiona somente baseline, nunca reescreve ACL
-- -----------------------------------------------------------------------------

-- Um membro com gp.membros pode criar/editar dados administrativos opcionais,
-- mas nunca pode vincular outra conta, mover tenant ou aprovar/desativar alguém.
-- auth.uid() nulo identifica chamadas server-side/service-role e deixa a API
-- autorizada executar a operação; o trigger não confia em cargo/departamento.
create or replace function public.ohel_guard_membro_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, auth, helpers
as $$
declare
  v_tenant_id uuid := helpers.current_user_tenant_id();
begin
  -- SQL Editor/postgres e service_role são atores server-side. Só a role RLS
  -- authenticated deve sofrer o bloqueio de campos protegidos.
  if current_user <> 'authenticated' or (select auth.uid()) is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if helpers.is_admin_for_tenant(coalesce(old.igreja_id, new.igreja_id)) then
      return new;
    end if;

    if old.auth_user_id is distinct from new.auth_user_id
       or old.igreja_id is distinct from new.igreja_id
       or old.status is distinct from new.status then
      raise exception 'Membro autenticado não pode alterar vínculo Auth, igreja ou status.'
        using errcode = '42501';
    end if;

    if new.igreja_id is distinct from v_tenant_id then
      raise exception 'Membro autenticado só pode editar membros da própria igreja.'
        using errcode = '42501';
    end if;
  elsif tg_op = 'INSERT' then
    if helpers.is_admin_for_tenant(new.igreja_id) then
      return new;
    end if;
    if new.igreja_id is distinct from v_tenant_id
       or new.auth_user_id is not null then
      raise exception 'Membro autenticado só pode criar registro sem vínculo Auth na própria igreja.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.ohel_guard_membro_mutation() from public, anon, authenticated;
alter function public.ohel_guard_membro_mutation() owner to postgres;

drop trigger if exists ohel_guard_membro_mutation on public.membros;
create trigger ohel_guard_membro_mutation
before insert or update of auth_user_id, igreja_id, status on public.membros
for each row execute function public.ohel_guard_membro_mutation();

create or replace function public.ohel_provision_membro_usuario()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, helpers
as $$
declare
  v_usuario_igreja_id uuid;
  v_usuario_role text;
begin
  if new.status is distinct from 'Ativo' or new.auth_user_id is null then
    return new;
  end if;

  if new.igreja_id is null then
    raise exception 'Membro Ativo precisa de igreja_id para vincular a conta.'
      using errcode = '23514';
  end if;

  -- Trava a linha existente antes de decidir. Uma linha sem tenant é o
  -- placeholder criado por um trigger de Auth; ela recebe o baseline. Uma
  -- linha já tenantizada (inclusive admin real) nunca é sobrescrita.
  select u.igreja_id, u.role::text
    into v_usuario_igreja_id, v_usuario_role
  from public.usuarios u
  where u.id = new.auth_user_id
  for update;

  if found and v_usuario_igreja_id is null then
    update public.usuarios u
    set igreja_id = new.igreja_id,
        nome = coalesce(nullif(u.nome, ''), new.nome, ''),
        email = coalesce(nullif(u.email, ''), new.email, ''),
        role = 'membro',
        grupo_id = null,
        perfil_id = null
    where u.id = new.auth_user_id;
  elsif found and v_usuario_igreja_id is distinct from new.igreja_id then
    raise exception 'Conta Auth já está vinculada a outra igreja; aprovação recusada para evitar mislink.'
      using errcode = '23514';
  end if;

  if not found then
    insert into public.usuarios (
      id, igreja_id, nome, email, role, grupo_id, perfil_id
    ) values (
      new.auth_user_id,
      new.igreja_id,
      coalesce(new.nome, ''),
      coalesce(new.email, ''),
      'membro',
      null,
      null
    )
    on conflict (id) do nothing;

    -- Reconfere a corrida: ON CONFLICT não pode esconder outro tenant. Se o
    -- concorrente deixou placeholder sem tenant, a mesma regra o normaliza.
    select u.igreja_id, u.role::text
      into v_usuario_igreja_id, v_usuario_role
    from public.usuarios u
    where u.id = new.auth_user_id
    for update;

    if v_usuario_igreja_id is null then
      update public.usuarios u
      set igreja_id = new.igreja_id,
          nome = coalesce(nullif(u.nome, ''), new.nome, ''),
          email = coalesce(nullif(u.email, ''), new.email, ''),
          role = 'membro',
          grupo_id = null,
          perfil_id = null
      where u.id = new.auth_user_id;
    elsif v_usuario_igreja_id is distinct from new.igreja_id then
      raise exception 'Conta Auth passou a existir em outra igreja; aprovação recusada para evitar mislink.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.ohel_provision_membro_usuario() from public, anon, authenticated;
alter function public.ohel_provision_membro_usuario() owner to postgres;

drop trigger if exists ohel_membros_provision_usuario on public.membros;
create trigger ohel_membros_provision_usuario
after insert or update of status, auth_user_id, igreja_id on public.membros
for each row execute function public.ohel_provision_membro_usuario();

-- A Área do Membro usa esta RPC somente quando as tabelas da cesta já existem.
-- O bloco dinâmico mantém a migration aplicável a instalações que ainda não
-- instalaram o módulo, sem criar uma dependência de schema opcional.
do $ohel_cestas_rpc$
begin
  if to_regclass('public.cestas_basicas') is not null
     and to_regclass('public.cesta_itens') is not null
     and to_regclass('public.cesta_doacoes') is not null then
    execute $rpc$
      create or replace function public.reservar_item_cesta(
        p_item_id uuid,
        p_quantidade integer default 1
      )
      returns jsonb
      language plpgsql
      security definer
      set search_path = public, extensions, pg_temp
      as $fn$
      declare
        v_uid uuid := auth.uid();
        v_email text;
        v_membro record;
        v_item record;
        v_reservado integer;
        v_membros_email integer;
        v_doacao_id uuid;
      begin
        if v_uid is null then
          raise exception 'Acesso de membro necessário' using errcode = '42501';
        end if;

        select au.email
          into v_email
        from auth.users au
        where au.id = v_uid
          and au.email_confirmed_at is not null;
        if not found then
          raise exception 'Confirme seu e-mail para reservar uma cesta' using errcode = '42501';
        end if;

        if p_quantidade is null or p_quantidade < 1 or p_quantidade > 100 then
          raise exception 'Quantidade inválida' using errcode = '22023';
        end if;

        -- O vínculo explícito é a fonte principal e trava o membro durante a
        -- reserva; nunca escolhe outra pessoa só por cargo ou metadata Auth.
        select m.id, m.igreja_id, m.nome, m.telefone, m.whatsapp_opt_in
          into v_membro
        from public.membros m
        where m.auth_user_id = v_uid
          and m.status = 'Ativo'
        for update;

        if not found then
          -- Compatibilidade legada somente se o e-mail confirmado identifica
          -- uma conta Auth e exatamente um membro Ativo ainda não vinculado.
          select count(*)
            into v_membros_email
          from public.membros m
          where m.auth_user_id is null
            and m.status = 'Ativo'
            and lower(btrim(coalesce(m.email, ''))) = lower(btrim(v_email));

          if v_membros_email <> 1
             or (select count(*)
                 from auth.users au2
                 where au2.email_confirmed_at is not null
                   and lower(btrim(coalesce(au2.email, ''))) = lower(btrim(v_email))) <> 1 then
            raise exception 'Cadastro de membro ambíguo ou não encontrado' using errcode = '42501';
          end if;

          select m.id, m.igreja_id, m.nome, m.telefone, m.whatsapp_opt_in
            into v_membro
          from public.membros m
          where m.auth_user_id is null
            and m.status = 'Ativo'
            and lower(btrim(coalesce(m.email, ''))) = lower(btrim(v_email))
          for update;
        end if;

        if v_membro.id is null then
          raise exception 'Membro ativo não encontrado' using errcode = '42501';
        end if;

        -- O lock do item serializa a soma e a inserção de todas as reservas
        -- deste item, inclusive quando duas contas tentam reservar juntas.
        select i.id, i.cesta_id, i.igreja_id, i.nome, i.unidade,
               i.quantidade_necessaria, c.nome as cesta_nome
          into v_item
        from public.cesta_itens i
        join public.cestas_basicas c
          on c.id = i.cesta_id
         and c.igreja_id = i.igreja_id
        where i.id = p_item_id
          and i.igreja_id = v_membro.igreja_id
          and c.status = 'aberta'
        for update of i;
        if v_item.id is null then
          raise exception 'Item não disponível' using errcode = 'P0001';
        end if;

        select coalesce(sum(d.quantidade), 0)::integer
          into v_reservado
        from public.cesta_doacoes d
        where d.item_id = v_item.id
          and d.status in ('reservado', 'entregue');
        if v_reservado + p_quantidade > v_item.quantidade_necessaria then
          raise exception 'Este item já foi reservado por outros membros' using errcode = 'P0001';
        end if;

        insert into public.cesta_doacoes (
          igreja_id, cesta_id, item_id, membro_id, nome_doador, quantidade
        ) values (
          v_membro.igreja_id, v_item.cesta_id, v_item.id, v_membro.id,
          v_membro.nome, p_quantidade
        )
        returning id into v_doacao_id;

        return jsonb_build_object(
          'id', v_doacao_id,
          'igreja_id', v_membro.igreja_id,
          'membro_id', v_membro.id,
          'nome_doador', v_membro.nome,
          'telefone', v_membro.telefone,
          'whatsapp_opt_in', coalesce(v_membro.whatsapp_opt_in, false),
          'item_nome', v_item.nome,
          'unidade', v_item.unidade,
          'quantidade', p_quantidade,
          'cesta_nome', v_item.cesta_nome
        );
      end;
      $fn$;
    $rpc$;

    execute 'revoke all on function public.reservar_item_cesta(uuid, integer) from public, anon';
    execute 'grant execute on function public.reservar_item_cesta(uuid, integer) to authenticated';
    execute 'alter function public.reservar_item_cesta(uuid, integer) owner to postgres';
  end if;
end
$ohel_cestas_rpc$;

-- -----------------------------------------------------------------------------
-- 3) Backfill seguro: somente Ativo, Auth válido e tenant sem conflito
-- -----------------------------------------------------------------------------
-- Primeiro vincula, no máximo uma vez, legado sem auth_user_id por e-mail
-- confirmado. Não vincula e-mail ambíguo (mais de um Ativo ainda sem vínculo),
-- já usado por outro membro ou em conta usuarios de outro tenant.

with candidatos as (
  select distinct m.id as membro_id, au.id as auth_user_id
  from public.membros m
  join auth.users au
    on lower(btrim(au.email)) = lower(btrim(m.email))
   and au.email_confirmed_at is not null
  where m.status = 'Ativo'
    and m.auth_user_id is null
    and nullif(btrim(coalesce(m.email, '')), '') is not null
    and (
      select count(*)
      from public.membros m2
      where m2.status = 'Ativo'
        and m2.auth_user_id is null
        and lower(btrim(coalesce(m2.email, ''))) = lower(btrim(m.email))
    ) = 1
    and not exists (
      select 1
      from auth.users au2
      where lower(btrim(au2.email)) = lower(btrim(m.email))
        and au2.email_confirmed_at is not null
        and au2.id <> au.id
    )
    and not exists (
      select 1
      from public.membros m2
      where m2.auth_user_id = au.id
    )
    and not exists (
      select 1
      from public.usuarios u
      where u.id = au.id
        and u.igreja_id is not null
        and u.igreja_id is distinct from m.igreja_id
    )
)
update public.membros m
set auth_user_id = c.auth_user_id
from candidatos c
where m.id = c.membro_id
  and m.auth_user_id is null
  and m.status = 'Ativo';

-- Um usuario existente sem igreja é somente o placeholder criado no cadastro de
-- Auth: recebe o baseline. Usuários já tenantizados (inclusive admins, grupos e
-- perfis reais) não são reescritos.
update public.usuarios u
set igreja_id = m.igreja_id,
    nome = coalesce(nullif(u.nome, ''), m.nome, ''),
    email = coalesce(nullif(u.email, ''), m.email, au.email, ''),
    role = 'membro',
    grupo_id = null,
    perfil_id = null
from public.membros m
join auth.users au on au.id = m.auth_user_id
where u.id = m.auth_user_id
  and u.igreja_id is null
  and m.status = 'Ativo'
  and m.auth_user_id is not null;

-- Somente linkage presente em auth.users. A consulta não altera rows de usuarios
-- tenantizados existentes, inclusive admins e grupos já atribuídos.
insert into public.usuarios (
  id, igreja_id, nome, email, role, grupo_id, perfil_id
)
select
  m.auth_user_id,
  m.igreja_id,
  coalesce(m.nome, ''),
  coalesce(m.email, au.email, ''),
  'membro',
  null,
  null
from public.membros m
join auth.users au on au.id = m.auth_user_id
where m.status = 'Ativo'
  and m.auth_user_id is not null
  and not exists (
      select 1
      from public.usuarios u
      where u.id = m.auth_user_id
      and u.igreja_id is not null
      and u.igreja_id is distinct from m.igreja_id
  )
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 4) RLS dos registros básicos e controles de acesso
-- -----------------------------------------------------------------------------

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'membros', 'usuarios', 'grupos', 'grupos_permissoes',
    'perfis', 'perfis_permissoes', 'igrejas'
  ] loop
    if to_regclass('public.' || v_table) is not null then
      execute format('alter table public.%I enable row level security', v_table);
    end if;
  end loop;
end
$$;

-- Membros: leitura própria ativa ou leitura explícita do módulo pelo grupo.
drop policy if exists ohel_membros_member_select_guard on public.membros;
create policy ohel_membros_member_select_guard
on public.membros as restrictive
for select to authenticated
using (
  not helpers.is_restricted_member()
  or helpers.member_owns_membro(id)
  or helpers.member_can_access_table('membros', igreja_id, ARRAY['ler']::text[])
);

drop policy if exists ohel_membros_member_select_permission on public.membros;
create policy ohel_membros_member_select_permission
on public.membros
for select to authenticated
using (
  helpers.is_restricted_member()
  and helpers.member_can_access_table('membros', igreja_id, ARRAY['ler']::text[])
);

drop policy if exists ohel_membros_member_insert_guard on public.membros;
create policy ohel_membros_member_insert_guard
on public.membros as restrictive
for insert to authenticated
with check (
  not helpers.is_restricted_member()
  or helpers.member_can_access_table('membros', igreja_id, ARRAY['criar']::text[])
);

drop policy if exists ohel_membros_member_insert_permission on public.membros;
create policy ohel_membros_member_insert_permission
on public.membros
for insert to authenticated
with check (
  helpers.is_restricted_member()
  and helpers.member_can_access_table('membros', igreja_id, ARRAY['criar']::text[])
);

drop policy if exists ohel_membros_member_update_guard on public.membros;
create policy ohel_membros_member_update_guard
on public.membros as restrictive
for update to authenticated
using (
  not helpers.is_restricted_member()
  or helpers.member_can_access_table('membros', igreja_id, ARRAY['editar', 'aprovar', 'movimentar']::text[])
)
with check (
  not helpers.is_restricted_member()
  or helpers.member_can_access_table('membros', igreja_id, ARRAY['editar', 'aprovar', 'movimentar']::text[])
);

drop policy if exists ohel_membros_member_update_permission on public.membros;
create policy ohel_membros_member_update_permission
on public.membros
for update to authenticated
using (
  helpers.is_restricted_member()
  and helpers.member_can_access_table('membros', igreja_id, ARRAY['editar', 'aprovar', 'movimentar']::text[])
)
with check (
  helpers.is_restricted_member()
  and helpers.member_can_access_table('membros', igreja_id, ARRAY['editar', 'aprovar', 'movimentar']::text[])
);

drop policy if exists ohel_membros_member_delete_guard on public.membros;
create policy ohel_membros_member_delete_guard
on public.membros as restrictive
for delete to authenticated
using (
  not helpers.is_restricted_member()
  or helpers.member_can_access_table('membros', igreja_id, ARRAY['excluir']::text[])
);

drop policy if exists ohel_membros_member_delete_permission on public.membros;
create policy ohel_membros_member_delete_permission
on public.membros
for delete to authenticated
using (
  helpers.is_restricted_member()
  and helpers.member_can_access_table('membros', igreja_id, ARRAY['excluir']::text[])
);

-- Usuarios: um membro só pode enxergar a própria linha. Mesmo assim, o frontend
-- deve usar /api/acesso; a policy não limita colunas de um SELECT *.
drop policy if exists ohel_usuarios_self_select on public.usuarios;
create policy ohel_usuarios_self_select
on public.usuarios
for select to authenticated
using (id = (select auth.uid()));

drop policy if exists ohel_usuarios_admin_select on public.usuarios;
create policy ohel_usuarios_admin_select
on public.usuarios
for select to authenticated
using (helpers.is_admin_for_tenant(igreja_id));

drop policy if exists ohel_membro_monitor_usuarios_admin_insert on public.usuarios;
create policy ohel_membro_monitor_usuarios_admin_insert
on public.usuarios
for insert to authenticated
with check (helpers.is_admin_for_tenant(igreja_id));

drop policy if exists ohel_membro_monitor_usuarios_admin_update on public.usuarios;
create policy ohel_membro_monitor_usuarios_admin_update
on public.usuarios
for update to authenticated
using (helpers.is_admin_for_tenant(igreja_id))
with check (helpers.is_admin_for_tenant(igreja_id));

drop policy if exists ohel_membro_monitor_usuarios_admin_delete on public.usuarios;
create policy ohel_membro_monitor_usuarios_admin_delete
on public.usuarios
for delete to authenticated
using (helpers.is_admin_for_tenant(igreja_id));

drop policy if exists ohel_usuarios_member_select_guard on public.usuarios;
create policy ohel_usuarios_member_select_guard
on public.usuarios as restrictive
for select to authenticated
using (
  not helpers.is_restricted_member()
  or id = (select auth.uid())
);

drop policy if exists ohel_usuarios_admin_insert_guard on public.usuarios;
create policy ohel_usuarios_admin_insert_guard
on public.usuarios as restrictive
for insert to authenticated
with check (helpers.is_admin_for_tenant(igreja_id));

drop policy if exists ohel_usuarios_admin_update_guard on public.usuarios;
create policy ohel_usuarios_admin_update_guard
on public.usuarios as restrictive
for update to authenticated
using (helpers.is_admin_for_tenant(igreja_id))
with check (helpers.is_admin_for_tenant(igreja_id));

drop policy if exists ohel_usuarios_admin_delete_guard on public.usuarios;
create policy ohel_usuarios_admin_delete_guard
on public.usuarios as restrictive
for delete to authenticated
using (helpers.is_admin_for_tenant(igreja_id));

-- Grupos: membro pode apenas ver o grupo que o admin lhe atribuiu. Toda escrita
-- (inclusive grupo_id em usuarios) é protegida pelos guards de admin.
drop policy if exists ohel_grupos_member_or_admin_select on public.grupos;
create policy ohel_grupos_member_or_admin_select
on public.grupos
for select to authenticated
using (
  helpers.is_admin_for_tenant(igreja_id)
  or helpers.member_owns_group(id, igreja_id)
);

drop policy if exists ohel_grupos_member_select_guard on public.grupos;
create policy ohel_grupos_member_select_guard
on public.grupos as restrictive
for select to authenticated
using (
  not helpers.is_restricted_member()
  or helpers.member_owns_group(id, igreja_id)
);

drop policy if exists ohel_membro_monitor_grupos_admin_insert on public.grupos;
create policy ohel_membro_monitor_grupos_admin_insert
on public.grupos
for insert to authenticated
with check (helpers.is_admin_for_tenant(igreja_id));

drop policy if exists ohel_membro_monitor_grupos_admin_update on public.grupos;
create policy ohel_membro_monitor_grupos_admin_update
on public.grupos
for update to authenticated
using (helpers.is_admin_for_tenant(igreja_id))
with check (helpers.is_admin_for_tenant(igreja_id));

drop policy if exists ohel_membro_monitor_grupos_admin_delete on public.grupos;
create policy ohel_membro_monitor_grupos_admin_delete
on public.grupos
for delete to authenticated
using (helpers.is_admin_for_tenant(igreja_id));

drop policy if exists ohel_grupos_admin_insert_guard on public.grupos;
create policy ohel_grupos_admin_insert_guard
on public.grupos as restrictive
for insert to authenticated
with check (helpers.is_admin_for_tenant(igreja_id));

drop policy if exists ohel_grupos_admin_update_guard on public.grupos;
create policy ohel_grupos_admin_update_guard
on public.grupos as restrictive
for update to authenticated
using (helpers.is_admin_for_tenant(igreja_id))
with check (helpers.is_admin_for_tenant(igreja_id));

drop policy if exists ohel_grupos_admin_delete_guard on public.grupos;
create policy ohel_grupos_admin_delete_guard
on public.grupos as restrictive
for delete to authenticated
using (helpers.is_admin_for_tenant(igreja_id));

-- Permissões de grupo: leitura apenas do próprio grupo para o membro; escrita admin.
drop policy if exists ohel_grupos_permissoes_member_or_admin_select on public.grupos_permissoes;
create policy ohel_grupos_permissoes_member_or_admin_select
on public.grupos_permissoes
for select to authenticated
using (
  helpers.is_admin_for_group(grupo_id)
  or helpers.member_owns_group(grupo_id)
);

drop policy if exists ohel_grupos_permissoes_member_select_guard on public.grupos_permissoes;
create policy ohel_grupos_permissoes_member_select_guard
on public.grupos_permissoes as restrictive
for select to authenticated
using (
  not helpers.is_restricted_member()
  or helpers.member_owns_group(grupo_id)
);

drop policy if exists ohel_membro_monitor_grupos_permissoes_admin_insert on public.grupos_permissoes;
create policy ohel_membro_monitor_grupos_permissoes_admin_insert
on public.grupos_permissoes
for insert to authenticated
with check (helpers.is_admin_for_group(grupo_id));

drop policy if exists ohel_membro_monitor_grupos_permissoes_admin_update on public.grupos_permissoes;
create policy ohel_membro_monitor_grupos_permissoes_admin_update
on public.grupos_permissoes
for update to authenticated
using (helpers.is_admin_for_group(grupo_id))
with check (helpers.is_admin_for_group(grupo_id));

drop policy if exists ohel_membro_monitor_grupos_permissoes_admin_delete on public.grupos_permissoes;
create policy ohel_membro_monitor_grupos_permissoes_admin_delete
on public.grupos_permissoes
for delete to authenticated
using (helpers.is_admin_for_group(grupo_id));

drop policy if exists ohel_grupos_permissoes_admin_insert_guard on public.grupos_permissoes;
create policy ohel_grupos_permissoes_admin_insert_guard
on public.grupos_permissoes as restrictive
for insert to authenticated
with check (helpers.is_admin_for_group(grupo_id));

drop policy if exists ohel_grupos_permissoes_admin_update_guard on public.grupos_permissoes;
create policy ohel_grupos_permissoes_admin_update_guard
on public.grupos_permissoes as restrictive
for update to authenticated
using (helpers.is_admin_for_group(grupo_id))
with check (helpers.is_admin_for_group(grupo_id));

drop policy if exists ohel_grupos_permissoes_admin_delete_guard on public.grupos_permissoes;
create policy ohel_grupos_permissoes_admin_delete_guard
on public.grupos_permissoes as restrictive
for delete to authenticated
using (helpers.is_admin_for_group(grupo_id));

-- Perfis e convites são controles de acesso: membros não os leem; escritas são
-- exclusivas de admin do tenant. Policies legadas de leitura continuam para não-
-- membros e ainda precisam respeitar o tenant já implementado nelas.
do $$
begin
  if to_regclass('public.perfis') is not null then
    drop policy if exists ohel_perfis_member_guard on public.perfis;
    create policy ohel_perfis_member_guard
    on public.perfis as restrictive
    for all to authenticated
    using (not helpers.is_restricted_member())
    with check (not helpers.is_restricted_member());

    drop policy if exists ohel_perfis_admin_write_guard on public.perfis;
    create policy ohel_perfis_admin_write_guard
    on public.perfis as restrictive
    for insert to authenticated
    with check (helpers.is_admin_for_tenant(igreja_id));

    drop policy if exists ohel_perfis_admin_update_guard on public.perfis;
    create policy ohel_perfis_admin_update_guard
    on public.perfis as restrictive
    for update to authenticated
    using (helpers.is_admin_for_tenant(igreja_id))
    with check (helpers.is_admin_for_tenant(igreja_id));

    drop policy if exists ohel_perfis_admin_delete_guard on public.perfis;
    create policy ohel_perfis_admin_delete_guard
    on public.perfis as restrictive
    for delete to authenticated
    using (helpers.is_admin_for_tenant(igreja_id));

    drop policy if exists ohel_membro_monitor_perfis_admin_select on public.perfis;
    create policy ohel_membro_monitor_perfis_admin_select
    on public.perfis
    for select to authenticated
    using (helpers.is_admin_for_tenant(igreja_id));

    drop policy if exists ohel_membro_monitor_perfis_admin_insert on public.perfis;
    create policy ohel_membro_monitor_perfis_admin_insert
    on public.perfis
    for insert to authenticated
    with check (helpers.is_admin_for_tenant(igreja_id));

    drop policy if exists ohel_membro_monitor_perfis_admin_update on public.perfis;
    create policy ohel_membro_monitor_perfis_admin_update
    on public.perfis
    for update to authenticated
    using (helpers.is_admin_for_tenant(igreja_id))
    with check (helpers.is_admin_for_tenant(igreja_id));

    drop policy if exists ohel_membro_monitor_perfis_admin_delete on public.perfis;
    create policy ohel_membro_monitor_perfis_admin_delete
    on public.perfis
    for delete to authenticated
    using (helpers.is_admin_for_tenant(igreja_id));
  end if;

  if to_regclass('public.perfis_permissoes') is not null then
    drop policy if exists ohel_perfis_permissoes_member_guard on public.perfis_permissoes;
    create policy ohel_perfis_permissoes_member_guard
    on public.perfis_permissoes as restrictive
    for all to authenticated
    using (not helpers.is_restricted_member())
    with check (not helpers.is_restricted_member());

    drop policy if exists ohel_perfis_permissoes_admin_insert_guard on public.perfis_permissoes;
    create policy ohel_perfis_permissoes_admin_insert_guard
    on public.perfis_permissoes as restrictive
    for insert to authenticated
    with check (helpers.is_admin_for_perfil(perfil_id));

    drop policy if exists ohel_perfis_permissoes_admin_update_guard on public.perfis_permissoes;
    create policy ohel_perfis_permissoes_admin_update_guard
    on public.perfis_permissoes as restrictive
    for update to authenticated
    using (helpers.is_admin_for_perfil(perfil_id))
    with check (helpers.is_admin_for_perfil(perfil_id));

    drop policy if exists ohel_perfis_permissoes_admin_delete_guard on public.perfis_permissoes;
    create policy ohel_perfis_permissoes_admin_delete_guard
    on public.perfis_permissoes as restrictive
    for delete to authenticated
    using (helpers.is_admin_for_perfil(perfil_id));

    drop policy if exists ohel_membro_monitor_perfis_permissoes_admin_select on public.perfis_permissoes;
    create policy ohel_membro_monitor_perfis_permissoes_admin_select
    on public.perfis_permissoes
    for select to authenticated
    using (helpers.is_admin_for_perfil(perfil_id));

    drop policy if exists ohel_membro_monitor_perfis_permissoes_admin_insert on public.perfis_permissoes;
    create policy ohel_membro_monitor_perfis_permissoes_admin_insert
    on public.perfis_permissoes
    for insert to authenticated
    with check (helpers.is_admin_for_perfil(perfil_id));

    drop policy if exists ohel_membro_monitor_perfis_permissoes_admin_update on public.perfis_permissoes;
    create policy ohel_membro_monitor_perfis_permissoes_admin_update
    on public.perfis_permissoes
    for update to authenticated
    using (helpers.is_admin_for_perfil(perfil_id))
    with check (helpers.is_admin_for_perfil(perfil_id));

    drop policy if exists ohel_membro_monitor_perfis_permissoes_admin_delete on public.perfis_permissoes;
    create policy ohel_membro_monitor_perfis_permissoes_admin_delete
    on public.perfis_permissoes
    for delete to authenticated
    using (helpers.is_admin_for_perfil(perfil_id));
  end if;

  if to_regclass('public.admin_convites') is not null then
    drop policy if exists ohel_membro_monitor_admin_convites_admin_select on public.admin_convites;
    create policy ohel_membro_monitor_admin_convites_admin_select
    on public.admin_convites
    for select to authenticated
    using (helpers.is_admin_for_tenant(igreja_id));

    drop policy if exists ohel_admin_convites_admin_insert_guard on public.admin_convites;
    create policy ohel_admin_convites_admin_insert_guard
    on public.admin_convites as restrictive
    for insert to authenticated
    with check (helpers.is_admin_for_tenant(igreja_id));

    drop policy if exists ohel_admin_convites_admin_update_guard on public.admin_convites;
    create policy ohel_admin_convites_admin_update_guard
    on public.admin_convites as restrictive
    for update to authenticated
    using (helpers.is_admin_for_tenant(igreja_id))
    with check (helpers.is_admin_for_tenant(igreja_id));

    drop policy if exists ohel_admin_convites_admin_delete_guard on public.admin_convites;
    create policy ohel_admin_convites_admin_delete_guard
    on public.admin_convites as restrictive
    for delete to authenticated
    using (helpers.is_admin_for_tenant(igreja_id));
  end if;
end
$$;

-- A igreja/tenant também não é uma fonte de dados direta para membro; o contexto
-- deve vir da API. Policies públicas existentes (anon) não são alteradas.
do $$
begin
  if to_regclass('public.igrejas') is not null then
    drop policy if exists ohel_igrejas_member_select_guard on public.igrejas;
    create policy ohel_igrejas_member_select_guard
    on public.igrejas as restrictive
    for select to authenticated
    using (not helpers.is_restricted_member());

    drop policy if exists ohel_igrejas_member_insert_guard on public.igrejas;
    create policy ohel_igrejas_member_insert_guard
    on public.igrejas as restrictive
    for insert to authenticated
    with check (not helpers.is_restricted_member());

    drop policy if exists ohel_igrejas_member_update_guard on public.igrejas;
    create policy ohel_igrejas_member_update_guard
    on public.igrejas as restrictive
    for update to authenticated
    using (not helpers.is_restricted_member())
    with check (not helpers.is_restricted_member());

    drop policy if exists ohel_igrejas_member_delete_guard on public.igrejas;
    create policy ohel_igrejas_member_delete_guard
    on public.igrejas as restrictive
    for delete to authenticated
    using (not helpers.is_restricted_member());
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 5) Guard genérico fechado para todas as tabelas public.igreja_id
-- -----------------------------------------------------------------------------
-- As policies não removem policies legadas. Para contas não identificadas como
-- membro restrito, a expressão retorna true e o comportamento legado continua.
-- Para membros, tabela desconhecida, tenant ausente e Monitor retornam false.

do $$
declare
  r record;
  v_select text := 'ohel_member_table_select_guard';
  v_insert text := 'ohel_member_table_insert_guard';
  v_update text := 'ohel_member_table_update_guard';
  v_delete text := 'ohel_member_table_delete_guard';
  v_select_permission text := 'ohel_member_table_select_permission';
  v_insert_permission text := 'ohel_member_table_insert_permission';
  v_update_permission text := 'ohel_member_table_update_permission';
  v_delete_permission text := 'ohel_member_table_delete_permission';
  v_excluded constant text[] := array[
    'igrejas', 'membros', 'usuarios', 'grupos', 'grupos_permissoes',
    'perfis', 'perfis_permissoes'
  ];
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname <> all (v_excluded)
      and exists (
        select 1
        from pg_attribute a
        where a.attrelid = c.oid
          and a.attname = 'igreja_id'
          and a.attnum > 0
          and not a.attisdropped
      )
    order by c.relname
  loop
    execute format('alter table public.%I enable row level security', r.relname);

    execute format('drop policy if exists %I on public.%I', v_select, r.relname);
    execute format($policy$
      create policy %I on public.%I as restrictive
      for select to authenticated
      using (
        not helpers.is_restricted_member()
        or helpers.member_can_access_table(%L, igreja_id, ARRAY['ler']::text[])
      )
    $policy$, v_select, r.relname, r.relname);

    execute format('drop policy if exists %I on public.%I', v_select_permission, r.relname);
    execute format($policy$
      create policy %I on public.%I
      for select to authenticated
      using (
        helpers.is_restricted_member()
        and helpers.member_can_access_table(%L, igreja_id, ARRAY['ler']::text[])
      )
    $policy$, v_select_permission, r.relname, r.relname);

    execute format('drop policy if exists %I on public.%I', v_insert, r.relname);
    execute format($policy$
      create policy %I on public.%I as restrictive
      for insert to authenticated
      with check (
        not helpers.is_restricted_member()
        or helpers.member_can_access_table(%L, igreja_id, ARRAY['criar']::text[])
      )
    $policy$, v_insert, r.relname, r.relname);

    execute format('drop policy if exists %I on public.%I', v_insert_permission, r.relname);
    execute format($policy$
      create policy %I on public.%I
      for insert to authenticated
      with check (
        helpers.is_restricted_member()
        and helpers.member_can_access_table(%L, igreja_id, ARRAY['criar']::text[])
      )
    $policy$, v_insert_permission, r.relname, r.relname);

    execute format('drop policy if exists %I on public.%I', v_update, r.relname);
    execute format($policy$
      create policy %I on public.%I as restrictive
      for update to authenticated
      using (
        not helpers.is_restricted_member()
        or helpers.member_can_access_table(%L, igreja_id, ARRAY['editar', 'aprovar', 'movimentar']::text[])
      )
      with check (
        not helpers.is_restricted_member()
        or helpers.member_can_access_table(%L, igreja_id, ARRAY['editar', 'aprovar', 'movimentar']::text[])
      )
    $policy$, v_update, r.relname, r.relname, r.relname);

    execute format('drop policy if exists %I on public.%I', v_update_permission, r.relname);
    execute format($policy$
      create policy %I on public.%I
      for update to authenticated
      using (
        helpers.is_restricted_member()
        and helpers.member_can_access_table(%L, igreja_id, ARRAY['editar', 'aprovar', 'movimentar']::text[])
      )
      with check (
        helpers.is_restricted_member()
        and helpers.member_can_access_table(%L, igreja_id, ARRAY['editar', 'aprovar', 'movimentar']::text[])
      )
    $policy$, v_update_permission, r.relname, r.relname, r.relname);

    execute format('drop policy if exists %I on public.%I', v_delete, r.relname);
    execute format($policy$
      create policy %I on public.%I as restrictive
      for delete to authenticated
      using (
        not helpers.is_restricted_member()
        or helpers.member_can_access_table(%L, igreja_id, ARRAY['excluir']::text[])
      )
    $policy$, v_delete, r.relname, r.relname);

    execute format('drop policy if exists %I on public.%I', v_delete_permission, r.relname);
    execute format($policy$
      create policy %I on public.%I
      for delete to authenticated
      using (
        helpers.is_restricted_member()
        and helpers.member_can_access_table(%L, igreja_id, ARRAY['excluir']::text[])
      )
    $policy$, v_delete_permission, r.relname, r.relname);
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- 6) Guard fechado para descendentes sem igreja_id, ligados por FK a tenant
-- -----------------------------------------------------------------------------
-- A detecção recursiva usa o catálogo: qualquer descendente direto ou transitivo
-- de tabela com igreja_id recebe policy. O helper só autoriza relações explicitamente
-- mapeadas; filhos desconhecidos ficam negados para membro.

do $$
declare
  r record;
  v_select text := 'ohel_member_child_select_guard';
  v_insert text := 'ohel_member_child_insert_guard';
  v_update text := 'ohel_member_child_update_guard';
  v_delete text := 'ohel_member_child_delete_guard';
  v_select_permission text := 'ohel_member_child_select_permission';
  v_insert_permission text := 'ohel_member_child_insert_permission';
  v_update_permission text := 'ohel_member_child_update_permission';
  v_delete_permission text := 'ohel_member_child_delete_permission';
begin
  for r in
    with recursive tenant_tables(relid) as (
      select c.oid
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and exists (
          select 1
          from pg_attribute a
          where a.attrelid = c.oid
            and a.attname = 'igreja_id'
            and a.attnum > 0
            and not a.attisdropped
        )
      union
      select fk.conrelid
      from tenant_tables parent_table
      join pg_constraint fk
        on fk.confrelid = parent_table.relid
       and fk.contype = 'f'
      join pg_class child_table on child_table.oid = fk.conrelid
      join pg_namespace child_ns on child_ns.oid = child_table.relnamespace
      where child_ns.nspname = 'public'
        and child_table.relkind in ('r', 'p')
    )
    select distinct child.relname
    from pg_class child
    join pg_namespace child_ns on child_ns.oid = child.relnamespace
    join tenant_tables descendant on descendant.relid = child.oid
    where child_ns.nspname = 'public'
      and child.relkind in ('r', 'p')
      and not exists (
        select 1
        from pg_attribute a
        where a.attrelid = child.oid
          and a.attname = 'igreja_id'
          and a.attnum > 0
          and not a.attisdropped
      )
      and child.relname not in ('usuarios')
    order by child.relname
  loop
    execute format('alter table public.%I enable row level security', r.relname);

    execute format('drop policy if exists %I on public.%I', v_select, r.relname);
    execute format($policy$
      create policy %I on public.%I as restrictive
      for select to authenticated
      using (
        not helpers.is_restricted_member()
        or helpers.member_can_access_child(%L, to_jsonb(%I), ARRAY['ler']::text[])
      )
    $policy$, v_select, r.relname, r.relname, r.relname);

    execute format('drop policy if exists %I on public.%I', v_select_permission, r.relname);
    execute format($policy$
      create policy %I on public.%I
      for select to authenticated
      using (
        helpers.is_restricted_member()
        and helpers.member_can_access_child(%L, to_jsonb(%I), ARRAY['ler']::text[])
      )
    $policy$, v_select_permission, r.relname, r.relname, r.relname);

    execute format('drop policy if exists %I on public.%I', v_insert, r.relname);
    execute format($policy$
      create policy %I on public.%I as restrictive
      for insert to authenticated
      with check (
        not helpers.is_restricted_member()
        or helpers.member_can_access_child(%L, to_jsonb(%I), ARRAY['criar']::text[])
      )
    $policy$, v_insert, r.relname, r.relname, r.relname);

    execute format('drop policy if exists %I on public.%I', v_insert_permission, r.relname);
    execute format($policy$
      create policy %I on public.%I
      for insert to authenticated
      with check (
        helpers.is_restricted_member()
        and helpers.member_can_access_child(%L, to_jsonb(%I), ARRAY['criar']::text[])
      )
    $policy$, v_insert_permission, r.relname, r.relname, r.relname);

    execute format('drop policy if exists %I on public.%I', v_update, r.relname);
    execute format($policy$
      create policy %I on public.%I as restrictive
      for update to authenticated
      using (
        not helpers.is_restricted_member()
        or helpers.member_can_access_child(%L, to_jsonb(%I), ARRAY['editar', 'aprovar', 'movimentar']::text[])
      )
      with check (
        not helpers.is_restricted_member()
        or helpers.member_can_access_child(%L, to_jsonb(%I), ARRAY['editar', 'aprovar', 'movimentar']::text[])
      )
    $policy$, v_update, r.relname, r.relname, r.relname, r.relname, r.relname);

    execute format('drop policy if exists %I on public.%I', v_update_permission, r.relname);
    execute format($policy$
      create policy %I on public.%I
      for update to authenticated
      using (
        helpers.is_restricted_member()
        and helpers.member_can_access_child(%L, to_jsonb(%I), ARRAY['editar', 'aprovar', 'movimentar']::text[])
      )
      with check (
        helpers.is_restricted_member()
        and helpers.member_can_access_child(%L, to_jsonb(%I), ARRAY['editar', 'aprovar', 'movimentar']::text[])
      )
    $policy$, v_update_permission, r.relname, r.relname, r.relname, r.relname, r.relname);

    execute format('drop policy if exists %I on public.%I', v_delete, r.relname);
    execute format($policy$
      create policy %I on public.%I as restrictive
      for delete to authenticated
      using (
        not helpers.is_restricted_member()
        or helpers.member_can_access_child(%L, to_jsonb(%I), ARRAY['excluir']::text[])
      )
    $policy$, v_delete, r.relname, r.relname, r.relname);

    execute format('drop policy if exists %I on public.%I', v_delete_permission, r.relname);
    execute format($policy$
      create policy %I on public.%I
      for delete to authenticated
      using (
        helpers.is_restricted_member()
        and helpers.member_can_access_child(%L, to_jsonb(%I), ARRAY['excluir']::text[])
      )
    $policy$, v_delete_permission, r.relname, r.relname, r.relname);
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- 7) Verificações determinísticas (somente leitura)
-- -----------------------------------------------------------------------------

commit;

select
  'helpers' as objeto,
  count(*) filter (where routine_schema = 'helpers') as funcoes_helpers
from information_schema.routines
where routine_schema = 'helpers'
  and routine_name in (
    'is_restricted_member', 'is_admin_for_tenant', 'current_user_tenant_id',
    'member_owns_membro', 'member_owns_group', 'is_admin_for_group',
    'is_admin_for_perfil', 'member_has_permission', 'member_can_access_table',
    'member_can_access_child'
  );

select
  m.id,
  m.status,
  m.auth_user_id,
  m.igreja_id,
  u.role,
  u.grupo_id,
  u.perfil_id
from public.membros m
left join public.usuarios u on u.id = m.auth_user_id
where m.status = 'Ativo'
order by m.id
limit 100;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and (
    policyname like 'ohel_%member%guard'
    or policyname like 'ohel_usuarios_%'
    or policyname like 'ohel_grupos_%'
    or policyname like 'ohel_grupos_permissoes_%'
  )
order by tablename, policyname;
