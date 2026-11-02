begin;

alter table public.eventos_produtos
  add column if not exists fornecedor_id uuid references public.fornecedores(id) on delete set null;

create index if not exists idx_eventos_produtos_fornecedor
  on public.eventos_produtos (fornecedor_id);

create or replace function public.validar_fornecedor_produto_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.fornecedor_id is not null and not exists (
    select 1 from public.fornecedores f
    where f.id = new.fornecedor_id and f.igreja_id = new.igreja_id
  ) then
    raise exception 'O fornecedor não pertence à igreja do evento';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_fornecedor_produto_evento on public.eventos_produtos;
create trigger trg_validar_fornecedor_produto_evento
before insert or update on public.eventos_produtos
for each row execute function public.validar_fornecedor_produto_evento();

commit;

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'eventos_produtos'
  and column_name = 'fornecedor_id';
