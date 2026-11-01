-- OHEL ON — faturamento mensal de R$ 80,00 por igreja
-- Execute no SQL Editor do projeto Supabase correto.
-- O script é idempotente e não remove dados existentes.
-- A cobrança real exige também as variáveis Stripe no ambiente server-side.

begin;

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null unique references public.igrejas(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan_code text not null default 'igreja_mensal',
  status text not null default 'pending',
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  last_invoice_id text,
  last_invoice_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_subscriptions_plan_code_check
    check (plan_code = 'igreja_mensal'),
  constraint billing_subscriptions_status_check
    check (status in ('pending', 'trialing', 'active', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused'))
);

create index if not exists billing_subscriptions_status_idx
  on public.billing_subscriptions(status);

create index if not exists billing_subscriptions_period_end_idx
  on public.billing_subscriptions(current_period_end);

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now()
);

create index if not exists billing_webhook_events_type_idx
  on public.billing_webhook_events(event_type, created_at desc);

alter table public.billing_subscriptions enable row level security;
alter table public.billing_webhook_events enable row level security;

-- O frontend não escreve diretamente nessas tabelas. As rotas server-side
-- usam SUPABASE_SERVICE_ROLE_KEY depois de validar a sessão do administrador.
revoke all on public.billing_subscriptions from anon, authenticated;
revoke all on public.billing_webhook_events from anon, authenticated;

drop policy if exists billing_subscriptions_admin_select on public.billing_subscriptions;
create policy billing_subscriptions_admin_select
  on public.billing_subscriptions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and u.role = 'admin'
        and u.igreja_id = billing_subscriptions.igreja_id
    )
  );

commit;

-- Conferência pós-execução.
select
  table_name,
  table_type
from information_schema.tables
where table_schema = 'public'
  and table_name in ('billing_subscriptions', 'billing_webhook_events')
order by table_name;

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'billing_subscriptions'
order by ordinal_position;
