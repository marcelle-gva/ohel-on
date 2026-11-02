begin;

create table if not exists public.termos_aceites (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  membro_id uuid not null references public.membros(id) on delete cascade,
  tipo_termo text not null check (tipo_termo in (
    'entrega_credencial',
    'doacao_bem_movel',
    'lgpd',
    'imagem_adulto',
    'imagem_menor'
  )),
  versao text not null,
  texto_snapshot text not null,
  nome_assinante text not null,
  cpf_assinante text,
  aceito_em timestamptz not null default now(),
  entregue_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_termos_aceites_membro
  on public.termos_aceites (igreja_id, membro_id, aceito_em desc);

alter table public.termos_aceites enable row level security;

drop policy if exists ohel_termos_aceites_select on public.termos_aceites;
create policy ohel_termos_aceites_select
on public.termos_aceites
for select
to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.igreja_id = termos_aceites.igreja_id
  )
);

drop policy if exists ohel_termos_aceites_insert on public.termos_aceites;
create policy ohel_termos_aceites_insert
on public.termos_aceites
for insert
to authenticated
with check (
  entregue_por = auth.uid()
  and exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.igreja_id = termos_aceites.igreja_id
      and u.role in ('admin', 'pastor', 'secretaria')
  )
  and exists (
    select 1 from public.membros m
    where m.id = termos_aceites.membro_id
      and m.igreja_id = termos_aceites.igreja_id
  )
);

commit;

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'termos_aceites'
order by ordinal_position;
