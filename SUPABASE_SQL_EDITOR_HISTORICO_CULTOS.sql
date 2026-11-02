begin;

create table if not exists public.culto_modelos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  nome text not null,
  tipo text not null default 'Culto',
  dia_semana smallint,
  horario_inicio time,
  horario_fim time,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.culto_sessoes (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  modelo_id uuid references public.culto_modelos(id) on delete set null,
  titulo text not null,
  tipo text not null default 'Culto',
  inicio_em timestamptz not null default now(),
  fim_em timestamptz,
  status text not null default 'aberto' check (status in ('aberto', 'encerrado')),
  link_ao_vivo text,
  observacoes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.culto_registros (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  culto_id uuid not null references public.culto_sessoes(id) on delete cascade,
  tipo text not null,
  origem_tabela text,
  origem_id uuid,
  titulo text,
  resumo text,
  payload jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null
);

create index if not exists idx_culto_sessoes_busca
  on public.culto_sessoes (igreja_id, inicio_em desc);
create index if not exists idx_culto_registros_culto
  on public.culto_registros (igreja_id, culto_id, criado_em);
create index if not exists idx_culto_registros_origem
  on public.culto_registros (igreja_id, origem_tabela, origem_id);

alter table public.culto_modelos enable row level security;
alter table public.culto_sessoes enable row level security;
alter table public.culto_registros enable row level security;

drop policy if exists ohel_culto_modelos_select on public.culto_modelos;
create policy ohel_culto_modelos_select on public.culto_modelos for select to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = culto_modelos.igreja_id)
);
drop policy if exists ohel_culto_modelos_write on public.culto_modelos;
create policy ohel_culto_modelos_write on public.culto_modelos for all to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = culto_modelos.igreja_id and u.role = 'admin')
) with check (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = culto_modelos.igreja_id and u.role = 'admin')
);

drop policy if exists ohel_culto_sessoes_select on public.culto_sessoes;
create policy ohel_culto_sessoes_select on public.culto_sessoes for select to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = culto_sessoes.igreja_id)
);
drop policy if exists ohel_culto_sessoes_write on public.culto_sessoes;
create policy ohel_culto_sessoes_write on public.culto_sessoes for all to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = culto_sessoes.igreja_id and u.role in ('admin', 'pastor', 'secretaria'))
) with check (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = culto_sessoes.igreja_id and u.role in ('admin', 'pastor', 'secretaria'))
);

drop policy if exists ohel_culto_registros_select on public.culto_registros;
create policy ohel_culto_registros_select on public.culto_registros for select to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = culto_registros.igreja_id)
);
drop policy if exists ohel_culto_registros_insert on public.culto_registros;
create policy ohel_culto_registros_insert on public.culto_registros for insert to authenticated with check (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = culto_registros.igreja_id)
  and exists (select 1 from public.culto_sessoes s where s.id = culto_registros.culto_id and s.igreja_id = culto_registros.igreja_id)
);

create or replace function public.registrar_registro_culto(
  p_igreja_id uuid,
  p_tipo text,
  p_origem_tabela text,
  p_origem_id uuid,
  p_titulo text,
  p_resumo text,
  p_payload jsonb,
  p_criado_por uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_culto_id uuid;
  v_registro_id uuid;
begin
  select id into v_culto_id
  from public.culto_sessoes
  where igreja_id = p_igreja_id
    and status = 'aberto'
    and inicio_em <= now()
    and (fim_em is null or fim_em >= now())
  order by inicio_em desc
  limit 1;

  if v_culto_id is null then
    return null;
  end if;

  insert into public.culto_registros (
    igreja_id, culto_id, tipo, origem_tabela, origem_id, titulo, resumo, payload, criado_por
  ) values (
    p_igreja_id, v_culto_id, p_tipo, p_origem_tabela, p_origem_id, p_titulo, p_resumo, coalesce(p_payload, '{}'::jsonb), p_criado_por
  ) returning id into v_registro_id;

  return v_registro_id;
end;
$$;

create or replace function public.capturar_insert_culto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb := to_jsonb(new);
  v_igreja_id uuid;
  v_origem_id uuid;
  v_titulo text;
  v_resumo text;
  v_tipo text;
begin
  v_igreja_id := nullif(v_payload->>'igreja_id', '')::uuid;
  v_origem_id := nullif(v_payload->>'id', '')::uuid;
  v_titulo := coalesce(v_payload->>'titulo', v_payload->>'nome', v_payload->>'nome_solicitante', v_payload->>'pessoa_visitada', v_payload->>'tipo_evento', tg_table_name);
  v_resumo := coalesce(v_payload->>'descricao', v_payload->>'observacao', v_payload->>'relato', v_payload->>'status', v_titulo);
  v_tipo := case tg_table_name
    when 'louvores' then 'louvor'
    when 'pedidos_oracao' then 'oracao'
    when 'checkins' then 'checkin'
    when 'visitantes' then 'visitante'
    when 'visitas' then 'visita'
    when 'sermoes' then 'sermao'
    else tg_table_name
  end;

  if v_igreja_id is not null then
    perform public.registrar_registro_culto(v_igreja_id, v_tipo, tg_table_name, v_origem_id, v_titulo, v_resumo, v_payload, auth.uid());
  end if;
  return new;
end;
$$;

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['louvores', 'pedidos_oracao', 'checkins', 'visitantes', 'visitas', 'sermoes'] loop
    if to_regclass('public.' || v_tabela) is not null then
      execute format('drop trigger if exists %I on public.%I', 'capturar_culto_' || v_tabela, v_tabela);
      execute format('create trigger %I after insert on public.%I for each row execute function public.capturar_insert_culto()', 'capturar_culto_' || v_tabela, v_tabela);
    end if;
  end loop;
  if to_regclass('public.pedidos_oracao') is not null then
    drop trigger if exists capturar_culto_pedidos_oracao on public.pedidos_oracao;
    create trigger capturar_culto_pedidos_oracao
      after insert or update on public.pedidos_oracao
      for each row execute function public.capturar_insert_culto();
  end if;
end;
$$;

commit;

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('culto_modelos', 'culto_sessoes', 'culto_registros')
order by table_name, ordinal_position;
