# OHEL ON — plano de faturamento, culto, membros e proteção documental

## Faturamento mensal

O sistema mantém um plano único de R$ 80,00 mensais por igreja, com Stripe Checkout hospedado, cancelamento no fim do período pago, vínculo por `igreja_id`, webhooks assinados e sem armazenar dados de cartão.

## Palavra no Monitor de Mídia

O Monitor possui navegação bíblica por livro, capítulo e versículo usando a tradução Almeida. A projeção recebe o capítulo como slides e inicia no versículo escolhido, com navegação por teclado. O Monitor também permite criar e salvar o sermão.

## Acesso de membros

O pré-cadastro público grava a fila com status `Pré-Cadastro`. Após aprovação, o membro entra por `/login-membro` com link seguro enviado ao e-mail cadastrado e chega a `/area-membro`, separado do painel administrativo.

## Histórico de doações e termos

O histórico de contribuições deve reutilizar `transacoes.membro_id`, filtrando receitas vinculadas ao membro e exibindo data, valor, descrição/categoria e total na ficha de cadastro e na ficha imprimível.

A entrega de credenciais passa a registrar aceites em `termos_aceites`. Cada registro guarda igreja, membro, tipo, versão, texto integral do termo, nome e CPF do assinante, data/hora e usuário responsável pela entrega. Os modelos ficam em `docs/TERMOS_CREDENCIAIS_DOACOES_IMAGEM.md` e devem ser revisados por advogado antes do uso.

Os termos devem preservar as exceções legais. Um aceite pode comprovar a doação, a entrega e a informação fornecida, mas não torna automaticamente uma doação irrevogável, não elimina direitos da LGPD e não substitui o consentimento específico do responsável para dados e imagem de crianças.

## Histórico dos cultos

Cada celebração é uma sessão em `culto_sessoes`, com tipos fixos como domingo, quarta-feira, oração, ceia e especial. A tela `/monitor-midia/historico-cultos` inicia ou encerra a sessão, guarda o link do ao vivo e permite pesquisar cultos anteriores.

A tabela `culto_registros` funciona como diário append-only para os eventos da sessão. Triggers `SECURITY DEFINER` associam automaticamente novos registros de `louvores`, `pedidos_oracao`, `checkins`, `visitantes`, `visitas` e `sermoes` ao culto aberto. O Monitor grava explicitamente as projeções de Palavra e louvor. A associação é feita pela `igreja_id` e pela sessão aberta mais recente, evitando mistura entre igrejas.

## Cestas básicas

As campanhas ficam em `cestas_basicas` e seus itens em `cesta_itens`. A Área do Membro permite apenas campanhas abertas e envia a reserva para `/api/cestas/reservar`, que valida a sessão, chama a função atômica `reservar_item_cesta` e só então dispara notificações server-side. Responsáveis ficam em `cestas_responsaveis`; as reservas e o estado de cada notificação ficam em `cesta_doacoes`. A API usa um template transacional aprovado pela Meta e não envia nada se as credenciais ou o consentimento do doador não estiverem disponíveis.
