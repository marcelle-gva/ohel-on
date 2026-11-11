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

## Ficha, doações e termos

- [x] Exibir na ficha administrativa e na ficha imprimível as receitas financeiras vinculadas ao membro, com categoria, descrição, data e total.
- [x] Criar a tela `/secretaria/credenciais/entrega` para registrar a entrega e os termos aceitos.
- [x] Versionar e guardar o texto integral de cada termo aceito, assinante, CPF, data/hora e responsável interno.
- [x] Criar modelos de termo para credencial, doação de bem móvel, LGPD, imagem de adulto e autorização específica para criança/adolescente.
- [ ] Executar `SUPABASE_SQL_EDITOR_TERMOS_CREDENCIAIS.sql` no Supabase.
- [ ] Revisar os modelos com advogado e preencher os dados oficiais da igreja, canal de privacidade e prazos.

## Histórico dos cultos

- [x] Criar sessões de culto com tipo fixo, título, data/hora, link do culto ao vivo, observações, status aberto/encerrado e igreja isolada.
- [x] Criar buscador de cultos por título, tipo e link, com abertura do diário da celebração.
- [x] Registrar automaticamente, enquanto a sessão estiver aberta, envios de louvores, pedidos de oração, check-ins por QR/GPS, visitantes, visitas e sermões.
- [x] Registrar no diário as palavras e louvores enviados para projeção no Monitor de Mídia.
- [x] Exibir a quantidade, horário, tipo, título e resumo dos registros de cada culto.
- [ ] Executar `SUPABASE_SQL_EDITOR_HISTORICO_CULTOS.sql` no Supabase antes de iniciar as sessões.

## Cestas básicas e doações

- [x] Criar campanhas de cesta com itens, quantidade necessária e unidade, mostrando automaticamente o que falta.
- [x] Criar área administrativa para cadastrar campanhas, itens, responsáveis e acompanhar reservas.
- [x] Criar área do membro autenticado para visualizar campanhas abertas e marcar a quantidade que pretende doar.
- [x] Proteger a reserva no banco com operação atômica para impedir que dois membros reservem além do estoque necessário.
- [x] Notificar o doador autorizado e os responsáveis cadastrados por WhatsApp quando uma reserva for criada, sem expor o token Meta no navegador.
- [ ] Executar `SUPABASE_SQL_EDITOR_CESTAS_BASICAS.sql` no Supabase e cadastrar um modelo aprovado na Meta para habilitar os envios.

## WhatsApp na aprovação de membros

- [x] Aprovar o pré-cadastro via API server-side e enviar o link `/login-membro` ao membro autorizado.
- [x] Registrar consentimento específico de WhatsApp no pré-cadastro.
- [ ] Criar/aprovar na Meta o template `membro_aprovado` e configurar as variáveis na Vercel.

## Layout do dashboard IPO CLOUD

- [x] Compactar os cards, formulários e espaçamentos de `/ipocloud` sem alterar as permissões ou as APIs existentes.
- [x] Permitir rolagem vertical de toda a página em telas baixas e celulares, sem cortar campos, botões ou a lista de clientes e sem rolagem horizontal.
- [x] Preservar a aparência e o comportamento das demais páginas do sistema.

## Pré-cadastro de membros pelo QR Code

- [x] Permitir preencher todos os campos em celulares e telas baixas, sem cortes ou rolagem horizontal.
- [x] Exibir `Prosseguir` nas etapas Dados Pessoais e Endereço, `Voltar` nas etapas seguintes e `Finalizar Pré-Cadastro` na última etapa.
- [x] Manter a barra de navegação visível enquanto os campos rolam e preservar dados, senha e foto ao trocar de aba.
- [x] Validar nome, telefone, e-mail, senha e confirmação antes de avançar e exigir o aceite de privacidade para enviar, sem perder os dados em caso de erro.

## Outros formulários abertos por QR Code

- [x] Revisar e corrigir cortes, rolagem e botões inacessíveis nos formulários de Kids & Teens, orações, louvores, check-in, eventos e sorteios (incluindo acompanhamento).
- [x] Manter campos, botões de envio e mensagens de resultado acessíveis em celular, telas baixas e modo horizontal; preservar as regras de autenticação, consentimentos, pagamentos e envio de cada fluxo.
- [x] Verificar a navegação entre etapas quando existir, sem criar etapas desnecessárias em formulários de página única nem alterar links de QR Code já distribuídos.

## Entrada do membro, Monitor online e permissões

- [x] O membro aprovado entra pelo login de membros e vê por padrão o Monitor online da sua igreja; cadastro pendente ou inativo não tem acesso.
- [x] O canto superior direito mostra foto (ou avatar substituto), acesso para editar os próprios dados e trocar a foto, e botão Sair; preservar check-in e cestas pessoais.
- [x] O menu lateral apresenta os módulos autorizados pelo grupo atribuído pela igreja, sem conceder permissões automaticamente pelo cargo eclesiástico ou departamento declarado. Impedir renderização de módulos não autorizados ao abrir URL diretamente.
- [x] No pré-cadastro a pessoa informa se tem cargo eclesiástico, qual cargo ou que ainda não possui; o dado vai para sua ficha, sem alterar role/grupo/permissões da conta.
- [x] Membros aprovados ficam disponíveis para atribuição de grupos pela igreja; preservar os perfis administrativos existentes e o isolamento por igreja.
- [x] O Monitor de membros não retorna pré-cadastros, orações pendentes, telefones de visitantes, dados financeiros ou de outras igrejas; mantém avisos, repertório, orações aprovadas e informações publicadas do culto.
- [ ] Ativar os vínculos, provisionamento e policies em produção executando `SUPABASE_SQL_EDITOR_MEMBRO_MONITOR.sql` no Supabase correto. O código, fluxo visual e autorização foram validados com dados fictícios; a migration foi executada e reaplicada apenas em PostgreSQL isolado em memória, não em produção.

## Erro ao finalizar o pré-cadastro

- [x] Corrigir a falha reportada ao finalizar o pré-cadastro, identificando a causa real sem criar cadastros de teste no banco de produção. Correção pontual do trigger aplicada no Supabase em 06/11/2026; definição conferida com os três indicadores verdadeiros.
- [x] Tratar erros do Supabase em objeto, informar a etapa da falha com segurança e registrar código técnico sem senha ou dados pessoais; manter os dados preenchidos no formulário para nova tentativa.

## Pedido de oração pelo membro autenticado

- [x] Permitir ao membro aprovado enviar seu pedido de oração sem sair da conta, com status Pendente e destino limitado à própria igreja; envio pelo QR Code sem login e pelo administrador continua disponível.
- [x] Não conceder leitura de pedidos privados, edição, exclusão ou aprovação ao membro básico; preservar a regra de decisão pelo grupo Liderança e manter os dados preenchidos quando houver falha.

## Dashboard próprio do membro e convite ao visitante

- [x] Transformar `/area-membro` em dashboard pessoal independente, mostrando conteúdos publicados do culto sem alterar o Monitor de Mídia, projeção, tela cheia, histórico ou recursos já ajustados.
- [x] Preservar login e aprovação, foto, edição do perfil, saída, pedidos de oração autenticados, check-in, cestas e módulos do menu autorizados por grupos; cargo/departamento não concedem acessos.
- [x] Organizar saudação, ações rápidas, culto em andamento quando houver, avisos/eventos com busca/filtro/expansão, resumo e todas as fotos ampliáveis, orações aprovadas, repertório e Palavra em blocos compactos, responsivos e sem cortes.
- [x] Oferecer no bloco Visitantes o endereço oficial e mapa da própria igreja, convite preparado para WhatsApp e cópia da mensagem; não enviar automaticamente nem expor nome/telefone de visitantes, não inventar endereço ausente.
- [x] Manter seleção de dados segura no servidor, isolamento por igreja, atualização visível sem requisições sobrepostas e feedback de carregamento/erro/cópia; usar estilos exclusivos sem regredir as demais páginas.
