# Ohel On — QR Codes, financeiro, sorteios, cestas e orações

## Onde usar

Na Secretaria, as listas de **Congregados** e **Visitantes** agora oferecem o botão **QR Code** ao lado do novo cadastro. As páginas permitem abrir, copiar e baixar o QR Code. O QR de visitante reutiliza `/visitante/:igrejaId`; o de congregado leva ao pré-cadastro `/congregado/:igrejaId`. Ambos usam a origem pública configurada em `lib/public-site.ts`, com padrão `https://www.ipocloud.com.br`, não a origem interna do Preview. O pré-cadastro não cria conta nem concede grupos, cargos ou permissões.

O dashboard administrativo e a movimentação financeira usam `/api/financeiro/resumo`. **Saldo nas contas** é a soma do saldo inicial e dos lançamentos vinculados às contas; **movimento do mês** é somente receita menos despesa do período. Saldo inicial não vira receita. Contas a pagar são previsão/status, sem duplicar a transação gerada pela baixa. Erros de consulta são mostrados como erro/traço, não como saldo zero. Nenhum saldo histórico é ajustado automaticamente. O schema atual aceita transações Receita/Despesa; não há transferência bancária identificada por origem/destino, e nenhuma transferência foi inventada por descrição.

Em **Sorteios**, o botão **Números e vendedores** abre `/sorteios/:id`. O admin pode atribuir membro vendedor ativo da própria igreja a um número ocupado e cadastrar números vendidos manualmente, dentro da faixa e sem sobrescrever números já ocupados. O registro manual mantém `origem=manual`, `status=reservado` e pagamento manual não informado: não gera transação financeira e não confirma recebimento automaticamente. A mesma tela permite enviar uma foto JPEG, PNG ou WebP de até 8 MB, validada pelo conteúdo real e salva no bucket Supabase `cartazes`.

O dashboard pessoal recebe **Sorteios ativos** com dados públicos da própria igreja, imagem, valor do número, prazo e acesso à compra pública existente. Não mostra nomes, contatos, comprovantes ou vendedores dos compradores. Sorteios encerrados, pausados ou com data passada não são oferecidos no card.

Em **Cestas Básicas**, a campanha informa quantas cestas serão montadas. Cada item tem quantidade por cesta e meta total. Sugestões combinam itens anteriores da própria igreja e opções básicas; selecionar uma sugestão apenas preenche o formulário. Nome, unidade e quantidade podem ser editados. As operações de criação, edição, recálculo de campanha e exclusão usam transações/locks no banco. A meta não pode ficar abaixo do reservado/entregue, e um item com qualquer histórico de doação não é excluído. Campanhas antigas recebem quantidade de cestas igual a 1, sem alterar metas; um item antigo precisa ter a quantidade por cesta informada antes de aumentar a quantidade de cestas.

O dashboard de membro mostra **Orações da igreja**, histórico, novas publicações e controle de leitura. Só pedidos com o status e a visibilidade públicos usados pelo mural são compartilhados. Pedidos privados ou pendentes de outras pessoas não são notificados. Aprovações posteriores são detectadas por IDs, mesmo que o pedido tenha data antiga. O navegador guarda somente IDs vistos/lidos por usuário, membro e igreja, nunca o texto dos pedidos. A primeira abertura apresenta o histórico sem inundar avisos. Ao perder autorização, o conteúdo é limpo.

## Imagem opcional por IA

O botão **Gerar imagem com IA** chama apenas o servidor autenticado e somente por ação explícita do administrador. Usa o catálogo do ImageService, sem modelo fixado, e persiste a imagem antes de atualizar o sorteio. O prompt não usa dados de compradores. Falhas preservam a foto anterior.

Na hospedagem Vercel original, o provedor precisa estar configurado com credenciais próprias e autorizadas no servidor. As variáveis esperadas pelo adaptador são `MANUS_API_URL` e `MANUS_API_KEY`. Não copiar as credenciais temporárias do Sandbox para a Vercel, não usar `NEXT_PUBLIC_*` e não inseri-las no Git. Sem configuração, o botão mostra indisponibilidade explícita; upload normal continua disponível. Não foi realizada geração paga durante esta entrega. O cooldown local é uma proteção contra clique repetido, não um limite distribuído entre instâncias da Vercel.

## Banco e validação

As ampliações ficam em `supabase/migrations/20261113164700_sorteios_vendedores_imagem.sql` e `20261113164800_cestas_campanhas_quantidades.sql`. São aditivas/idempotentes, preservam as APIs públicas anteriores e restringem as novas RPCs às identidades administrativas/servidor apropriadas. Não requerem migração financeira nem reescrita de registros históricos.

A rodada passou por 59 testes Node isolados, TypeScript e lint direcionado sem erros. Os testes PostgreSQL são executados com `bash tests/migrations.integration.sh`, que usa explicitamente socket local, banco temporário e dados fictícios; ele testa DDL reaplicável, compatibilidade legada, metas, reservas, exclusão, faixa/duplicação de números e isolamento do vendedor. O banco fictício é removido ao final. O build e a revisão de integração são registrados na conclusão desta entrega.

As duas migrações foram aplicadas com sucesso no projeto Supabase de produção em 13/11/2026, após aprovação dos testes PostgreSQL 16 locais. As seis colunas novas e os privilégios das cinco RPCs foram confirmados por metadados: cestas somente `service_role`; números manuais somente sessão autenticada com validação adicional de admin/igreja na função. O build de produção passou, o lint focado terminou com zero erros e cinco avisos, e a revisão somente leitura confirmou a integração. A limpeza de orações na perda de autorização foi revalidada após a correção. O manifesto contém 127 páginas reais, sem APIs.

Não houve teste autenticado ponta a ponta com contas reais: o ambiente de desenvolvimento não tem a chave privada Supabase do servidor. Nenhum registro pessoal ou financeiro de produção foi usado como teste. A integração WhatsApp existente foi preservada, mas o envio real não foi disparado para validação.
