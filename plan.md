# OHEL ON — plano de faturamento e culto

## Faturamento mensal

- Um único plano comercial para cada igreja.
- Preço: R$ 80,00 por mês.
- Cobrança recorrente pela Stripe Checkout hospedada.
- O administrador da igreja inicia a assinatura dentro de Configurações > Faturamento.
- Cancelamento disponível a qualquer momento; o cancelamento padrão encerra no fim do período já pago.
- Cada assinatura é vinculada a uma única `igreja_id`.
- Webhooks Stripe atualizam o status no Supabase e são protegidos por assinatura HMAC da Stripe.
- O aplicativo não armazena dados de cartão.

## Palavra no Monitor de Mídia

- O Monitor de Mídia terá um bloco Palavra para buscar referências na API `bible-api.com` usando a tradução Almeida.
- O bloco exibirá a referência e o texto retornado, permitirá compor título, tema, pastor/preletor e esboço, e salvará o sermão na tabela existente `sermoes` vinculado à `igreja_id` autenticada.
- A ação Exibir na Projeção enviará referência, texto bíblico e blocos do esboço pelo canal Realtime `projecao-{igreja_id}`.
- A tela `/projecao` reconhecerá comandos de Palavra e exibirá seus slides sem interferir no fluxo de louvores.
- O padrão visual e o fluxo de criação reaproveitam o Banco de Sermões do Gabinete Pastoral.
- A API escolhida é adequada para consulta pontual: documenta a tradução Almeida, CORS e limite de uso; o aplicativo não fará download da Bíblia inteira.

## Estrutura principal

- `components/monitor/PalavraPanel.tsx`: busca bíblica, formulário de esboço, gravação em `sermoes` e comando de projeção.
- `app/(painel)/monitor-midia/page.tsx`: composição do bloco Palavra com o Monitor e envio Realtime.
- `app/projecao/page.tsx`: renderização de slides Palavra e louvor.
- `app/(painel)/gabinete/sermoes/page.tsx` e `app/(painel)/gabinete/sermoes/novo/page.tsx`: biblioteca e formulário completo de sermões.
- `lib/billing-server.ts`: autenticação administrativa, cliente Stripe, produto/preço, cliente e sincronização.
- `app/api/billing/route.ts`: leitura do status e criação do Checkout Session.
- `app/api/billing/cancel/route.ts`: cancelamento ou reativação no fim do período.
- `app/api/billing/portal/route.ts`: portal Stripe para dados de pagamento e faturas.
- `app/api/webhooks/stripe/route.ts`: webhook assinado e idempotente.

## Variáveis necessárias em produção

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID` (opcional; sem ele o backend cria/reutiliza o preço pelo metadata)
- `NEXT_PUBLIC_APP_URL=https://www.ipocloud.com.br`

## Direção visual

O OHEL ON mantém um painel SaaS escuro, seguro e pastoral. A Palavra usa âmbar para diferenciar o momento da pregação dos louvores em azul, sem alterar o restante do Monitor.
