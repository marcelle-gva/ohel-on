-- OHEL ON - pré-cadastro Kids & Teens via link/QR Code
-- Execute no SQL Editor do projeto Supabase correto.
-- Contém dados pessoais de menores; configure e valide as políticas antes de produção.
-- Faixas: Kids até 11 anos; Teens de 12 a 17 anos.

begin;

create table if not exists public.kids_teens_pre_cadastros (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  nome text not null,
  data_nascimento date not null,
  faixa text not null check (faixa in ('kids', 'teens')),
  nome_responsavel text not null,
  parentesco_responsavel text not null,
  telefone_responsavel text not null,
  pessoas_autorizadas text,
  informacoes_saude text,
  consentimento_responsavel boolean not null default false,
  consentimento_em timestamptz,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kids_teens_nome_check check (length(btrim(nome)) between 2 and 150),
  constraint kids_teens_responsavel_check check (length(btrim(nome_responsavel)) between 2 and 150),
  constraint kids_teens_parentesco_check check (length(btrim(parentesco_responsavel)) between 2 and 80),
  constraint kids_teens_telefone_check check (length(btrim(telefone_responsavel)) between 8 and 30),
  constraint kids_teens_autorizados_check check (pessoas_autorizadas is null or length(pessoas_autorizadas) <= 1000),
  constraint kids_teens_saude_check check (informacoes_saude is null or length(informacoes_saude) <= 2000)
);

create index if not exists idx_kids_teens_igreja_status_created
  on public.kids_teens_pre_cadastros (igreja_id, status, created_at desc);

create or replace function public.classify_kids_teens_pre_cadastro()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  age_years integer;
begin
  if new.data_nascimento is null or new.data_nascimento > current_date then
    raise exception 'Informe uma data de nascimento válida.';
  end if;

  age_years := extract(year from age(current_date, new.data_nascimento));
  if age_years < 0 or age_years > 17 then
    raise exception 'O pré-cadastro Kids & Teens aceita idades de 0 a 17 anos.';
  end if;

  new.faixa := case when age_years <= 11 then 'kids' else 'teens' end;
  return new;
end;
$$;

create or replace function public.prepare_kids_teens_pre_cadastro()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.consentimento_responsavel is distinct from true then
      raise exception 'É necessário o consentimento do responsável legal.';
    end if;
    new.status := 'pendente';
    new.consentimento_em := now();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kids_teens_pre_cadastro_classify_insert on public.kids_teens_pre_cadastros;
create trigger kids_teens_pre_cadastro_classify_insert
before insert
on public.kids_teens_pre_cadastros
for each row execute function public.classify_kids_teens_pre_cadastro();

drop trigger if exists kids_teens_pre_cadastro_classify_update on public.kids_teens_pre_cadastros;
create trigger kids_teens_pre_cadastro_classify_update
before update of data_nascimento
on public.kids_teens_pre_cadastros
for each row execute function public.classify_kids_teens_pre_cadastro();

drop trigger if exists kids_teens_pre_cadastro_prepare on public.kids_teens_pre_cadastros;
create trigger kids_teens_pre_cadastro_prepare
before insert or update
on public.kids_teens_pre_cadastros
for each row execute function public.prepare_kids_teens_pre_cadastro();

alter table public.kids_teens_pre_cadastros enable row level security;

drop policy if exists kids_teens_public_insert on public.kids_teens_pre_cadastros;
create policy kids_teens_public_insert
on public.kids_teens_pre_cadastros
for insert
to anon, authenticated
with check (
  consentimento_responsavel is true
  and status = 'pendente'
);

drop policy if exists kids_teens_church_select on public.kids_teens_pre_cadastros;
create policy kids_teens_church_select
on public.kids_teens_pre_cadastros
for select
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.igreja_id = kids_teens_pre_cadastros.igreja_id
      and (
        u.role = 'admin'
        or exists (
          select 1
          from public.grupos_permissoes gp
          where gp.grupo_id = u.grupo_id
            and gp.modulo = 'kids-teens'
            and gp.acao = 'ler'
        )
      )
  )
);

drop policy if exists kids_teens_church_update on public.kids_teens_pre_cadastros;
create policy kids_teens_church_update
on public.kids_teens_pre_cadastros
for update
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.igreja_id = kids_teens_pre_cadastros.igreja_id
      and (
        u.role = 'admin'
        or exists (
          select 1
          from public.grupos_permissoes gp
          where gp.grupo_id = u.grupo_id
            and gp.modulo = 'kids-teens'
            and gp.acao in ('aprovar', 'editar')
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.igreja_id = kids_teens_pre_cadastros.igreja_id
      and (
        u.role = 'admin'
        or exists (
          select 1
          from public.grupos_permissoes gp
          where gp.grupo_id = u.grupo_id
            and gp.modulo = 'kids-teens'
            and gp.acao in ('aprovar', 'editar')
        )
      )
  )
);

drop policy if exists kids_teens_church_delete on public.kids_teens_pre_cadastros;

revoke all on public.kids_teens_pre_cadastros from anon, authenticated;
grant insert (
  igreja_id,
  nome,
  data_nascimento,
  faixa,
  nome_responsavel,
  parentesco_responsavel,
  telefone_responsavel,
  pessoas_autorizadas,
  informacoes_saude,
  consentimento_responsavel
) on public.kids_teens_pre_cadastros to anon, authenticated;
grant select on public.kids_teens_pre_cadastros to authenticated;
grant update (status) on public.kids_teens_pre_cadastros to authenticated;

commit;

select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'kids_teens_pre_cadastros'
order by ordinal_position;

select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'kids_teens_pre_cadastros'
order by policyname;
