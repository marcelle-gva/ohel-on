# OHEL ON — plano de faturamento, culto e acesso de membros

## Faturamento mensal

O sistema mantém um plano único de R$ 80,00 mensais por igreja, com Stripe Checkout hospedado, cancelamento no fim do período pago, vínculo por `igreja_id`, webhooks assinados e sem armazenar dados de cartão. O administrador inicia a cobrança em Configurações > Faturamento.

## Palavra no Monitor de Mídia

O Monitor possui um navegador bíblico em três níveis — livro, capítulo e versículo — usando os endpoints de dados da tradução Almeida. Ao clicar em um versículo, a projeção é aberta e recebe todos os versículos do capítulo como slides, iniciando na seleção. As setas do teclado avançam e retornam entre os slides. O Monitor também permite preencher e salvar título, tema, pastor/preletor e esboço em `sermoes`.

## Acesso de membros

O pré-cadastro público continua sendo uma fila de aprovação: ele grava `membros.status = 'Pré-Cadastro'` e exige e-mail para que a pessoa possa acessar a área depois. A aprovação feita pela secretaria muda o status para `Ativo`.

Membros não entram no login administrativo, não precisam de registro em `usuarios` e não recebem acesso ao painel interno. Eles entram por `/login-membro`, informam o mesmo e-mail do cadastro e recebem um link seguro por e-mail via Supabase OTP. O callback valida o e-mail e o status `Ativo`, e então encaminha para `/area-membro`. A área inicial mostra o cadastro e dá acesso ao `/checkin`.

A política `SUPABASE_SQL_EDITOR_ACESSO_MEMBROS.sql` permite que um membro autenticado consulte somente o próprio registro ativo, comparando o e-mail da sessão com `membros.email`. A secretaria continua sendo responsável por aprovar o cadastro.

## Estrutura principal

- `components/monitor/PalavraPanel.tsx`: navegador bíblico, formulário de sermão e projeção.
- `app/(painel)/monitor-midia/page.tsx`: envio dos comandos Realtime do culto.
- `app/projecao/page.tsx`: renderização de slides de louvor e Palavra.
- `app/pre-cadastro/page.tsx`: fila pública de cadastro, agora com e-mail obrigatório.
- `app/login-membro/page.tsx`: solicitação do link de acesso do membro.
- `app/auth/membro/callback/page.tsx`: troca do código PKCE e validação do membro ativo.
- `app/area-membro/page.tsx`: área inicial do membro e acesso ao check-in.
- `SUPABASE_SQL_EDITOR_ACESSO_MEMBROS.sql`: política RLS do próprio registro ativo.

## Direção visual

O OHEL ON mantém uma interface escura, organizada e pastoral. A área do membro usa verde para indicar acesso pessoal e ativo, enquanto a Palavra usa âmbar para diferenciar a pregação dos louvores em azul.
