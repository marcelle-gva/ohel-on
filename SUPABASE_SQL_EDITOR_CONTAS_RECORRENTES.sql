-- OHEL ON - compatibilidade de contas recorrentes no Supabase
-- Execute este arquivo no SQL Editor do projeto Supabase correto.
-- Faça backup antes de aplicar alterações em produção.
--
-- O script e idempotente: pode ser executado novamente sem recriar as colunas.
-- Nao cria nem modifica policies RLS, triggers, lancamentos ou dados financeiros.
-- Se uma coluna existente tiver tipo incompatível, a execução falha com mensagem
-- explícita em vez de converter dados automaticamente.

begin;

do $migration$
declare
  table_oid regclass := to_regclass('public.contas_pagar');
  column_info record;
  recurring_column_was_added boolean := false;
begin
  if table_oid is null then
    raise exception 'Tabela public.contas_pagar não encontrada. Confirme se este é o projeto/schema correto antes de executar a migração.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contas_pagar'
      and column_name = 'recorrente'
  ) then
    alter table public.contas_pagar
      add column recorrente boolean not null default false;
    recurring_column_was_added := true;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contas_pagar'
      and column_name = 'dia_vencimento_mensal'
  ) then
    alter table public.contas_pagar
      add column dia_vencimento_mensal smallint;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contas_pagar'
      and column_name = 'tipo_conta'
  ) then
    alter table public.contas_pagar
      add column tipo_conta text not null default 'Única';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contas_pagar'
      and column_name = 'total_parcelas'
  ) then
    alter table public.contas_pagar
      add column total_parcelas integer not null default 1;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contas_pagar'
      and column_name = 'parcela'
  ) then
    alter table public.contas_pagar
      add column parcela text;
  end if;

  for column_info in
    select column_name, data_type, udt_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contas_pagar'
      and column_name in (
        'recorrente',
        'dia_vencimento_mensal',
        'tipo_conta',
        'total_parcelas',
        'parcela'
      )
  loop
    if column_info.column_name = 'recorrente'
      and column_info.data_type <> 'boolean' then
      raise exception 'public.contas_pagar.recorrente deve ser boolean; tipo encontrado: %.', column_info.data_type;
    end if;

    if column_info.column_name in ('dia_vencimento_mensal', 'total_parcelas')
      and column_info.udt_name not in ('int2', 'int4', 'int8') then
      raise exception 'public.contas_pagar.% deve ser um tipo inteiro; tipo encontrado: %.',
        column_info.column_name, column_info.data_type;
    end if;

    if column_info.column_name = 'tipo_conta'
      and column_info.data_type not in ('text', 'character varying', 'character') then
      if not exists (
        select 1
        from pg_type t
        join pg_enum e on e.enumtypid = t.oid
        where t.typname = column_info.udt_name
        group by t.oid
        having array_agg(e.enumlabel::text) @> array['Única', 'Parcelada', 'Recorrente']
      ) then
        raise exception 'public.contas_pagar.tipo_conta deve ser textual ou um enum que aceite Única, Parcelada e Recorrente; tipo encontrado: %.',
          column_info.data_type;
      end if;
    end if;

    if column_info.column_name = 'parcela'
      and column_info.data_type not in ('text', 'character varying', 'character') then
      raise exception 'public.contas_pagar.parcela deve ser textual; tipo encontrado: %.',
        column_info.data_type;
    end if;
  end loop;

  if recurring_column_was_added
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'contas_pagar'
        and column_name = 'tipo_conta'
    ) then
    update public.contas_pagar
    set recorrente = true
    where tipo_conta = 'Recorrente'
      and recorrente = false;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = table_oid
      and conname = 'contas_pagar_dia_vencimento_mensal_check'
  ) then
    alter table public.contas_pagar
      add constraint contas_pagar_dia_vencimento_mensal_check
      check (dia_vencimento_mensal is null or dia_vencimento_mensal between 1 and 31)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = table_oid
      and conname = 'contas_pagar_total_parcelas_check'
  ) then
    alter table public.contas_pagar
      add constraint contas_pagar_total_parcelas_check
      check (total_parcelas >= 1)
      not valid;
  end if;
end
$migration$;

commit;

-- Conferência: confirme os tipos, defaults e a ativação de RLS na tabela.
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'contas_pagar'
  and column_name in (
    'recorrente',
    'dia_vencimento_mensal',
    'tipo_conta',
    'total_parcelas',
    'parcela'
  )
order by column_name;

select
  c.relname as tabela,
  c.relrowsecurity as rls_habilitado,
  c.relforcerowsecurity as rls_forcado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'contas_pagar';

-- Resumo das policies existentes; revise o resultado no painel Supabase.
select
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'contas_pagar'
order by policyname;
