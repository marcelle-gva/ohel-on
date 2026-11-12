begin;

-- Habilita vínculo administrativo do departamento e filtro por situação.
alter table public.departamentos
  add column if not exists responsavel_usuario_id uuid references public.usuarios(id) on delete set null,
  add column if not exists ativo boolean not null default true;

create index if not exists idx_departamentos_responsavel
  on public.departamentos (responsavel_usuario_id);

-- Catálogo de produtos compartilhado; lanches Kids usam o departamento existente.
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

create or replace function public.validar_vinculos_produto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.departamento_id is not null and not exists (
    select 1 from public.departamentos d
    where d.id = new.departamento_id and d.igreja_id = new.igreja_id
  ) then
    raise exception 'O departamento não pertence à igreja do produto';
  end if;
  if new.fornecedor_id is not null and not exists (
    select 1 from public.fornecedores f
    where f.id = new.fornecedor_id and f.igreja_id = new.igreja_id
  ) then
    raise exception 'O fornecedor não pertence à igreja do produto';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_vinculos_produto on public.produtos;
create trigger trg_validar_vinculos_produto
before insert or update on public.produtos
for each row execute function public.validar_vinculos_produto();

create or replace function public.marcar_produto_atualizado()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_marcar_produto_atualizado on public.produtos;
create trigger trg_marcar_produto_atualizado
before update on public.produtos
for each row execute function public.marcar_produto_atualizado();

alter table public.produtos enable row level security;
revoke all on public.produtos from anon, public;
grant select, insert, update, delete on public.produtos to authenticated;

drop policy if exists ohel_produtos_staff_select on public.produtos;
create policy ohel_produtos_staff_select
  on public.produtos for select to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.igreja_id = produtos.igreja_id
        and (u.role in ('admin','pastor','secretaria') or produtos.departamento_id is null
          or exists (
            select 1 from public.departamentos d
            where d.id = produtos.departamento_id and d.responsavel_usuario_id = auth.uid()
          )
        )
    )
  );

drop policy if exists ohel_produtos_staff_insert on public.produtos;
create policy ohel_produtos_staff_insert
  on public.produtos for insert to authenticated
  with check (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.igreja_id = produtos.igreja_id
        and (u.role in ('admin','pastor','secretaria') or exists (
          select 1 from public.departamentos d
          where d.id = produtos.departamento_id
            and d.responsavel_usuario_id = auth.uid()
            and d.igreja_id = produtos.igreja_id
        ))
    )
  );

drop policy if exists ohel_produtos_staff_update on public.produtos;
create policy ohel_produtos_staff_update
  on public.produtos for update to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.igreja_id = produtos.igreja_id
        and (u.role in ('admin','pastor','secretaria') or exists (
          select 1 from public.departamentos d
          where d.id = produtos.departamento_id
            and d.responsavel_usuario_id = auth.uid()
            and d.igreja_id = produtos.igreja_id
        ))
    )
  )
  with check (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.igreja_id = produtos.igreja_id
        and (u.role in ('admin','pastor','secretaria') or exists (
          select 1 from public.departamentos d
          where d.id = produtos.departamento_id
            and d.responsavel_usuario_id = auth.uid()
            and d.igreja_id = produtos.igreja_id
        ))
    )
  );

drop policy if exists ohel_produtos_staff_delete on public.produtos;
create policy ohel_produtos_staff_delete
  on public.produtos for delete to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.igreja_id = produtos.igreja_id
        and (u.role in ('admin','pastor','secretaria') or exists (
          select 1 from public.departamentos d
          where d.id = produtos.departamento_id
            and d.responsavel_usuario_id = auth.uid()
            and d.igreja_id = produtos.igreja_id
        ))
    )
  );

commit;
