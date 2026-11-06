-- OHEL ON — correção pontual do pré-cadastro (schema helpers).
-- Substitui somente a função já usada pelo trigger; não altera tabelas,
-- policies, privilégios de membros nem registros existentes.
-- Motivo: variáveis de DECLARE são avaliadas antes do primeiro IF. A consulta
-- de tenant deve acontecer somente depois de reconhecer a chamada autenticada.
-- Execute no SQL Editor do projeto correto como postgres, se ainda não aplicado.

begin;

create or replace function public.ohel_guard_membro_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, auth, helpers
as $$
declare
  v_tenant_id uuid;
begin
  -- SQL Editor/postgres e service_role são atores server-side. Só a role RLS
  -- authenticated deve sofrer o bloqueio de campos protegidos.
  if current_user <> 'authenticated' or (select auth.uid()) is null then
    return new;
  end if;

  -- DECLARE é avaliado antes do primeiro IF: a consulta aos helpers deve ficar
  -- depois do bypass server-side, pois service_role não possui USAGE nesse schema.
  v_tenant_id := helpers.current_user_tenant_id();

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

commit;

-- Somente conferência da definição, sem inserir cadastros.
select
  p.proname as funcao,
  not p.prosecdef as security_invoker,
  pg_get_functiondef(p.oid) not like '%v_tenant_id uuid :=%' as sem_consulta_antecipada,
  pg_get_functiondef(p.oid) like '%v_tenant_id := helpers.current_user_tenant_id();%' as consulta_apos_bypass
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'ohel_guard_membro_mutation';
