begin;

create table if not exists public.cestas_basicas (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  nome text not null,
  descricao text,
  status text not null default 'aberta' check (status in ('aberta', 'encerrada', 'arquivada')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.cesta_itens (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  cesta_id uuid not null references public.cestas_basicas(id) on delete cascade,
  nome text not null,
  quantidade_necessaria integer not null check (quantidade_necessaria > 0),
  unidade text not null default 'unidade',
  created_at timestamptz not null default now()
);

create table if not exists public.cestas_responsaveis (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  nome text not null,
  telefone text not null,
  ativo boolean not null default true,
  notificar_reserva boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cesta_doacoes (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  cesta_id uuid not null references public.cestas_basicas(id) on delete cascade,
  item_id uuid not null references public.cesta_itens(id) on delete cascade,
  membro_id uuid references public.membros(id) on delete set null,
  nome_doador text not null,
  quantidade integer not null check (quantidade > 0),
  status text not null default 'reservado' check (status in ('reservado', 'entregue', 'cancelado')),
  reservado_em timestamptz not null default now(),
  entregue_em timestamptz,
  whatsapp_doador_status text not null default 'nao_enviado',
  whatsapp_responsaveis_status text not null default 'nao_enviado',
  whatsapp_detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cestas_igreja_status on public.cestas_basicas (igreja_id, status, created_at desc);
create index if not exists idx_cesta_itens_cesta on public.cesta_itens (igreja_id, cesta_id);
create index if not exists idx_cesta_doacoes_cesta on public.cesta_doacoes (igreja_id, cesta_id, status, reservado_em desc);
create index if not exists idx_cestas_responsaveis_igreja on public.cestas_responsaveis (igreja_id, ativo);

alter table public.cestas_basicas enable row level security;
alter table public.cesta_itens enable row level security;
alter table public.cestas_responsaveis enable row level security;
alter table public.cesta_doacoes enable row level security;

drop policy if exists ohel_cestas_select_membro on public.cestas_basicas;
create policy ohel_cestas_select_membro on public.cestas_basicas for select to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = cestas_basicas.igreja_id)
  or exists (select 1 from public.membros m where m.igreja_id = cestas_basicas.igreja_id and lower(m.email) = lower((select email from auth.users where id = auth.uid())) and m.status = 'Ativo')
);
drop policy if exists ohel_cestas_admin_write on public.cestas_basicas;
create policy ohel_cestas_admin_write on public.cestas_basicas for all to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = cestas_basicas.igreja_id and u.role in ('admin', 'pastor', 'secretaria'))
) with check (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = cestas_basicas.igreja_id and u.role in ('admin', 'pastor', 'secretaria'))
);

drop policy if exists ohel_cesta_itens_select_membro on public.cesta_itens;
create policy ohel_cesta_itens_select_membro on public.cesta_itens for select to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = cesta_itens.igreja_id and u.role in ('admin', 'pastor', 'secretaria'))
  or (exists (select 1 from public.cestas_basicas c where c.id = cesta_itens.cesta_id and c.igreja_id = cesta_itens.igreja_id and c.status = 'aberta')
    and exists (select 1 from public.membros m where m.igreja_id = cesta_itens.igreja_id and lower(m.email) = lower((select email from auth.users where id = auth.uid())) and m.status = 'Ativo'))
);
drop policy if exists ohel_cesta_itens_admin_write on public.cesta_itens;
create policy ohel_cesta_itens_admin_write on public.cesta_itens for all to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = cesta_itens.igreja_id and u.role in ('admin', 'pastor', 'secretaria'))
) with check (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = cesta_itens.igreja_id and u.role in ('admin', 'pastor', 'secretaria'))
);

drop policy if exists ohel_cestas_responsaveis_admin on public.cestas_responsaveis;
create policy ohel_cestas_responsaveis_admin on public.cestas_responsaveis for all to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = cestas_responsaveis.igreja_id and u.role = 'admin')
) with check (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = cestas_responsaveis.igreja_id and u.role = 'admin')
);

drop policy if exists ohel_cesta_doacoes_admin_select on public.cesta_doacoes;
create policy ohel_cesta_doacoes_admin_select on public.cesta_doacoes for select to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = cesta_doacoes.igreja_id)
);
drop policy if exists ohel_cesta_doacoes_member_select on public.cesta_doacoes;
create policy ohel_cesta_doacoes_member_select on public.cesta_doacoes for select to authenticated using (
  exists (select 1 from public.membros m where m.id = cesta_doacoes.membro_id and lower(m.email) = lower((select email from auth.users where id = auth.uid())) and m.status = 'Ativo')
);
revoke insert, update, delete on public.cesta_doacoes from anon, authenticated;

create or replace function public.reservar_item_cesta(p_item_id uuid, p_quantidade integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_membro record;
  v_item record;
  v_reservado integer;
  v_doacao_id uuid;
begin
  if auth.uid() is null then raise exception 'Acesso de membro necessário'; end if;
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 100 then raise exception 'Quantidade inválida'; end if;

  select email into v_email from auth.users where id = auth.uid();
  select id, igreja_id, nome, telefone, whatsapp_opt_in into v_membro
  from public.membros
  where lower(email) = lower(v_email) and status = 'Ativo'
  limit 1;
  if v_membro.id is null then raise exception 'Membro ativo não encontrado'; end if;

  select i.id, i.cesta_id, i.igreja_id, i.nome, i.unidade, i.quantidade_necessaria, c.nome as cesta_nome
  into v_item
  from public.cesta_itens i
  join public.cestas_basicas c on c.id = i.cesta_id and c.igreja_id = i.igreja_id
  where i.id = p_item_id and i.igreja_id = v_membro.igreja_id and c.status = 'aberta'
  for update of i;
  if v_item.id is null then raise exception 'Item não disponível'; end if;

  select coalesce(sum(quantidade), 0) into v_reservado
  from public.cesta_doacoes
  where item_id = v_item.id and status in ('reservado', 'entregue');
  if v_reservado + p_quantidade > v_item.quantidade_necessaria then
    raise exception 'Este item já foi reservado por outros membros';
  end if;

  insert into public.cesta_doacoes (igreja_id, cesta_id, item_id, membro_id, nome_doador, quantidade)
  values (v_membro.igreja_id, v_item.cesta_id, v_item.id, v_membro.id, v_membro.nome, p_quantidade)
  returning id into v_doacao_id;

  return jsonb_build_object(
    'id', v_doacao_id,
    'igreja_id', v_membro.igreja_id,
    'membro_id', v_membro.id,
    'nome_doador', v_membro.nome,
    'telefone', v_membro.telefone,
    'whatsapp_opt_in', coalesce(v_membro.whatsapp_opt_in, false),
    'item_nome', v_item.nome,
    'unidade', v_item.unidade,
    'quantidade', p_quantidade,
    'cesta_nome', v_item.cesta_nome
  );
end;
$$;

grant execute on function public.reservar_item_cesta(uuid, integer) to authenticated;

commit;
