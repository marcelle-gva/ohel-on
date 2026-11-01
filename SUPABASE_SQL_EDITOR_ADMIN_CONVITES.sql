-- OHEL ON — convites controlados de administradores
-- Execute no Supabase SQL Editor antes de usar a tela de administradores.
-- O envio do e-mail é feito pela API do Supabase Auth; configure SMTP no Supabase.

create table if not exists public.admin_convites (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  email text not null,
  nome text not null,
  token_hash text not null unique,
  convidado_por uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists admin_convites_igreja_idx
  on public.admin_convites (igreja_id, created_at desc);
create index if not exists admin_convites_email_idx
  on public.admin_convites (lower(email));

alter table public.admin_convites enable row level security;

drop policy if exists admin_convites_select_owner on public.admin_convites;
create policy admin_convites_select_owner
  on public.admin_convites for select to authenticated
  using (
    exists (
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and u.role = 'admin'
        and u.igreja_id = admin_convites.igreja_id
    )
  );

drop policy if exists admin_convites_insert_owner on public.admin_convites;
create policy admin_convites_insert_owner
  on public.admin_convites for insert to authenticated
  with check (
    convidado_por = auth.uid()
    and exists (
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and u.role = 'admin'
        and u.igreja_id = admin_convites.igreja_id
    )
  );

drop policy if exists admin_convites_update_owner on public.admin_convites;
create policy admin_convites_update_owner
  on public.admin_convites for update to authenticated
  using (
    exists (
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and u.role = 'admin'
        and u.igreja_id = admin_convites.igreja_id
    )
  )
  with check (
    exists (
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and u.role = 'admin'
        and u.igreja_id = admin_convites.igreja_id
    )
  );

grant select, insert, update on public.admin_convites to authenticated;
