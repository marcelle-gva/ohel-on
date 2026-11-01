# Entregas do projeto

## Faturamento mensal

- [x] Criar no Supabase as tabelas `billing_subscriptions` e `billing_webhook_events`, com índice único por igreja e RLS sem acesso direto a eventos.
- [x] Implementar o plano único de R$ 80,00 mensais em Stripe Checkout, mantendo `STRIPE_PRICE_ID` opcional para reutilizar um preço já criado.
- [x] Vincular checkout, cliente e assinatura à `igreja_id` autenticada e exigir `usuarios.role = 'admin'` nas rotas server-side.
- [x] Processar os eventos de assinatura Stripe com validação de assinatura e idempotência.
- [x] Disponibilizar a tela `/configuracoes/faturamento` com status, renovação, cancelamento no fim do período, reativação e portal Stripe.
- [ ] Registrar em Vercel as variáveis de produção e cadastrar o webhook no Stripe.
- [ ] Executar `SUPABASE_SQL_EDITOR_FATURAMENTO.sql` no projeto Supabase correto.

## Culto e Monitor de Mídia

- [x] Manter o fluxo atual do repertório: louvores do dia, edição, exclusão, comandos de slide, transposição e abertura da projeção.
- [x] Criar no Monitor um navegador bíblico por lista de livros, capítulos e versículos usando a API Almeida.
- [x] Ao clicar em um versículo, abrir a tela `/projecao` e enviar o capítulo como slides, iniciando no versículo escolhido.
- [x] Permitir avançar e voltar pelos versículos com as setas do teclado na projeção.
- [x] Dar mais espaço à lista de livros, organizar os livros por Antigo e Novo Testamento e manter o formulário acessível somente pelo botão `Criar sermão`.
- [x] Permitir preencher título, tema, pastor/preletor e esboço no próprio Monitor.
- [x] Salvar a mensagem na tabela `sermoes` vinculada à `igreja_id` da sessão.
- [x] Enviar referência, texto e blocos do esboço para `/projecao` em tempo real.
- [x] Fazer `/projecao` reconhecer Palavra e louvor sem conflitar os dois modos.
- [ ] Testar no culto com duas abas reais: Monitor de Mídia e tela de projeção.

## Acesso de membros

- [x] Confirmar que o pré-cadastro grava somente `membros` com status `Pré-Cadastro` e não cria acesso automaticamente.
- [x] Exigir e-mail no pré-cadastro para permitir acesso posterior do membro.
- [x] Criar `/login-membro` com envio de link seguro por e-mail via Supabase OTP.
- [x] Criar `/auth/membro/callback` para validar o código e permitir somente membros com status `Ativo`.
- [x] Criar `/area-membro` separado do painel administrativo, com acesso ao `/checkin`.
- [ ] Executar `SUPABASE_SQL_EDITOR_ACESSO_MEMBROS.sql` no Supabase para liberar a leitura do próprio registro ativo via RLS.
