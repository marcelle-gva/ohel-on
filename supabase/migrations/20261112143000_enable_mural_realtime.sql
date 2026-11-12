-- Enable Realtime changes for the shared church mural feeds.
-- Existing row-level security remains the access boundary; clients also scope by igreja_id.
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.comunicacoes,
  public.eventos,
  public.pedidos_oracao;
