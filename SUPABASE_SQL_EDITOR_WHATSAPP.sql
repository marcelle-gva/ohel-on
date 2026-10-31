-- OHEL ON - WhatsApp Cloud API, registro de consentimento e histórico de envio
-- Execute no SQL Editor do projeto Supabase correto, após backup.
-- Contatos existentes permanecem sem opt-in; confirme consentimento antes de habilitá-los.

begin;

alter table public.membros
  add column if not exists whatsapp_opt_in boolean not null default false,
  add column if not exists whatsapp_opt_in_at timestamptz;

create index if not exists idx_membros_whatsapp_opt_in
  on public.membros (igreja_id, status)
  where whatsapp_opt_in is true;

create table if not exists public.whatsapp_comunicacoes (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  criado_por uuid not null references auth.users(id),
  request_id uuid not null,
  template_name text not null,
  language_code text not null,
  parameter_text text,
  status text not null default 'enviando'
    check (status in ('enviando', 'enviado', 'parcial', 'falhou')),
  total_destinatarios integer not null default 0 check (total_destinatarios >= 0),
  enviados integer not null default 0 check (enviados >= 0),
  falhas integer not null default 0 check (falhas >= 0),
  created_at timestamptz not null default now(),
  concluido_em timestamptz,
  constraint whatsapp_comunicacoes_request_unique unique (igreja_id, request_id),
  constraint whatsapp_comunicacoes_template_check check (length(btrim(template_name)) between 1 and 512),
  constraint whatsapp_comunicacoes_language_check check (language_code ~ '^[a-z]{2}_[A-Z]{2}$'),
  constraint whatsapp_comunicacoes_parameter_check check (parameter_text is null or length(parameter_text) <= 1024)
);

create table if not exists public.whatsapp_destinatarios (
  id uuid primary key default gen_random_uuid(),
  comunicacao_id uuid not null references public.whatsapp_comunicacoes(id) on delete cascade,
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  membro_id uuid not null,
  nome text not null,
  telefone text not null,
  status text not null default 'na_fila'
    check (status in ('na_fila', 'enviado', 'entregue', 'lido', 'falhou')),
  meta_message_id text,
  erro text,
  enviado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  constraint whatsapp_destinatarios_phone_unique unique (comunicacao_id, telefone)
);

create unique index if not exists idx_whatsapp_destinatarios_meta_message
  on public.whatsapp_destinatarios (meta_message_id)
  where meta_message_id is not null;
create index if not exists idx_whatsapp_destinatarios_communication
  on public.whatsapp_destinatarios (comunicacao_id, status);

alter table public.whatsapp_comunicacoes enable row level security;
alter table public.whatsapp_destinatarios enable row level security;

drop policy if exists whatsapp_comunicacoes_admin_select on public.whatsapp_comunicacoes;
create policy whatsapp_comunicacoes_admin_select
on public.whatsapp_comunicacoes
for select to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.igreja_id = whatsapp_comunicacoes.igreja_id
      and u.role = 'admin'
  )
);

drop policy if exists whatsapp_destinatarios_admin_select on public.whatsapp_destinatarios;
create policy whatsapp_destinatarios_admin_select
on public.whatsapp_destinatarios
for select to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.igreja_id = whatsapp_destinatarios.igreja_id
      and u.role = 'admin'
  )
);

revoke all on public.whatsapp_comunicacoes, public.whatsapp_destinatarios from public, anon;
grant select on public.whatsapp_comunicacoes, public.whatsapp_destinatarios to authenticated;

commit;
