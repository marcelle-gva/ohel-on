begin;

-- O formulário público usa membros como fila de pré-cadastros.
alter table public.membros
  add column if not exists created_at timestamptz not null default now();

-- Função segura para validar a igreja sem expor a tabela igrejas ao visitante.
create or replace function public.igreja_publica_existe(p_igreja_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.igrejas where id = p_igreja_id);
$$;

revoke all on function public.igreja_publica_existe(uuid) from public;
grant execute on function public.igreja_publica_existe(uuid) to anon, authenticated;

grant insert on public.membros to anon, authenticated;

drop policy if exists ohel_membros_public_pre_cadastro_insert on public.membros;
create policy ohel_membros_public_pre_cadastro_insert
on public.membros
for insert
to anon, authenticated
with check (
  status = 'Pré-Cadastro'
  and igreja_id is not null
  and public.igreja_publica_existe(igreja_id)
);

-- A secretaria precisa conseguir analisar a fila da própria igreja.
-- O filtro por igreja evita que um usuário veja ou altere cadastros de outra igreja.
grant select, update, delete on public.membros to authenticated;

drop policy if exists ohel_membros_staff_select on public.membros;
create policy ohel_membros_staff_select
on public.membros
for select
to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.igreja_id = membros.igreja_id
      and u.role in ('admin', 'pastor', 'secretaria')
  )
);

drop policy if exists ohel_membros_staff_update on public.membros;
create policy ohel_membros_staff_update
on public.membros
for update
to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.igreja_id = membros.igreja_id
      and u.role in ('admin', 'pastor', 'secretaria')
  )
)
with check (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.igreja_id = membros.igreja_id
      and u.role in ('admin', 'pastor', 'secretaria')
  )
);

drop policy if exists ohel_membros_staff_delete on public.membros;
create policy ohel_membros_staff_delete
on public.membros
for delete
to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.igreja_id = membros.igreja_id
      and u.role in ('admin', 'pastor', 'secretaria')
  )
);

-- A fila continua protegida: somente usuários autenticados da igreja podem ler e tratar registros.
create index if not exists idx_membros_pre_cadastro_recent
  on public.membros (igreja_id, status, created_at desc);

commit;

select
  p.policyname,
  p.cmd,
  p.roles
from pg_policies p
where p.schemaname = 'public'
  and p.tablename = 'membros'
order by p.policyname;

select id, nome, status, created_at, igreja_id
from public.membros
order by created_at desc
limit 20;
