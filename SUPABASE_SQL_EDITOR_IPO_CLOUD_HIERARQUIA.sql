begin;

create table if not exists public.ipocloud_regioes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.ipocloud_clientes(id) on delete cascade,
  nome text not null,
  descricao text,
  responsavel_auth_user_id uuid references auth.users(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (cliente_id, nome)
);

alter table public.igrejas
  add column if not exists ipocloud_regiao_id uuid references public.ipocloud_regioes(id) on delete set null;

create index if not exists ipocloud_regioes_cliente_idx on public.ipocloud_regioes(cliente_id);
create index if not exists ipocloud_igrejas_regiao_idx on public.igrejas(ipocloud_regiao_id);

create table if not exists public.ipocloud_cliente_convites (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.ipocloud_clientes(id) on delete cascade,
  email text not null,
  nome text not null,
  token_hash text not null unique,
  convidado_por uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ipocloud_cliente_convites_cliente_idx on public.ipocloud_cliente_convites(cliente_id);
create index if not exists ipocloud_cliente_convites_email_idx on public.ipocloud_cliente_convites(lower(email));

alter table public.ipocloud_regioes enable row level security;
alter table public.ipocloud_cliente_convites enable row level security;
revoke all on public.ipocloud_regioes, public.ipocloud_cliente_convites from anon;
grant select on public.ipocloud_regioes, public.ipocloud_cliente_convites to authenticated;

drop policy if exists ipocloud_regioes_scope_select on public.ipocloud_regioes;
create policy ipocloud_regioes_scope_select
on public.ipocloud_regioes for select to authenticated
using (
  public.is_ipocloud_platform_admin()
  or exists (
    select 1 from public.ipocloud_cliente_usuarios u
    where u.cliente_id = ipocloud_regioes.cliente_id
      and u.auth_user_id = auth.uid()
      and u.ativo = true
  )
);

drop policy if exists ipocloud_convites_platform_select on public.ipocloud_cliente_convites;
create policy ipocloud_convites_platform_select
on public.ipocloud_cliente_convites for select to authenticated
using (public.is_ipocloud_platform_admin());

commit;

select c.nome as cliente, r.nome as regiao
from public.ipocloud_regioes r
join public.ipocloud_clientes c on c.id = r.cliente_id
order by c.nome, r.nome;
