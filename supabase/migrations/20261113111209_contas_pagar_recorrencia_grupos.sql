begin;

alter table public.contas_pagar
  add column if not exists recorrencia_grupo_id uuid;

create unique index if not exists idx_contas_pagar_recorrencia_grupo_data_unico
  on public.contas_pagar (igreja_id, recorrencia_grupo_id, data_vencimento)
  where recorrencia_grupo_id is not null;

commit;
