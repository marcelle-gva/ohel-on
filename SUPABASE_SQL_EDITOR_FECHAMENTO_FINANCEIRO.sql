-- OHEL ON - validação do período das transações e bloqueio de mês fechado
-- Execute no SQL Editor do projeto Supabase correto, após backup.
-- O script altera somente triggers/funções das tabelas transacoes e meses_fechados.
-- Ele não altera policies RLS nem corrige lançamentos históricos.

begin;

do $$
begin
  if to_regclass('public.transacoes') is null then
    raise exception 'Tabela public.transacoes não encontrada.';
  end if;
  if to_regclass('public.meses_fechados') is null then
    raise exception 'Tabela public.meses_fechados não encontrada.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transacoes' and column_name = 'igreja_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transacoes' and column_name = 'data'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transacoes' and column_name = 'mes_referencia'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meses_fechados' and column_name = 'igreja_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meses_fechados' and column_name = 'mes_referencia'
  ) then
    raise exception 'Colunas esperadas não encontradas; nenhuma alteração foi aplicada.';
  end if;
end;
$$;

create or replace function public.lock_financial_month(p_igreja_id uuid, p_mes text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_igreja_id::text || ':' || p_mes, 0)
  );
end;
$$;

create or replace function public.validar_transacao_mes_fechado()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  data_mes text;
  referencia_mes text;
  mes_fechado text;
begin
  if new.igreja_id is null or new.data is null or new.mes_referencia is null then
    raise exception 'Igreja, data e mês de referência são obrigatórios.';
  end if;

  data_mes := to_char(new.data::date, 'YYYY-MM');
  referencia_mes := new.mes_referencia::text;

  if referencia_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Mês de referência inválido. Use o formato AAAA-MM.';
  end if;

  -- Bloqueia os dois períodos envolvidos, mesmo se data e referência diferirem.
  if data_mes <= referencia_mes then
    perform public.lock_financial_month(new.igreja_id, data_mes);
    if referencia_mes <> data_mes then
      perform public.lock_financial_month(new.igreja_id, referencia_mes);
    end if;
  else
    perform public.lock_financial_month(new.igreja_id, referencia_mes);
    perform public.lock_financial_month(new.igreja_id, data_mes);
  end if;

  select mf.mes_referencia::text
  into mes_fechado
  from public.meses_fechados mf
  where mf.igreja_id = new.igreja_id
    and mf.mes_referencia::text in (data_mes, referencia_mes)
  limit 1;

  if found then
    raise exception 'Transação bloqueada: o mês % está fechado para esta igreja.', mes_fechado
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.lock_closed_financial_month()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  igreja uuid;
  mes text;
  chave_antiga text;
  chave_nova text;
begin
  if tg_op = 'DELETE' then
    igreja := old.igreja_id;
    mes := old.mes_referencia::text;
    perform public.lock_financial_month(igreja, mes);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    chave_antiga := old.igreja_id::text || ':' || old.mes_referencia::text;
    chave_nova := new.igreja_id::text || ':' || new.mes_referencia::text;
    if chave_antiga <= chave_nova then
      perform public.lock_financial_month(old.igreja_id, old.mes_referencia::text);
      if chave_nova <> chave_antiga then
        perform public.lock_financial_month(new.igreja_id, new.mes_referencia::text);
      end if;
    else
      perform public.lock_financial_month(new.igreja_id, new.mes_referencia::text);
      perform public.lock_financial_month(old.igreja_id, old.mes_referencia::text);
    end if;
    return new;
  end if;

  igreja := new.igreja_id;
  mes := new.mes_referencia::text;
  if igreja is null or mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Igreja e mês de fechamento inválidos.';
  end if;
  perform public.lock_financial_month(igreja, mes);
  return new;
end;
$$;

drop trigger if exists transacoes_validar_mes_fechado on public.transacoes;
create trigger transacoes_validar_mes_fechado
before insert or update
on public.transacoes
for each row execute function public.validar_transacao_mes_fechado();

drop trigger if exists meses_fechados_serializar_alteracoes on public.meses_fechados;
create trigger meses_fechados_serializar_alteracoes
before insert or update or delete
on public.meses_fechados
for each row execute function public.lock_closed_financial_month();

revoke all on function public.lock_financial_month(uuid, text) from public, anon, authenticated;
revoke all on function public.validar_transacao_mes_fechado() from public, anon, authenticated;
revoke all on function public.lock_closed_financial_month() from public, anon, authenticated;

commit;

select
  event_object_table as tabela,
  trigger_name,
  action_timing,
  event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'transacoes_validar_mes_fechado',
    'meses_fechados_serializar_alteracoes'
  )
order by event_object_table, trigger_name, event_manipulation;
