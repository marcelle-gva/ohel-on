-- Sorteios: atribuição administrativa de vendedor e foto do prêmio.
-- Migration aditiva, idempotente e NÃO aplicada por este módulo.
-- Não cria lançamentos financeiros: pagamento_manual_status fica restrito ao sorteio.

begin;

alter table public.sorteio_participantes
  add column if not exists vendedor_membro_id uuid,
  add column if not exists origem text not null default 'online',
  add column if not exists pagamento_manual_status text not null default 'nao_informado',
  add column if not exists pagamento_manual_observacoes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sorteio_participantes_vendedor_membro_id_fkey'
      and conrelid = 'public.sorteio_participantes'::regclass
  ) then
    alter table public.sorteio_participantes
      add constraint sorteio_participantes_vendedor_membro_id_fkey
      foreign key (vendedor_membro_id) references public.membros(id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'sorteio_participantes_origem_check'
      and conrelid = 'public.sorteio_participantes'::regclass
  ) then
    alter table public.sorteio_participantes
      add constraint sorteio_participantes_origem_check
      check (origem in ('online', 'manual'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'sorteio_participantes_pagamento_manual_status_check'
      and conrelid = 'public.sorteio_participantes'::regclass
  ) then
    alter table public.sorteio_participantes
      add constraint sorteio_participantes_pagamento_manual_status_check
      check (pagamento_manual_status in ('nao_informado', 'pendente', 'confirmado'));
  end if;
end;
$$;

create index if not exists idx_sorteio_participantes_vendedor
  on public.sorteio_participantes(igreja_id, vendedor_membro_id)
  where vendedor_membro_id is not null;

-- A coluna de vínculo não pode ser preenchida por membros/monitores através do
-- cliente Supabase. A API usa service-role após resolverAcesso e o RPC valida admin.
create or replace function public.guard_sorteio_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  operador_admin boolean;
begin
  if new.vendedor_membro_id is not null
     and (tg_op = 'INSERT' or new.vendedor_membro_id is distinct from old.vendedor_membro_id or new.igreja_id is distinct from old.igreja_id)
     and not exists (
    select 1 from public.membros m
    where m.id = new.vendedor_membro_id and m.igreja_id = new.igreja_id and m.status = 'Ativo'
  ) then
    raise exception 'Membro vendedor ativo não pertence a esta igreja.' using errcode = '42501';
  end if;

  select coalesce(auth.role() = 'service_role', false) or exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.role = 'admin' and u.igreja_id = new.igreja_id
  ) into operador_admin;

  if not operador_admin and tg_op = 'INSERT' and (
    new.vendedor_membro_id is not null
    or new.origem <> 'online'
    or new.pagamento_manual_status <> 'nao_informado'
    or new.pagamento_manual_observacoes is not null
  ) then
    raise exception 'Somente administradores podem cadastrar atribuição manual.' using errcode = '42501';
  end if;

  if not operador_admin and tg_op = 'UPDATE' and (
    new.vendedor_membro_id is distinct from old.vendedor_membro_id
    or new.origem is distinct from old.origem
    or new.pagamento_manual_status is distinct from old.pagamento_manual_status
    or new.pagamento_manual_observacoes is distinct from old.pagamento_manual_observacoes
  ) then
    raise exception 'Somente administradores podem alterar atribuição manual.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists sorteio_participantes_admin_fields_guard on public.sorteio_participantes;
create trigger sorteio_participantes_admin_fields_guard
before insert or update on public.sorteio_participantes
for each row execute function public.guard_sorteio_admin_fields();

create or replace function public.registrar_numero_manual_sorteio(
  p_sorteio_id uuid,
  p_numero integer,
  p_vendedor_membro_id uuid,
  p_nome text,
  p_telefone text,
  p_observacoes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  sorteio public.sorteios%rowtype;
  membro public.membros%rowtype;
  operador_igreja uuid;
  participante public.sorteio_participantes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessão administrativa obrigatória.' using errcode = '42501';
  end if;

  -- Só o JWT da sessão administrativa pode executar o cadastro manual.
  select u.igreja_id into operador_igreja
  from public.usuarios u
  where u.id = auth.uid() and u.role = 'admin';
  if operador_igreja is null then
    raise exception 'Somente administradores podem cadastrar números manualmente.' using errcode = '42501';
  end if;

  select s.* into sorteio
  from public.sorteios s
  where s.id = p_sorteio_id and s.igreja_id = operador_igreja
  for update;
  if not found then
    raise exception 'Sorteio não encontrado nesta igreja.' using errcode = 'P0002';
  end if;

  if p_numero is null or p_numero < sorteio.numero_inicial or p_numero > sorteio.numero_final then
    raise exception 'Número fora da faixa deste sorteio.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.sorteio_participantes sp
    where sp.sorteio_id = sorteio.id and sp.numero = p_numero
  ) then
    raise exception 'Número já está ocupado neste sorteio.' using errcode = '23505';
  end if;

  if p_vendedor_membro_id is null then
    raise exception 'Selecione o membro vendedor.' using errcode = '22023';
  end if;
  select m.* into membro
  from public.membros m
  where m.id = p_vendedor_membro_id
    and m.igreja_id = operador_igreja
    and m.status = 'Ativo';
  if not found then
    raise exception 'Membro vendedor ativo não pertence a esta igreja.' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_nome, ''))) not between 2 and 150
    or length(btrim(coalesce(p_telefone, ''))) not between 8 and 30 then
    raise exception 'Informe nome e telefone válidos do comprador.' using errcode = '22023';
  end if;

  insert into public.sorteio_participantes (
    sorteio_id,
    igreja_id,
    nome,
    telefone,
    numero,
    valor,
    status,
    observacoes,
    origem,
    vendedor_membro_id,
    pagamento_manual_status,
    pagamento_manual_observacoes
  )
  values (
    sorteio.id,
    sorteio.igreja_id,
    btrim(p_nome),
    btrim(p_telefone),
    p_numero,
    sorteio.valor_bilhete,
    'reservado',
    nullif(btrim(coalesce(p_observacoes, '')), ''),
    'manual',
    membro.id,
    'nao_informado',
    nullif(btrim(coalesce(p_observacoes, '')), '')
  )
  returning * into participante;

  return jsonb_build_object(
    'id', participante.id,
    'sorteio_id', participante.sorteio_id,
    'numero', participante.numero,
    'origem', participante.origem,
    'status', participante.status,
    'pagamento_manual_status', participante.pagamento_manual_status,
    'vendedor_membro_id', participante.vendedor_membro_id
  );
end;
$$;

revoke all on function public.registrar_numero_manual_sorteio(uuid, integer, uuid, text, text, text) from public, anon;
grant execute on function public.registrar_numero_manual_sorteio(uuid, integer, uuid, text, text, text) to authenticated;

commit;
