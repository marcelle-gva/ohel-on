-- OHEL ON - schema inicial para gestão de sorteios
-- Execute no SQL Editor do Supabase do projeto correto antes de usar o módulo.
-- O acesso público às reservas ocorre apenas pelas RPCs seguras definidas abaixo.
-- Reservas antigas sem token de acompanhamento não poderão usar o novo link público.

begin;

create extension if not exists pgcrypto;

create table if not exists public.sorteios (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null,
  nome text not null,
  descricao text,
  tipo text not null default 'sorteio' check (tipo in ('evento', 'sorteio')),
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'encerrado')),
  valor_bilhete numeric(12,2) not null default 0,
  total_numeros integer not null default 100 check (total_numeros > 0),
  numero_inicial integer not null default 1 check (numero_inicial >= 1),
  numero_final integer not null generated always as (numero_inicial + total_numeros - 1) stored,
  data_sorteio date,
  cartaz_url text,
  link_publico text,
  qr_code_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sorteio_participantes (
  id uuid primary key default gen_random_uuid(),
  sorteio_id uuid not null references public.sorteios(id) on delete cascade,
  igreja_id uuid not null,
  nome text not null,
  telefone text not null,
  numero integer not null,
  valor numeric(12,2) not null default 0,
  comprovante_url text,
  token_acompanhamento_hash text,
  status text not null default 'pendente' check (status in ('pendente', 'reservado', 'confirmado', 'cancelado')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sorteio_participante_unico_numero unique (sorteio_id, numero),
  constraint sorteio_participante_unico_telefone unique (sorteio_id, telefone)
);

create index if not exists idx_sorteios_igreja_id on public.sorteios(igreja_id);
create index if not exists idx_sorteios_status on public.sorteios(status);
create index if not exists idx_sorteio_participantes_sorteio_id on public.sorteio_participantes(sorteio_id);
create index if not exists idx_sorteio_participantes_telefone on public.sorteio_participantes(telefone);

alter table public.sorteio_participantes
  add column if not exists token_acompanhamento_hash text;

create unique index if not exists idx_sorteio_participantes_token_hash
  on public.sorteio_participantes(token_acompanhamento_hash)
  where token_acompanhamento_hash is not null;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists sorteios_updated_at on public.sorteios;
create trigger sorteios_updated_at
before update on public.sorteios
for each row execute function public.set_updated_at();

drop trigger if exists sorteio_participantes_updated_at on public.sorteio_participantes;
create trigger sorteio_participantes_updated_at
before update on public.sorteio_participantes
for each row execute function public.set_updated_at();

alter table public.sorteios enable row level security;
alter table public.sorteio_participantes enable row level security;

revoke all on public.sorteios, public.sorteio_participantes from public, anon;
grant select, insert, update, delete on public.sorteios, public.sorteio_participantes to authenticated;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('sorteios', 'sorteio_participantes')
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      existing_policy.policyname,
      existing_policy.tablename
    );
  end loop;
end;
$$;

create policy sorteios_igreja_autenticada
on public.sorteios
for all
to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.igreja_id = sorteios.igreja_id
  )
)
with check (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.igreja_id = sorteios.igreja_id
  )
);

create policy participantes_sorteio_igreja_autenticada
on public.sorteio_participantes
for all
to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.igreja_id = sorteio_participantes.igreja_id
      and exists (
        select 1 from public.sorteios s
        where s.id = sorteio_participantes.sorteio_id
          and s.igreja_id = sorteio_participantes.igreja_id
      )
  )
)
with check (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.igreja_id = sorteio_participantes.igreja_id
      and exists (
        select 1 from public.sorteios s
        where s.id = sorteio_participantes.sorteio_id
          and s.igreja_id = sorteio_participantes.igreja_id
      )
  )
);

create or replace function public.get_sorteio_publico(p_sorteio_id uuid)
returns jsonb
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  select jsonb_build_object(
    'id', s.id,
    'nome', s.nome,
    'descricao', s.descricao,
    'valor_bilhete', s.valor_bilhete,
    'total_numeros', s.total_numeros,
    'numero_inicial', s.numero_inicial,
    'numero_final', s.numero_final,
    'data_sorteio', s.data_sorteio,
    'reservados', coalesce((
      select jsonb_agg(sp.numero order by sp.numero)
      from public.sorteio_participantes sp
      where sp.sorteio_id = s.id
        and sp.status <> 'cancelado'
    ), '[]'::jsonb)
  )
  from public.sorteios s
  where s.id = p_sorteio_id
    and s.status = 'ativo';
$$;

create or replace function public.reservar_numero_sorteio(
  p_sorteio_id uuid,
  p_nome text,
  p_telefone text,
  p_numero integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  sorteio public.sorteios%rowtype;
  token text := encode(gen_random_bytes(32), 'hex');
  participante_id uuid;
begin
  if p_numero is null then
    raise exception 'Escolha um número válido.';
  end if;

  if length(btrim(coalesce(p_nome, ''))) not between 2 and 150
    or length(btrim(coalesce(p_telefone, ''))) not between 8 and 30 then
    raise exception 'Informe nome e telefone válidos.';
  end if;

  select * into sorteio
  from public.sorteios s
  where s.id = p_sorteio_id and s.status = 'ativo'
  for update;

  if not found then
    raise exception 'Sorteio indisponível.';
  end if;

  if p_numero < sorteio.numero_inicial or p_numero > sorteio.numero_final then
    raise exception 'Número fora da faixa deste sorteio.';
  end if;

  insert into public.sorteio_participantes (
    sorteio_id, igreja_id, nome, telefone, numero, valor, status, token_acompanhamento_hash
  )
  values (
    sorteio.id, sorteio.igreja_id, btrim(p_nome), btrim(p_telefone),
    p_numero, sorteio.valor_bilhete, 'pendente', encode(digest(token, 'sha256'), 'hex')
  )
  returning id into participante_id;

  return jsonb_build_object(
    'participante_id', participante_id,
    'numero', p_numero,
    'token', token
  );
end;
$$;

create or replace function public.get_acompanhamento_sorteio(
  p_sorteio_id uuid,
  p_token text
)
returns jsonb
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  select jsonb_build_object(
    'sorteio_nome', s.nome,
    'participante_id', sp.id,
    'nome', sp.nome,
    'numero', sp.numero,
    'valor', sp.valor,
    'status', sp.status,
    'comprovante_url', sp.comprovante_url
  )
  from public.sorteio_participantes sp
  join public.sorteios s on s.id = sp.sorteio_id
  where sp.sorteio_id = p_sorteio_id
    and sp.token_acompanhamento_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and length(p_token) = 64
    and p_token is not null;
$$;

create or replace function public.registrar_comprovante_sorteio(
  p_sorteio_id uuid,
  p_token text,
  p_comprovante_url text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if p_token is null or length(p_token) <> 64
    or p_comprovante_url is null
    or p_comprovante_url !~ '^https://[^[:space:]]+$' then
    raise exception 'URL do comprovante inválida.';
  end if;

  update public.sorteio_participantes
  set comprovante_url = p_comprovante_url,
      status = case when status = 'confirmado' then status else 'reservado' end
  where sorteio_id = p_sorteio_id
    and token_acompanhamento_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and length(p_token) = 64
    and status <> 'cancelado'
    and p_token is not null;

  if not found then
    raise exception 'Acompanhamento não encontrado.';
  end if;

  return true;
end;
$$;

revoke all on function public.get_sorteio_publico(uuid) from public;
revoke all on function public.reservar_numero_sorteio(uuid, text, text, integer) from public;
revoke all on function public.get_acompanhamento_sorteio(uuid, text) from public;
revoke all on function public.registrar_comprovante_sorteio(uuid, text, text) from public;

grant execute on function public.get_sorteio_publico(uuid) to anon, authenticated;
grant execute on function public.reservar_numero_sorteio(uuid, text, text, integer) to anon, authenticated;
grant execute on function public.get_acompanhamento_sorteio(uuid, text) to anon, authenticated;
grant execute on function public.registrar_comprovante_sorteio(uuid, text, text) to anon, authenticated;

commit;

select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('sorteios', 'sorteio_participantes')
order by table_name, ordinal_position;
