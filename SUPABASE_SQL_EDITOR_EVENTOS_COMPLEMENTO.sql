-- Complementos do cadastro e divulgação de eventos
-- Execute no Supabase SQL Editor.

alter table public.eventos
  add column if not exists usar_endereco_igreja boolean not null default false,
  add column if not exists preco_ingresso numeric(10,2),
  add column if not exists galeria_urls text[] not null default '{}',
  add column if not exists pregador_convidados text,
  add column if not exists informacoes_adicionais text;

comment on column public.eventos.usar_endereco_igreja is 'Quando true, usa o endereço cadastrado na igreja/congregação.';
comment on column public.eventos.preco_ingresso is 'Preço do ingresso em reais; nulo significa entrada gratuita ou preço não informado.';
comment on column public.eventos.galeria_urls is 'URLs das fotos adicionais do evento.';
comment on column public.eventos.pregador_convidados is 'Pregador, cantor, palestrante ou convidados do evento.';
comment on column public.eventos.informacoes_adicionais is 'Informações complementares exibidas aos participantes.';

alter table public.eventos
  drop constraint if exists eventos_preco_ingresso_check;

alter table public.eventos
  add constraint eventos_preco_ingresso_check
  check (preco_ingresso is null or preco_ingresso >= 0);
