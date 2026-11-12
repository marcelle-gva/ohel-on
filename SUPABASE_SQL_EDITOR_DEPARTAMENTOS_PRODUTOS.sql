begin;

-- Responsável do departamento e vínculo dos fornecedores
alter table public.departamentos
  add column if not exists responsavel_usuario_id uuid references public.usuarios(id) on delete set null,
  add column if not exists ativo boolean not null default true;

alter table public.fornecedores
  add column if not exists departamento_id uuid references public.departamentos(id) on delete set null,
  add column if not exists observacoes text;

create index if not exists idx_departamentos_responsavel
  on public.departamentos (responsavel_usuario_id);
create index if not exists idx_fornecedores_departamento
  on public.fornecedores (igreja_id, departamento_id);

-- Catálogo geral de produtos da igreja. Um produto pode ser geral (sem departamento)
-- ou pertencer a um departamento específico.
create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  departamento_id uuid references public.departamentos(id) on delete set null,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  nome text not null,
  descricao text,
  sku text,
  unidade text not null default 'unidade',
  preco_custo numeric(12,2) not null default 0 check (preco_custo >= 0),
  preco_venda numeric(12,2) not null default 0 check (preco_venda >= 0),
  estoque numeric(12,3) not null default 0 check (estoque >= 0),
  estoque_minimo numeric(12,3) not null default 0 check (estoque_minimo >= 0),
  status text not null default 'Ativo' check (status in ('Ativo', 'Inativo')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_produtos_igreja_departamento
  on public.produtos (igreja_id, departamento_id, nome);
create index if not exists idx_produtos_fornecedor
  on public.produtos (fornecedor_id);

-- Impede misturar registros de igrejas diferentes nos vínculos opcionais.
create or replace function public.validar_vinculos_produto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.departamento_id is not null and not exists (
    select 1 from public.departamentos d where d.id = new.departamento_id and d.igreja_id = new.igreja_id
  ) then raise exception 'O departamento não pertence à igreja do produto'; end if;
  if new.fornecedor_id is not null and not exists (
    select 1 from public.fornecedores f where f.id = new.fornecedor_id and f.igreja_id = new.igreja_id
  ) then raise exception 'O fornecedor não pertence à igreja do produto'; end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_vinculos_produto on public.produtos;
create trigger trg_validar_vinculos_produto
before insert or update on public.produtos
for each row execute function public.validar_vinculos_produto();

-- Atualiza a data de alteração sem depender do cliente.
create or replace function public.marcar_produto_atualizado()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_marcar_produto_atualizado on public.produtos;
create trigger trg_marcar_produto_atualizado before update on public.produtos
for each row execute function public.marcar_produto_atualizado();

alter table public.produtos enable row level security;
grant select, insert, update, delete on public.produtos to authenticated;

-- Funções de autorização locais às políticas.
drop policy if exists ohel_produtos_staff_select on public.produtos;
create policy ohel_produtos_staff_select on public.produtos for select to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = produtos.igreja_id and (
    u.role in ('admin','pastor','secretaria') or
    produtos.departamento_id is null or
    exists (select 1 from public.departamentos d where d.id = produtos.departamento_id and d.responsavel_usuario_id = auth.uid())
  ))
);

drop policy if exists ohel_produtos_staff_insert on public.produtos;
create policy ohel_produtos_staff_insert on public.produtos for insert to authenticated with check (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = produtos.igreja_id and (
    u.role in ('admin','pastor','secretaria') or
    exists (select 1 from public.departamentos d where d.id = produtos.departamento_id and d.responsavel_usuario_id = auth.uid() and d.igreja_id = produtos.igreja_id)
  ))
);

drop policy if exists ohel_produtos_staff_update on public.produtos;
create policy ohel_produtos_staff_update on public.produtos for update to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = produtos.igreja_id and (
    u.role in ('admin','pastor','secretaria') or exists (select 1 from public.departamentos d where d.id = produtos.departamento_id and d.responsavel_usuario_id = auth.uid())
  ))
) with check (igreja_id = (select u.igreja_id from public.usuarios u where u.id = auth.uid()));

drop policy if exists ohel_produtos_staff_delete on public.produtos;
create policy ohel_produtos_staff_delete on public.produtos for delete to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = produtos.igreja_id and (
    u.role in ('admin','pastor','secretaria') or exists (select 1 from public.departamentos d where d.id = produtos.departamento_id and d.responsavel_usuario_id = auth.uid())
  ))
);

-- Permite que responsáveis consultem e gerenciem fornecedores do próprio departamento.
drop policy if exists ohel_fornecedores_departamento_select on public.fornecedores;
create policy ohel_fornecedores_departamento_select on public.fornecedores for select to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = fornecedores.igreja_id and (
    u.role in ('admin','pastor','secretaria') or fornecedores.departamento_id is null or
    exists (select 1 from public.departamentos d where d.id = fornecedores.departamento_id and d.responsavel_usuario_id = auth.uid())
  ))
);

drop policy if exists ohel_fornecedores_departamento_insert on public.fornecedores;
create policy ohel_fornecedores_departamento_insert on public.fornecedores for insert to authenticated with check (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = fornecedores.igreja_id and (
    u.role in ('admin','pastor','secretaria') or
    exists (select 1 from public.departamentos d where d.id = fornecedores.departamento_id and d.responsavel_usuario_id = auth.uid() and d.igreja_id = fornecedores.igreja_id)
  ))
);

drop policy if exists ohel_fornecedores_departamento_update on public.fornecedores;
create policy ohel_fornecedores_departamento_update on public.fornecedores for update to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = fornecedores.igreja_id and (
    u.role in ('admin','pastor','secretaria') or exists (select 1 from public.departamentos d where d.id = fornecedores.departamento_id and d.responsavel_usuario_id = auth.uid())
  ))
) with check (igreja_id = (select u.igreja_id from public.usuarios u where u.id = auth.uid()));

drop policy if exists ohel_fornecedores_departamento_delete on public.fornecedores;
create policy ohel_fornecedores_departamento_delete on public.fornecedores for delete to authenticated using (
  exists (select 1 from public.usuarios u where u.id = auth.uid() and u.igreja_id = fornecedores.igreja_id and (
    u.role in ('admin','pastor','secretaria') or exists (select 1 from public.departamentos d where d.id = fornecedores.departamento_id and d.responsavel_usuario_id = auth.uid())
  ))
);

commit;

select 'produtos' as tabela, count(*) as registros from public.produtos;
