-- OHEL ON — RLS do fluxo de aprovação de pedidos de oração
-- Execute no Supabase > SQL Editor.
-- Não apaga pedidos; remove somente as policies antigas desta tabela para
-- evitar que uma policy permissiva contorne as regras abaixo.

begin;

-- Garante RLS na tabela existente.
alter table public.pedidos_oracao enable row level security;

-- Remove todas as policies atuais desta tabela. Isso evita combinações OR
-- permissivas entre policies antigas e as novas regras.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pedidos_oracao'
  loop
    execute format(
      'drop policy if exists %I on public.pedidos_oracao',
      policy_record.policyname
    );
  end loop;
end
$$;

-- Pedido público: qualquer pessoa pode enviar um pedido para uma igreja
-- existente. A leitura continua bloqueada para anon.
create policy ohel_oracao_public_insert
on public.pedidos_oracao
for insert
to anon
with check (
  exists (
    select 1
    from public.igrejas i
    where i.id = pedidos_oracao.igreja_id
  )
);

-- Usuários autenticados só leem pedidos da própria igreja.
create policy ohel_oracao_church_select
on public.pedidos_oracao
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.igreja_id = pedidos_oracao.igreja_id
  )
);

-- Administradores podem criar e alterar pedidos da própria igreja.
create policy ohel_oracao_admin_insert
on public.pedidos_oracao
for insert
to authenticated
with check (
  exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.role = 'admin'
      and u.igreja_id = pedidos_oracao.igreja_id
  )
);

create policy ohel_oracao_admin_update
on public.pedidos_oracao
for update
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.role = 'admin'
      and u.igreja_id = pedidos_oracao.igreja_id
  )
)
with check (
  exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.role = 'admin'
      and u.igreja_id = pedidos_oracao.igreja_id
  )
);

create policy ohel_oracao_admin_delete
on public.pedidos_oracao
for delete
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.role = 'admin'
      and u.igreja_id = pedidos_oracao.igreja_id
  )
);

-- Usuários com permissão de edição/aprovação também podem alterar e excluir
-- somente pedidos da própria igreja.
create policy ohel_oracao_permission_update
on public.pedidos_oracao
for update
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    join public.grupos_permissoes gp on gp.grupo_id = u.grupo_id
    where u.id = auth.uid()
      and u.igreja_id = pedidos_oracao.igreja_id
      and gp.modulo in ('oracoes', 'monitor-oracoes')
      and gp.acao in ('editar', 'aprovar')
  )
)
with check (
  exists (
    select 1
    from public.usuarios u
    join public.grupos_permissoes gp on gp.grupo_id = u.grupo_id
    where u.id = auth.uid()
      and u.igreja_id = pedidos_oracao.igreja_id
      and gp.modulo in ('oracoes', 'monitor-oracoes')
      and gp.acao in ('editar', 'aprovar')
  )
);

create policy ohel_oracao_permission_delete
on public.pedidos_oracao
for delete
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    join public.grupos_permissoes gp on gp.grupo_id = u.grupo_id
    where u.id = auth.uid()
      and u.igreja_id = pedidos_oracao.igreja_id
      and gp.modulo = 'oracoes'
      and gp.acao = 'excluir'
  )
);

grant select, insert, update, delete on public.pedidos_oracao to authenticated;
grant insert on public.pedidos_oracao to anon;

commit;

-- Verificação das policies aplicadas.
select policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename = 'pedidos_oracao'
order by policyname;
