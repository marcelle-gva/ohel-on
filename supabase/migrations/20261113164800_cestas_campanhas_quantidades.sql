begin;

-- A campanha passa a declarar quantas cestas completas pretende montar.
-- Campanhas antigas recebem 1, sem alterar metas ou reservas existentes.
alter table public.cestas_basicas
  add column if not exists quantidade_cestas integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.cestas_basicas'::regclass
      and conname = 'cestas_basicas_quantidade_cestas_check'
  ) then
    alter table public.cestas_basicas
      add constraint cestas_basicas_quantidade_cestas_check
      check (quantidade_cestas > 0);
  end if;
end;
$$;

-- quantidade_necessaria continua sendo o total da campanha para que a RPC
-- reservar_item_cesta e consumidores antigos permaneçam compatíveis.
-- NULL em quantidade_por_cesta identifica item legado cujo rateio não é seguro.
alter table public.cesta_itens
  add column if not exists quantidade_por_cesta integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.cesta_itens'::regclass
      and conname = 'cesta_itens_quantidade_por_cesta_check'
  ) then
    alter table public.cesta_itens
      add constraint cesta_itens_quantidade_por_cesta_check
      check (quantidade_por_cesta is null or quantidade_por_cesta > 0);
  end if;
end;
$$;

create index if not exists idx_cesta_itens_cesta_quantidades
  on public.cesta_itens (igreja_id, cesta_id, quantidade_por_cesta);

comment on column public.cestas_basicas.quantidade_cestas is
  'Quantidade de cestas completas previstas para a campanha; campanhas legadas usam 1.';
comment on column public.cesta_itens.quantidade_por_cesta is
  'Quantidade necessária em cada cesta; NULL somente para item legado sem rateio seguro.';
comment on column public.cesta_itens.quantidade_necessaria is
  'Total necessário na campanha: quantidade_por_cesta vezes cestas_basicas.quantidade_cestas.';

-- Edita o item sob lock e nunca reduz a meta abaixo do que já foi reservado
-- ou entregue. O serviço chama esta RPC depois de autorizar o grupo e passar
-- a igreja derivada da sessão; não há igreja arbitrária vinda do navegador.
create or replace function public.editar_item_cesta(
  p_item_id uuid,
  p_igreja_id uuid,
  p_nome text,
  p_unidade text,
  p_quantidade_por_cesta integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_cesta_id uuid;
  v_comprometido integer;
  v_total integer;
begin
  if p_item_id is null or p_igreja_id is null then
    raise exception 'Item ou igreja inválida';
  end if;
  if p_nome is null or btrim(p_nome) = '' then
    raise exception 'Informe o nome do item';
  end if;
  if p_unidade is null or btrim(p_unidade) = '' then
    raise exception 'Informe a unidade do item';
  end if;
  if p_quantidade_por_cesta is null or p_quantidade_por_cesta < 1 then
    raise exception 'A quantidade por cesta deve ser maior que zero';
  end if;

  -- Ordem única: campanha, depois item. Evita deadlock com o recálculo global.
  select cesta_id into v_cesta_id from public.cesta_itens
  where id = p_item_id and igreja_id = p_igreja_id;
  perform 1 from public.cestas_basicas
  where id = v_cesta_id and igreja_id = p_igreja_id for update;

  select i.id, i.cesta_id, i.igreja_id, c.quantidade_cestas, c.status
    into v_item
  from public.cesta_itens i
  join public.cestas_basicas c
    on c.id = i.cesta_id
   and c.igreja_id = i.igreja_id
  where i.id = p_item_id
    and i.igreja_id = p_igreja_id
  for update of i, c;

  if not found then
    raise exception 'Item não encontrado nesta igreja';
  end if;
  if v_item.status <> 'aberta' then
    raise exception 'Só é possível editar itens de campanha aberta';
  end if;

  select coalesce(sum(d.quantidade), 0)::integer
    into v_comprometido
  from public.cesta_doacoes d
  where d.item_id = p_item_id
    and d.igreja_id = p_igreja_id
    and d.status in ('reservado', 'entregue');

  v_total := p_quantidade_por_cesta * v_item.quantidade_cestas;
  if v_total < v_comprometido then
    raise exception 'A nova meta não pode ser menor que o total reservado ou entregue';
  end if;

  update public.cesta_itens
     set nome = btrim(p_nome),
         unidade = btrim(p_unidade),
         quantidade_por_cesta = p_quantidade_por_cesta,
         quantidade_necessaria = v_total
   where id = p_item_id
     and igreja_id = p_igreja_id;

  return jsonb_build_object(
    'id', p_item_id,
    'quantidade_por_cesta', p_quantidade_por_cesta,
    'quantidade_necessaria', v_total,
    'quantidade_comprometida', v_comprometido
  );
end;
$$;

-- Recalcula todas as metas da campanha em uma única transação. Itens legados
-- sem rateio não são inventados: a operação para quantidade diferente de 1 é
-- recusada até que cada item seja corrigido com quantidade_por_cesta.
create or replace function public.editar_quantidade_cestas(
  p_cesta_id uuid,
  p_igreja_id uuid,
  p_quantidade_cestas integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cesta record;
  v_item record;
  v_comprometido integer;
  v_total integer;
  v_itens integer := 0;
begin
  if p_cesta_id is null or p_igreja_id is null then
    raise exception 'Campanha ou igreja inválida';
  end if;
  if p_quantidade_cestas is null or p_quantidade_cestas < 1 then
    raise exception 'A quantidade de cestas deve ser maior que zero';
  end if;

  select id, quantidade_cestas, status
    into v_cesta
  from public.cestas_basicas
  where id = p_cesta_id
    and igreja_id = p_igreja_id
  for update;

  if not found then
    raise exception 'Campanha não encontrada nesta igreja';
  end if;
  if v_cesta.status <> 'aberta' then
    raise exception 'Só é possível alterar a quantidade de campanha aberta';
  end if;
  if p_quantidade_cestas = v_cesta.quantidade_cestas then
    return jsonb_build_object('id', p_cesta_id, 'quantidade_cestas', p_quantidade_cestas, 'itens_atualizados', 0);
  end if;

  for v_item in
    select i.id, i.quantidade_por_cesta
    from public.cesta_itens i
    where i.cesta_id = p_cesta_id
      and i.igreja_id = p_igreja_id
    order by i.id
    for update
  loop
    v_itens := v_itens + 1;
    if v_item.quantidade_por_cesta is null then
      raise exception 'A campanha possui item legado sem quantidade por cesta; edite esse item antes de alterar a quantidade de cestas';
    end if;

    select coalesce(sum(d.quantidade), 0)::integer
      into v_comprometido
    from public.cesta_doacoes d
    where d.item_id = v_item.id
      and d.igreja_id = p_igreja_id
      and d.status in ('reservado', 'entregue');

    v_total := v_item.quantidade_por_cesta * p_quantidade_cestas;
    if v_total < v_comprometido then
      raise exception 'A nova quantidade de cestas reduziria a meta abaixo do reservado ou entregue em um item';
    end if;

    update public.cesta_itens
       set quantidade_necessaria = v_total
     where id = v_item.id
       and igreja_id = p_igreja_id;
  end loop;

  update public.cestas_basicas
     set quantidade_cestas = p_quantidade_cestas
   where id = p_cesta_id
     and igreja_id = p_igreja_id;

  return jsonb_build_object(
    'id', p_cesta_id,
    'quantidade_cestas', p_quantidade_cestas,
    'itens_atualizados', v_itens
  );
end;
$$;

revoke all on function public.editar_item_cesta(uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.editar_quantidade_cestas(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.editar_item_cesta(uuid, uuid, text, text, integer) to service_role;
grant execute on function public.editar_quantidade_cestas(uuid, uuid, integer) to service_role;

-- Criação e exclusão também são atômicas: não há janela entre conferir e gravar.
create or replace function public.criar_item_cesta(
  p_cesta_id uuid, p_igreja_id uuid, p_nome text, p_unidade text,
  p_quantidade_por_cesta integer
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_cesta record;
  v_item record;
begin
  if p_quantidade_por_cesta is null or p_quantidade_por_cesta < 1
     or nullif(btrim(p_nome), '') is null or nullif(btrim(p_unidade), '') is null then
    raise exception 'Informe nome, unidade e quantidade válidos';
  end if;
  select id, quantidade_cestas, status into v_cesta
  from public.cestas_basicas
  where id = p_cesta_id and igreja_id = p_igreja_id for update;
  if not found then raise exception 'Campanha não encontrada nesta igreja'; end if;
  if v_cesta.status <> 'aberta' then raise exception 'Só é possível adicionar itens a campanha aberta'; end if;
  insert into public.cesta_itens (igreja_id, cesta_id, nome, unidade, quantidade_por_cesta, quantidade_necessaria)
  values (p_igreja_id, p_cesta_id, btrim(p_nome), btrim(p_unidade), p_quantidade_por_cesta,
    p_quantidade_por_cesta * v_cesta.quantidade_cestas)
  returning id, nome, unidade, quantidade_por_cesta, quantidade_necessaria into v_item;
  return to_jsonb(v_item);
end;
$$;

create or replace function public.excluir_item_cesta(p_item_id uuid, p_igreja_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
begin
  -- A reserva existente usa o mesmo lock do item antes de inserir a doação.
  perform 1 from public.cesta_itens
  where id = p_item_id and igreja_id = p_igreja_id for update;
  if not found then raise exception 'Item não encontrado nesta igreja'; end if;
  if exists (select 1 from public.cesta_doacoes where item_id = p_item_id) then
    raise exception 'Não é possível excluir um item com histórico de reservas ou entregas';
  end if;
  delete from public.cesta_itens where id = p_item_id and igreja_id = p_igreja_id;
  return jsonb_build_object('id', p_item_id);
end;
$$;

revoke all on function public.criar_item_cesta(uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.excluir_item_cesta(uuid, uuid) from public, anon, authenticated;
grant execute on function public.criar_item_cesta(uuid, uuid, text, text, integer) to service_role;
grant execute on function public.excluir_item_cesta(uuid, uuid) to service_role;

commit;
