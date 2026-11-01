# Faturamento OHEL ON — plano mensal

## Requisitos confirmados

- Um único plano comercial para cada igreja.
- Preço: R$ 80,00 por mês.
- Cobrança recorrente pela Stripe Checkout hospedada.
- O administrador da igreja inicia a assinatura dentro de Configurações > Faturamento.
- Cancelamento disponível a qualquer momento; o cancelamento padrão encerra no fim do período já pago.
- Cada assinatura é vinculada a uma única `igreja_id`.
- Webhooks Stripe atualizam o status no Supabase e são protegidos por assinatura HMAC da Stripe.
- O aplicativo não armazena dados de cartão.

## Decisões de implementação

- A tabela `billing_subscriptions` guarda o estado comercial mínimo por igreja: cliente Stripe, assinatura, preço, status, renovação, cancelamento programado e último estado de fatura.
- A tabela `billing_webhook_events` garante idempotência pelo `stripe_event_id`.
- Rotas server-side validam o Bearer token do Supabase e exigem `usuarios.role = 'admin'` antes de criar checkout, cancelar, reativar ou abrir o portal.
- O preço pode ser fornecido por `STRIPE_PRICE_ID`; se não for, o backend cria ou reutiliza o produto/preço marcado com metadata própria por R$ 80,00/mês.
- O cancelamento usa `cancel_at_period_end=true`, preservando o serviço até o fim do ciclo pago.
- A tela mostra o estado atual, data de renovação, pagamento pendente e ações de cancelar, reativar e abrir o portal Stripe.

## Estrutura do projeto

- `lib/billing-server.ts`: autenticação administrativa, cliente Stripe, produto/preço, cliente e sincronização.
- `app/api/billing/route.ts`: leitura do status e criação do Checkout Session.
- `app/api/billing/cancel/route.ts`: cancelamento ou reativação no fim do período.
- `app/api/billing/portal/route.ts`: portal Stripe para dados de pagamento e faturas.
- `app/api/webhooks/stripe/route.ts`: webhook assinado e idempotente.
- `app/(painel)/configuracoes/faturamento/page.tsx`: painel de cobrança.
- `SUPABASE_SQL_EDITOR_FATURAMENTO.sql`: tabelas, índices e RLS.

## Variáveis necessárias em produção

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID` (opcional; sem ele o backend cria/reutiliza o preço pelo metadata)
- `NEXT_PUBLIC_APP_URL=https://www.ipocloud.com.br`

## Direção visual

Três alternativas consideradas: painel SaaS financeiro discreto (0,68), cartão neon premium (0,04) e checkout minimalista branco (0,03). A escolha é o painel SaaS financeiro discreto, porque preserva a linguagem escura do OHEL ON, destaca o valor e deixa o estado da assinatura legível.

Princípios: estado financeiro sempre visível, CTAs com uma ação principal, linguagem em português do Brasil e mensagens que diferenciam pagamento pendente de cancelamento agendado. A paleta mantém azul OHEL para ação, verde para ativo, âmbar para atenção e vermelho somente para cancelamento. A interação usa confirmação antes de cancelar e retorna ao painel após o checkout.

Marca: OHEL ON deve parecer seguro, organizado e pastoral, sem transformar a tela de cobrança em uma página agressiva de vendas. Voz: “Seu sistema continua organizado; sua assinatura está ativa.” e “Você pode cancelar quando quiser. O acesso permanece até o fim do período já pago.”
