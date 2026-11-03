begin;

-- Cliente/tenant comercial da IPO CLOUD. O conteúdo das igrejas permanece fora
-- das consultas deste painel e continua protegido pelas policies próprias.
create table if not exists public.ipocloud_clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  plano text not null default 'Igreja individual',
  limite_igrejas integer not null default 1 check (limite_igrejas > 0),
  status text not null default 'ativo' check (status in ('ativo', 'suspenso', 'cancelado')),
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.ipocloud_platform_admins (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ipocloud_cliente_usuarios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.ipocloud_clientes(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'administrador_organizacao',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (cliente_id, auth_user_id)
);

alter table public.igrejas
  add column if not exists ipocloud_cliente_id uuid references public.ipocloud_clientes(id) on delete restrict;

create index if not exists ipocloud_igrejas_cliente_idx on public.igrejas(ipocloud_cliente_id);
create index if not exists ipocloud_cliente_usuarios_user_idx on public.ipocloud_cliente_usuarios(auth_user_id);

-- Admin Geral inicial da plataforma. Só serão inseridos usuários que já existirem
-- no Auth; outros administradores deverão ser adicionados por convite seguro.
insert into public.ipocloud_platform_admins (auth_user_id)
select id
from auth.users
where lower(email) in ('marcelle.gva@gmail.com', 'admin@ipocloud.com.br')
on conflict (auth_user_id) do nothing;

-- Cliente inicial da instalação atual. O nome/slug pode ser ajustado no painel depois.
insert into public.ipocloud_clientes (nome, slug, plano, limite_igrejas)
values ('OHEL ON', 'ohel-on', 'Igreja individual', 1)
on conflict (slug) do nothing;

-- Igrejas legadas ficam no tenant OHEL ON até serem explicitamente transferidas.
update public.igrejas i
set ipocloud_cliente_id = c.id
from public.ipocloud_clientes c
where c.slug = 'ohel-on'
  and i.ipocloud_cliente_id is null;

-- Função de escopo usada apenas nas policies da camada IPO CLOUD.
create or replace function public.is_ipocloud_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ipocloud_platform_admins p
    where p.auth_user_id = auth.uid()
      and p.ativo = true
  );
$$;

alter table public.ipocloud_clientes enable row level security;
alter table public.ipocloud_platform_admins enable row level security;
alter table public.ipocloud_cliente_usuarios enable row level security;

revoke all on public.ipocloud_clientes, public.ipocloud_platform_admins, public.ipocloud_cliente_usuarios from anon;
grant select on public.ipocloud_clientes, public.ipocloud_platform_admins, public.ipocloud_cliente_usuarios to authenticated;

 drop policy if exists ipocloud_clientes_platform_select on public.ipocloud_clientes;
create policy ipocloud_clientes_platform_select
on public.ipocloud_clientes for select to authenticated
using (
  public.is_ipocloud_platform_admin()
  or exists (
    select 1 from public.ipocloud_cliente_usuarios u
    where u.cliente_id = ipocloud_clientes.id
      and u.auth_user_id = auth.uid()
      and u.ativo = true
  )
);

drop policy if exists ipocloud_platform_admins_self_select on public.ipocloud_platform_admins;
create policy ipocloud_platform_admins_self_select
on public.ipocloud_platform_admins for select to authenticated
using (auth_user_id = auth.uid() or public.is_ipocloud_platform_admin());

drop policy if exists ipocloud_cliente_usuarios_scope_select on public.ipocloud_cliente_usuarios;
create policy ipocloud_cliente_usuarios_scope_select
on public.ipocloud_cliente_usuarios for select to authenticated
using (auth_user_id = auth.uid() or public.is_ipocloud_platform_admin());

-- Não há policy de escrita para o cliente pelo navegador. Criação, convite,
-- suspensão e transferência serão feitas por APIs server-side autorizadas.
commit;

select id, nome, slug, plano, limite_igrejas, status
from public.ipocloud_clientes
order by created_at;
