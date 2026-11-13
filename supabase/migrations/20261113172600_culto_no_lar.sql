begin;

-- O conteúdo do Culto no Lar é um mural por igreja, não um ativo público.
create table if not exists public.culto_lar_posts (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  membro_id uuid not null,
  autor_usuario_id uuid not null references public.usuarios(id) on delete restrict,
  casa_nome text not null,
  data_culto date not null,
  titulo text,
  referencia text,
  palavra text not null,
  foto_path text not null,
  foto_mime text not null,
  status text not null default 'Pendente',
  motivo_rejeicao text,
  versao bigint not null default 1,
  decidido_por uuid references public.usuarios(id) on delete set null,
  decidido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint culto_lar_posts_membro_id_fkey
    foreign key (membro_id) references public.membros(id) on delete cascade,
  constraint culto_lar_posts_status_check
    check (status in ('Pendente', 'Aprovado', 'Rejeitado')),
  constraint culto_lar_posts_foto_mime_check
    check (foto_mime in ('image/jpeg', 'image/png', 'image/webp')),
  constraint culto_lar_posts_versao_check
    check (versao > 0),
  constraint culto_lar_posts_casa_nome_check
    check (length(btrim(casa_nome)) between 1 and 150),
  constraint culto_lar_posts_titulo_check
    check (titulo is null or length(btrim(titulo)) between 1 and 200),
  constraint culto_lar_posts_referencia_check
    check (referencia is null or length(btrim(referencia)) between 1 and 200),
  constraint culto_lar_posts_palavra_check
    check (length(btrim(palavra)) between 1 and 20000),
  constraint culto_lar_posts_foto_path_check
    check (length(foto_path) between 1 and 500),
  constraint culto_lar_posts_motivo_check
    check (motivo_rejeicao is null or length(btrim(motivo_rejeicao)) between 1 and 500)
);

create table if not exists public.culto_lar_decisoes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.culto_lar_posts(id) on delete cascade,
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  versao_anterior bigint not null,
  status_anterior text not null,
  status_novo text not null,
  motivo text,
  decidido_por uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint culto_lar_decisoes_status_anterior_check
    check (status_anterior in ('Pendente', 'Aprovado', 'Rejeitado')),
  constraint culto_lar_decisoes_status_novo_check
    check (status_novo in ('Aprovado', 'Rejeitado')),
  constraint culto_lar_decisoes_versao_check
    check (versao_anterior > 0),
  constraint culto_lar_decisoes_motivo_check
    check (motivo is null or length(btrim(motivo)) between 1 and 500)
);

create index if not exists culto_lar_posts_igreja_status_data_idx
  on public.culto_lar_posts (igreja_id, status, data_culto desc, created_at desc, id desc);
create index if not exists culto_lar_posts_igreja_membro_data_idx
  on public.culto_lar_posts (igreja_id, membro_id, data_culto desc, created_at desc, id desc);
create index if not exists culto_lar_decisoes_post_created_idx
  on public.culto_lar_decisoes (post_id, created_at desc, id desc);

-- Bucket separado e privado; nenhum bucket compartilhado ou público é usado.
do $bucket$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('culto-lar-fotos', 'culto-lar-fotos', false)
    on conflict (id) do update set public = false;
  end if;
end
$bucket$;

-- O app usa exclusivamente service_role para Storage após revalidar a sessão e
-- a igreja. A policy restritiva impede que uma policy genérica futura libere o
-- bucket a authenticated/anon por engano; não cria policy pública de leitura.
do $storage$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists ohel_culto_lar_storage_deny_authenticated on storage.objects';
    execute $policy$
      create policy ohel_culto_lar_storage_deny_authenticated
      on storage.objects as restrictive
      for all to authenticated
      using (bucket_id <> 'culto-lar-fotos')
      with check (bucket_id <> 'culto-lar-fotos')
    $policy$;
    execute 'drop policy if exists ohel_culto_lar_storage_deny_anon on storage.objects';
    execute $policy$
      create policy ohel_culto_lar_storage_deny_anon
      on storage.objects as restrictive
      for all to anon
      using (bucket_id <> 'culto-lar-fotos')
      with check (bucket_id <> 'culto-lar-fotos')
    $policy$;
  end if;
end
$storage$;

-- Service-only: RLS sem policies permissivas para anon/authenticated. O
-- service_role continua sendo usado pelos Route Handlers após autorização.
alter table public.culto_lar_posts enable row level security;
alter table public.culto_lar_decisoes enable row level security;
revoke all on table public.culto_lar_posts, public.culto_lar_decisoes from public, anon, authenticated;
grant all on table public.culto_lar_posts, public.culto_lar_decisoes to service_role;

create or replace function public.culto_lar_moderar_post(
  p_post_id uuid,
  p_igreja_id uuid,
  p_decidido_por uuid,
  p_status text,
  p_motivo text,
  p_versao bigint
)
returns setof public.culto_lar_posts
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_post public.culto_lar_posts%rowtype;
  v_status_anterior text;
begin
  if p_status not in ('Aprovado', 'Rejeitado') then
    raise exception 'Status de moderação inválido.' using errcode = '22023';
  end if;
  if p_status = 'Aprovado' and p_motivo is not null and btrim(p_motivo) <> '' then
    raise exception 'A aprovação não aceita razão de rejeição.' using errcode = '22023';
  end if;

  select *
    into v_post
    from public.culto_lar_posts
   where id = p_post_id
     and igreja_id = p_igreja_id
   for update;

  if not found then
    return;
  end if;
  if v_post.versao is distinct from p_versao then
    raise exception 'A revisão do Culto no Lar mudou.' using errcode = 'P0001';
  end if;
  v_status_anterior := v_post.status;

  update public.culto_lar_posts
     set status = p_status,
         motivo_rejeicao = case when p_status = 'Rejeitado' then nullif(btrim(p_motivo), '') else null end,
         versao = v_post.versao + 1,
         decidido_por = p_decidido_por,
         decidido_em = now(),
         updated_at = now()
   where id = p_post_id
     and igreja_id = p_igreja_id
  returning * into v_post;

  insert into public.culto_lar_decisoes (
    post_id,
    igreja_id,
    versao_anterior,
    status_anterior,
    status_novo,
    motivo,
    decidido_por
  ) values (
    v_post.id,
    v_post.igreja_id,
    v_post.versao - 1,
    v_status_anterior,
    v_post.status,
    v_post.motivo_rejeicao,
    p_decidido_por
  );

  return next v_post;
end;
$function$;

revoke all on function public.culto_lar_moderar_post(uuid, uuid, uuid, text, text, bigint) from public, anon, authenticated;
grant execute on function public.culto_lar_moderar_post(uuid, uuid, uuid, text, text, bigint) to service_role;

commit;
