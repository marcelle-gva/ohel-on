-- OHEL ON — correção de compatibilidade entre o código e o Supabase
-- Execute no projeto Supabase correto, em Supabase > SQL Editor.
-- Este script não apaga dados existentes e pode ser executado novamente.
-- Faça um backup antes de executar em produção.

begin;

-- -----------------------------------------------------------------------------
-- 1) Perfis de acesso e permissões
-- -----------------------------------------------------------------------------

create table if not exists public.perfis (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  nome text not null,
  descricao text,
  created_at timestamptz not null default now()
);

create table if not exists public.perfis_permissoes (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  modulo text not null,
  acao text not null,
  created_at timestamptz not null default now(),
  constraint perfis_permissoes_unica unique (perfil_id, modulo, acao)
);

-- O código atual de Gestão de Usuários atualiza usuarios.perfil_id.
alter table public.usuarios
  add column if not exists perfil_id uuid;

-- Corrige uma FK de grupo que pode ter sido criada com o nome de perfil.
-- A relação é validada por coluna de origem e destino, não apenas pelo nome.
do $$
begin
  if exists (
    select 1
    from information_schema.key_column_usage k
    join information_schema.constraint_column_usage c
      on c.constraint_catalog = k.constraint_catalog
     and c.constraint_schema = k.constraint_schema
     and c.constraint_name = k.constraint_name
    where k.constraint_schema = 'public'
      and k.table_name = 'usuarios'
      and k.constraint_name = 'usuarios_perfil_id_fkey'
      and k.column_name = 'grupo_id'
      and c.table_schema = 'public'
      and c.table_name = 'grupos'
      and c.column_name = 'id'
  ) then
    if exists (
      select 1
      from information_schema.key_column_usage k
      join information_schema.constraint_column_usage c
        on c.constraint_catalog = k.constraint_catalog
       and c.constraint_schema = k.constraint_schema
       and c.constraint_name = k.constraint_name
      where k.constraint_schema = 'public'
        and k.table_name = 'usuarios'
        and k.constraint_name = 'usuarios_grupo_id_fkey'
        and k.column_name = 'grupo_id'
        and c.table_schema = 'public'
        and c.table_name = 'grupos'
        and c.column_name = 'id'
    ) then
      alter table public.usuarios drop constraint usuarios_perfil_id_fkey;
    else
      alter table public.usuarios rename constraint usuarios_perfil_id_fkey to usuarios_grupo_id_fkey;
    end if;
  end if;

  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'usuarios'
      and constraint_name = 'usuarios_perfil_id_fkey'
  ) and not exists (
    select 1
    from information_schema.key_column_usage k
    join information_schema.constraint_column_usage c
      on c.constraint_catalog = k.constraint_catalog
     and c.constraint_schema = k.constraint_schema
     and c.constraint_name = k.constraint_name
    where k.constraint_schema = 'public'
      and k.table_name = 'usuarios'
      and k.constraint_name = 'usuarios_perfil_id_fkey'
      and k.column_name = 'perfil_id'
      and c.table_schema = 'public'
      and c.table_name = 'perfis'
      and c.column_name = 'id'
  ) then
    raise exception 'usuarios_perfil_id_fkey existe em outra coluna/relação; interrompendo sem substituir.';
  end if;

  if not exists (
    select 1
    from information_schema.key_column_usage k
    join information_schema.constraint_column_usage c
      on c.constraint_catalog = k.constraint_catalog
     and c.constraint_schema = k.constraint_schema
     and c.constraint_name = k.constraint_name
    where k.constraint_schema = 'public'
      and k.table_name = 'usuarios'
      and k.constraint_name = 'usuarios_perfil_id_fkey'
      and k.column_name = 'perfil_id'
      and c.table_schema = 'public'
      and c.table_name = 'perfis'
      and c.column_name = 'id'
  ) then
    alter table public.usuarios
      add constraint usuarios_perfil_id_fkey
      foreign key (perfil_id)
      references public.perfis(id)
      on delete set null;
  end if;
end
$$;

create index if not exists perfis_igreja_id_idx
  on public.perfis (igreja_id);

create index if not exists perfis_permissoes_perfil_id_idx
  on public.perfis_permissoes (perfil_id);

create index if not exists usuarios_perfil_id_idx
  on public.usuarios (perfil_id);

alter table public.perfis enable row level security;
alter table public.perfis_permissoes enable row level security;

-- As policies abaixo permitem administrar perfis somente a administradores
-- vinculados à mesma igreja. Elas não removem policies de outros módulos.
drop policy if exists ohel_perfis_admin_select on public.perfis;
drop policy if exists ohel_perfis_admin_insert on public.perfis;
drop policy if exists ohel_perfis_admin_update on public.perfis;
drop policy if exists ohel_perfis_admin_delete on public.perfis;

create policy ohel_perfis_admin_select
  on public.perfis for select to authenticated
  using (
    exists (
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and u.role = 'admin'
        and u.igreja_id = perfis.igreja_id
    )
  );

create policy ohel_perfis_admin_insert
  on public.perfis for insert to authenticated
  with check (
    exists (
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and u.role = 'admin'
        and u.igreja_id = perfis.igreja_id
    )
  );

create policy ohel_perfis_admin_update
  on public.perfis for update to authenticated
  using (
    exists (
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and u.role = 'admin'
        and u.igreja_id = perfis.igreja_id
    )
  )
  with check (
    exists (
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and u.role = 'admin'
        and u.igreja_id = perfis.igreja_id
    )
  );

create policy ohel_perfis_admin_delete
  on public.perfis for delete to authenticated
  using (
    exists (
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and u.role = 'admin'
        and u.igreja_id = perfis.igreja_id
    )
  );

drop policy if exists ohel_perfis_permissoes_admin_select on public.perfis_permissoes;
drop policy if exists ohel_perfis_permissoes_admin_insert on public.perfis_permissoes;
drop policy if exists ohel_perfis_permissoes_admin_update on public.perfis_permissoes;
drop policy if exists ohel_perfis_permissoes_admin_delete on public.perfis_permissoes;

create policy ohel_perfis_permissoes_admin_select
  on public.perfis_permissoes for select to authenticated
  using (
    exists (
      select 1
      from public.perfis p
      join public.usuarios u on u.igreja_id = p.igreja_id
      where p.id = perfis_permissoes.perfil_id
        and u.id = auth.uid()
        and u.role = 'admin'
    )
  );

create policy ohel_perfis_permissoes_admin_insert
  on public.perfis_permissoes for insert to authenticated
  with check (
    exists (
      select 1
      from public.perfis p
      join public.usuarios u on u.igreja_id = p.igreja_id
      where p.id = perfis_permissoes.perfil_id
        and u.id = auth.uid()
        and u.role = 'admin'
    )
  );

create policy ohel_perfis_permissoes_admin_update
  on public.perfis_permissoes for update to authenticated
  using (
    exists (
      select 1
      from public.perfis p
      join public.usuarios u on u.igreja_id = p.igreja_id
      where p.id = perfis_permissoes.perfil_id
        and u.id = auth.uid()
        and u.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.perfis p
      join public.usuarios u on u.igreja_id = p.igreja_id
      where p.id = perfis_permissoes.perfil_id
        and u.id = auth.uid()
        and u.role = 'admin'
    )
  );

create policy ohel_perfis_permissoes_admin_delete
  on public.perfis_permissoes for delete to authenticated
  using (
    exists (
      select 1
      from public.perfis p
      join public.usuarios u on u.igreja_id = p.igreja_id
      where p.id = perfis_permissoes.perfil_id
        and u.id = auth.uid()
        and u.role = 'admin'
    )
  );

grant select, insert, update, delete
  on public.perfis, public.perfis_permissoes
  to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Buckets usados pelo código
-- -----------------------------------------------------------------------------
-- O código atual usa getPublicUrl(), portanto estes buckets são públicos.
-- Atenção: documentos e comprovantes podem conter dados pessoais. Depois que
-- o sistema estiver funcionando, recomenda-se migrá-los para buckets privados
-- com URLs assinadas.

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('cartazes', 'cartazes', true),
  ('comprovantes', 'comprovantes', true),
  ('documentos', 'documentos', true),
  ('logos', 'logos', true),
  ('comunicacoes', 'comunicacoes', true)
on conflict (id) do nothing;

-- Uploads autenticados para os módulos internos.
drop policy if exists ohel_storage_authenticated_insert on storage.objects;
create policy ohel_storage_authenticated_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('avatars', 'cartazes', 'documentos', 'logos', 'comunicacoes')
  );

drop policy if exists ohel_storage_authenticated_update on storage.objects;
create policy ohel_storage_authenticated_update
  on storage.objects for update to authenticated
  using (
    bucket_id in ('avatars', 'cartazes', 'documentos', 'logos', 'comunicacoes')
  )
  with check (
    bucket_id in ('avatars', 'cartazes', 'documentos', 'logos', 'comunicacoes')
  );

drop policy if exists ohel_storage_authenticated_delete on storage.objects;
create policy ohel_storage_authenticated_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('avatars', 'cartazes', 'documentos', 'logos', 'comunicacoes')
  );

-- O formulário público de acompanhamento de sorteio envia comprovante sem
-- login. Esta policy é necessária para o fluxo atual; aplique rate limit e
-- validação adicional antes de uso em escala.
drop policy if exists ohel_storage_comprovantes_insert on storage.objects;
create policy ohel_storage_comprovantes_insert
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'comprovantes');

drop policy if exists ohel_storage_comprovantes_delete on storage.objects;
create policy ohel_storage_comprovantes_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'comprovantes');

commit;

-- -----------------------------------------------------------------------------
-- 3) Verificação pós-execução
-- -----------------------------------------------------------------------------
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('perfis', 'perfis_permissoes')
order by table_name;

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'usuarios'
  and column_name = 'perfil_id';

select id, name, public
from storage.buckets
where id in ('avatars', 'cartazes', 'comprovantes', 'documentos', 'logos', 'comunicacoes')
order by id;
