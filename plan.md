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

## Dashboard próprio do membro — atualização de UX

A entrada `/area-membro` deixa de ser apresentada como Monitor online e torna-se o dashboard pessoal do membro aprovado. Mantém conteúdos publicados e serviços criados, mas organiza a experiência para participar da igreja, e não operar o culto. O Monitor de Mídia administrativo, sua tela cheia, projeção, Bíblia, repertório e histórico ficam intactos. Login, aprovação, foto, edição do próprio perfil, saída e módulos autorizados por grupos permanecem. Cargo e departamento declarados não concedem acesso.

### Hierarquia dos blocos

A primeira área mostra saudação com primeiro nome, igreja e três atalhos claros: Pedir oração, Fazer check-in e Contribuir com cestas. Foto, edição e saída continuam no cabeçalho; o menu chama a entrada de Meu dashboard. Um destaque de culto em andamento aparece somente se houver sessão aberta, com assistir ao vivo quando existir URL válida.

A coluna principal reúne avisos e eventos publicados em cartões compactos, capa proporcional, título e resumo. Filtros Todos/Eventos/Avisos, busca por texto e Mostrar mais mantêm toda a lista disponível sem uma parede de cards. Ao clicar, abre resumo completo, convidados, preço, informações adicionais, todas as fotos ampliáveis e inscrição do evento. Não reduzir nem apagar dados ao resumir visualmente.

Visitantes torna-se um bloco de acolhimento: quantidade agregada recebida hoje, nome e endereço oficial da igreja. Abrir mapa usa Google Maps com o endereço cadastrado, sem localização pessoal ou chave de API. Convidar no WhatsApp prepara mensagem com nome, endereço e mapa; o membro escolhe o destinatário e confirma o envio no próprio WhatsApp. Copiar convite é a alternativa para qualquer canal, com confirmação acessível e texto selecionável em caso de falha. Não mostrar nomes/telefones de visitantes. Se o endereço estiver ausente, pedir que a secretaria o complete, sem inventar mapa nem compartilhar endereço incompleto.

Orações publicadas mostram somente pedidos aprovados, com atalho para envio e expansão progressiva. Repertório e Palavra ficam sob Acompanhe o culto, com navegação entre trechos e expansão dos conteúdos longos. O dashboard apenas lê: não aprova, edita, exclui nem projeta. Perfil, check-in e cestas continuam nos fluxos já protegidos.

### Design e interação

Reutilizar a marca OHEL ON: fundo azul-marinho, superfícies escuras, azul para ações principais, verde para transmissão, acentos suaves de acolhimento e oração. Cards menores com hierarquia legível, sem números gigantes nem excesso de brilhos. Desktop usa coluna principal mais larga e coluna secundária de acolhimento/cuidado; celular segue ordem linear, ações prioritárias primeiro e rolagem vertical da página. Botões com toque confortável, foco visível, títulos que quebram e detalhes expansíveis. Galeria preserva imagem inteira com object-contain, botão fechar, Escape, restauração de foco e navegação acessível. Nenhuma imagem decorativa ou biblioteca nova.

Carregamento discreto, falha com tentativa de atualizar e preservação dos conteúdos em indisponibilidade temporária; limpar os dados ao perder autorização. Atualização periódica apenas com aba visível e sem sobreposição de requisições. Filtros, expansão e Palavra não reiniciam a cada atualização. Links externos usam protocolos seguros, e nenhum convite é enviado automaticamente.

### Estrutura e integração

`app/area-membro/page.tsx` mantém a rota inicial do login e renderiza o novo dashboard de `components/member/`. Os estilos ficam isolados em `app/area-membro/dashboard.module.css`, sem mudança global. `app/api/membros/dashboard/route.ts` oferece o contrato `DashboardMembroData` de `lib/member-dashboard.ts`: autenticação e aprovação no servidor, seleção explícita de conteúdos publicados e endereço institucional da própria igreja. O endpoint atual `/api/membros/monitor` permanece compatível, e o Monitor administrativo não é alterado.

Ajustar apenas os rótulos do menu e links de retorno pessoal para Meu dashboard. Reutilizar as APIs/páginas de oração autenticada, perfil, check-in e cestas sem modificar seus fluxos. O endereço vem de `igrejas.endereco`, já editável em Configurações: não requer migration nova. Informações financeiras, contatos de visitantes e pedidos pendentes não entram no dashboard.

As listas são consultadas em páginas de 100 registros no servidor até completar os conteúdos publicados, sempre com filtro da igreja, ordenação estável e limite temporal da consulta. O botão Mostrar mais expande a lista completa recebida, sem truncamento silencioso. O detalhe do evento mantém início, término e horário de abertura. Imagens e transmissão externas só aceitam HTTPS.

## Ampliação de QR Codes, finanças, sorteios, cestas e notificações

Reutilizar primeiro as páginas públicas e componentes de QR Codes de congregados/visitantes existentes. Os QR Codes continuam vinculados à igreja e usam o domínio oficial, sem duplicar cadastros ou conceder acesso administrativo.

O financeiro passa a compartilhar a fonte dos dados entre movimentação e indicadores administrativos. Saldos de contas, valores iniciais, receitas/despesas e transferências permanecem conceitos separados; não criar correções de registros reais automaticamente. Consultas/erros e filtros precisam refletir o fluxo atual, sempre com autorização por módulo e igreja.

Cada sorteio mantém a compra pública atual e ganha gestão administrativa de vendedor por número, registro manual protegido contra conflito, foto enviada e geração de imagem opcional. As imagens devem ser validadas e persistidas em storage; a geração depende de provedor configurado no servidor e nunca pode expor chaves ou usar credenciais do sandbox na Vercel. O dashboard dos membros recebe um componente independente com somente sorteios ativos e informações públicas da própria igreja.

Campanhas de cestas incluem quantidade de cestas e totais de itens explicitamente calculados. Sugestões vêm da história da própria igreja e de opções básicas; edição preserva as reservas/doações e não permite diminuir a necessidade abaixo dos compromissos existentes. Migrações necessárias serão aditivas e compatíveis com campanhas legadas.

Notificações pessoais de oração seguem os mesmos critérios de publicação e privacidade do mural. Um pedido pendente de outra pessoa não pode aparecer para o membro. Controlar IDs lidos por conta/membro/igreja, avisar aprovações posteriores e evitar notificações repetidas em foco/atualização. Novos blocos ficam em `components/member/`, estilos isolados e APIs privadas específicas; o pai integra os componentes no dashboard existente, sem alterar os recursos do culto e do cuidado pastoral.

## Terceira rodada — programação e Culto no Lar

No Histórico de Cultos, a programação fixa já cadastrada ganha edição de nome, tipo, dia e intervalo de horários, além das ações existentes de pausa/reativação. Alterações valem para ocorrências futuras e preservam os diários anteriores e a sessão em andamento. A programação anual terá espaço próprio no mesmo Histórico, com filtro por ano, data, título, tipo, horários e observações; poderá ser cadastrada e editada pela gestão autorizada, separada da recorrência semanal.

Culto no Lar terá um mural próprio acessível pelo dashboard do membro. Um membro ativo poderá enviar identificação da casa/família (sem endereço pessoal obrigatório), data, Palavra ministrada e foto. O envio nasce pendente: somente o autor e a liderança autorizada da igreja o consultam. Após aprovação, texto e foto aparecem aos membros da mesma igreja, não ao público mundial. A liderança pode aprovar/rejeitar; mudanças do autor em conteúdo aprovado exigem nova revisão. Identidade e igreja são derivadas da sessão, sem permissões conferidas por cargo declarado.

Reutilizar Next.js, Supabase e o design escuro do projeto. Fotos ficam em bucket privado e são entregues somente após autorização. APIs em `app/api/`, regras/DTOs em `lib/`, componentes em `components/culto-lar/`, integração pontual no dashboard e no Histórico, e migrações aditivas em `supabase/migrations/`. Manter a hospedagem original Vercel/IPOCLOUD e publicar via GitHub autorizado, sem outra implantação pública. Preservar finanças, sorteios, oração, cestas e atendimento pastoral.

Usar limite conservador de 4 MiB por foto no formulário e no servidor, reservando margem para o restante do formulário multipart na implantação original. Manter JPEG, PNG e WebP e remover metadados da imagem antes de armazenar.
