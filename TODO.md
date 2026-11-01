# Entregas do faturamento mensal

- [x] Criar no Supabase as tabelas `billing_subscriptions` e `billing_webhook_events`, com índice único por igreja e RLS sem acesso direto a eventos.
- [x] Implementar o plano único de R$ 80,00 mensais em Stripe Checkout, mantendo `STRIPE_PRICE_ID` opcional para reutilizar um preço já criado.
- [x] Vincular checkout, cliente e assinatura à `igreja_id` autenticada e exigir administrador da igreja nas rotas server-side.
- [x] Processar `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed` com assinatura Stripe e idempotência.
- [x] Disponibilizar a tela `/configuracoes/faturamento` com valor, status, próxima renovação, cancelamento no fim do período, reativação e portal Stripe.
- [x] Adicionar o acesso ao faturamento nas configurações e ajustar o rótulo do plano no cabeçalho.
- [ ] Registrar em Vercel as variáveis de produção e cadastrar `https://www.ipocloud.com.br/api/webhooks/stripe` no Stripe.
- [ ] Executar `SUPABASE_SQL_EDITOR_FATURAMENTO.sql` no projeto Supabase correto.
