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

## QR Code público de Kids & Teens

- [x] Gerar o QR Code e o link de Kids & Teens com o domínio público HTTPS configurado em `NEXT_PUBLIC_APP_URL` (IPO CLOUD como padrão), sem copiar endereços temporários ou protegidos da Vercel da barra do navegador.
- [x] Preservar a identificação da igreja, o formulário público, o consentimento do responsável e os controles de acesso internos; validar a abertura sem login e avisar que QR Codes antigos com endereço temporário devem ser substituídos.

## Nuvem da página inicial

- [x] Comparar e corrigir a nuvem da página inicial para ficar igual à referência anexada: cúpula arredondada, laterais amplas, contorno azul fino e brilho suave, com o logo metálico e suas proporções preservados. Arte reaproveitada da própria referência, sem redesenhar a marca.
- [x] Preservar os textos, botões, navegação, demais seções, logos compartilhados e funcionalidades do site; manter a arte inteira e sem distorção em desktop e celular. Conferido em 1560 px e 390 px, sem rolagem horizontal; TypeScript sem erros e ESLint sem erros (somente três avisos anteriores à alteração).

## Aniversariantes no dashboard administrativo

- [x] Usar `membros.data_nascimento` do cadastro, comparando dia e mês (independentemente do ano de nascimento) com a data atual de São Paulo; ignorar datas ausentes, inválidas ou futuras e preservar membros ativos da própria igreja. Criação, edição, pré-cadastro, aprovação e perfil rastreados; 13 testes passaram, inclusive sob outro fuso horário.
- [x] Mostrar claramente o total de aniversariantes de hoje e seus nomes no dashboard de admin, com acesso ao cadastro; distinguir carregamento, ausência de aniversariantes e falha de consulta, sem apresentar erro como zero. Interface do build de produção conferida com autenticação/membros fictícios em cenários de lista, ausência, erro e recuperação, sem alterar cadastros reais.
- [x] Não omitir membros por limite de 1.000 registros; atualizar ao mudar o cadastro/status, ao retornar à aba e na virada da data, sem requisições sobrepostas; preservar demais KPIs, permissões e fluxos de cadastro. Paginação validada com 1.505 membros; consulta de nomes limitada a admin, atualização por foco conferida e build, TypeScript e ESLint aprovados.

## Conclusão: aniversariantes e cuidado pessoal do membro

- [x] Adicionar os filtros “Hoje” e “Do mês”, com total, nomes e datas correspondentes, preservando paginação, São Paulo, atualização e demais KPIs.
- [x] Permitir ao membro ativo solicitar atendimento pelo dashboard, acompanhar status e confirmação da liderança e cancelar somente atendimento próprio ainda em aberto, preservando os estados existentes.
- [x] Permitir registrar e atualizar como está se sentindo e acompanhar seu histórico emocional, reutilizando o fluxo existente.
- [x] Não retornar observações sigilosas ao membro; derivar identidade e igreja da sessão, impedir acesso cruzado entre membros e igrejas e preservar permissões por papel e grupo.
- [x] Concluir edição com carregamento, validação, persistência e transições de estado e os caminhos incompletos da equipe autorizada; preservar criação para membros e visitantes.
- [x] Preservar perfil, foto, oração, check-in, cestas, culto, avisos e convites, com erros, carregamento e layout responsivo; revisar a integração por agente somente leitura e verificações automatizadas.

Evidências em 13/11/2026: 32 testes isolados aprovados, TypeScript e build de produção aprovados, ESLint sem erros nos arquivos afetados (somente aviso anterior de imagem no mural), revisão somente leitura concluída e combinação Realizado/responsável pendente corrigida. Schema e policies existentes conferidos somente por metadados, sem alterações no banco. Teste autenticado ponta a ponta não executado no sandbox por ausência da chave privada do servidor; nenhuma conta ou registro real foi criado para testar.

## QR Codes, movimentação, sorteios, campanhas e notificações

- [x] Verificar se já existem QR Codes do congregado e do visitante antes de criar; reutilizar os fluxos e disponibilizar acesso aos QR Codes com o domínio público correto e identificação da própria igreja.
- [x] Corrigir o dashboard administrativo zerado e a página de movimentação vazia para refletir contas bancárias e o fluxo financeiro existente; separar saldo inicial de receitas, despesas efetivas de contas pendentes e transferências de arrecadação, com escopo por igreja e erros distintos de zero, sem ajustes silenciosos em registros reais.
- [x] Disponibilizar em cada sorteio uma lista para o admin atribuir o membro que vendeu cada número; permitir cadastrar números vendidos manualmente dentro da faixa válida, sem duplicar ou sobrescrever vendas/reservas online e sem registrar recebimento financeiro automaticamente.
- [ ] Adicionar upload de foto do sorteio e botão opcional de IA para gerar imagem, com autorização administrativa, validação/persistência de arquivo, preservação da imagem anterior em falha e erro claro se o provedor não estiver configurado.
- [x] Exibir no dashboard dos membros os sorteios ativos da própria igreja, com informações públicas e link ao fluxo existente, sem expor compradores ou dados pessoais de venda.
- [x] Sugerir itens anteriormente cadastrados da própria igreja e opções básicas nas novas campanhas de cesta; permitir editar item/quantidade e cadastrar quantidade de cestas por campanha, com totais explícitos e proteção contra reduzir abaixo das quantidades reservadas/doadas, preservando reservas atômicas.
- [x] Notificar no dashboard dos membros cada oração apta à divulgação segundo o fluxo existente: pedidos aprovados/publicados da própria igreja, sem expor pedidos privados ou pendentes de outras pessoas; impedir avisos duplicados e permitir controlar leitura por membro/igreja.
- [x] Integrar os novos componentes sem regredir os recursos existentes e confirmar tipos, testes isolados, build e permissões por revisão somente leitura; não criar dados de teste em produção.

Evidências em 13/11/2026: 59 testes isolados aprovados, TypeScript e build de produção aprovados, lint dos 48 arquivos TypeScript/JavaScript tocados sem erros (5 avisos), manifesto completo com 127 páginas e HTTP 200. Migrações de sorteios/cestas aplicadas com sucesso no Supabase, após execução e reaplicação em PostgreSQL 16 local descartável com dados fictícios; colunas e privilégios confirmados por metadados. Nenhum registro pessoal/financeiro real usado para testes ou ajuste de saldo. Revisão somente leitura confirmou os fluxos; limpeza das notificações ao perder autorização corrigida e revalidada.

No item de imagem, upload e botão/endpoint IA estão implementados. A geração efetiva na Vercel original continua pendente de configuração autorizada de provedor server-side e validação real; nenhuma credencial do Sandbox foi exportada e nenhuma geração paga foi feita. Teste autenticado ponta a ponta não executado por ausência da chave privada Supabase no ambiente de desenvolvimento. Detalhes em `docs/segunda-rodada.md`.

## Terceira rodada — Histórico de Cultos e Culto no Lar
- [x] Permitir editar uma programação fixa adicionada no Histórico de Cultos: nome, tipo, dia e horários, com cancelamento da edição, validação de intervalo/sobreposição e preservação dos cultos anteriores e em andamento.
- [x] Ter um espaço para adicionar programação anual no Histórico de Cultos, com seleção de ano, data, título/tipo, horários e observações; permitir edição e manter a agenda anual separada da recorrência semanal, com autorização da gestão da própria igreja.
- [x] Disponibilizar uma área especial de Culto no Lar pelo dashboard dos membros, para enviar mural próprio com Palavra ministrada em cada casa, identificação da casa/família, data e foto, com confirmação de envio e acompanhamento de status, sem exigir endereço pessoal.
- [x] Publicar os envios para todos os membros da própria igreja somente mediante aprovação da liderança autorizada; manter pendentes/rejeitados restritos ao autor/liderança, proteger também as fotos, impedir acessos cruzados e não conceder aprovação ao membro básico. Alteração de conteúdo aprovado pelo autor exige nova aprovação.
- [x] Oferecer à liderança fila de revisão com Palavra e foto e ações de aprovar/rejeitar, usando permissões e igreja reais da sessão, com feedback de carregamento/sucesso/erro e sem regredir os recursos anteriores.
- [x] Validar a integração por revisão somente leitura, testes isolados, TypeScript, lint focado e build, sem testar em registros reais; aplicar apenas migrações revisadas e publicar também esta rodada no site original, confirmando o sucesso da implantação.

Evidências em 13/11/2026: 73 testes aprovados, TypeScript e build de produção aprovados, lint focado em 23 arquivos sem erros (1 aviso anterior de imagem). Os dois problemas encontrados pela revisão somente leitura foram corrigidos e cobertos por testes executáveis do helper de listagem e do formulário anual. As duas migrações principais e o reforço de privilégios passaram em PostgreSQL 16 descartável, com reaplicação, dados fictícios e defaults do Supabase reproduzidos, e foram aplicados com sucesso no Supabase de produção. RLS, grants e bucket privado conferidos por metadados; nenhum registro pessoal real foi usado para testar. Implantação original `fb05cdf60b6646377e17a4a06503508d49e3c27e` confirmada pela Vercel como “Deployment has completed”; domínio oficial com manifesto idêntico de 129 páginas, novas páginas HTTP 200 e GET/POST Culto no Lar sem token HTTP 401. Detalhes e limitações em `docs/terceira-rodada.md`.

## Quarta rodada — execução e publicação tópico por tópico

Preservar a identidade visual, tema escuro, cadastros, estruturas, relacionamentos, funcionalidades e dados financeiros existentes. Priorizar interface limpa, intuitiva e responsiva, com menos botões/navegação e sem funcionalidades duplicadas. Analisar arquitetura e dependências antes de alterar componentes/banco, não recriar tabelas nem apagar dados. Integrar os módulos, respeitar permissões e isolamento por instituição. Sinalizar início, conclusão e publicação de cada etapa no site original; só prosseguir à próxima implementação depois da publicação verificada da anterior.

- [ ] **Orações:** investigar a oração excluída que reapareceu no dashboard administrativo, mas não no mural; rastrear exclusão e todos os locais que exibem orações, corrigir problemas confirmados sem divulgar pendentes/privados ou apagar dados reais para testar; distinguir diário histórico de pedido atual e não presumir a causa do registro específico sem evidência.
- [ ] **1. Menu lateral do Financeiro:** itens expansíveis e acessíveis ao clique, levando às respectivas páginas; manter navegação organizada, sem excesso de botões/opções repetidas dentro das páginas.
- [ ] **2. Movimento Financeiro:** dashboard centralizado com três cards Receitas do mês, Despesas do mês e Saldo do movimento; este saldo representa todas as contas/caixas de Caixas e Bancos, sem duplicidade. Remover bloco adicional de saldos abaixo dos cards. Clicar no saldo abre valores individuais e extratos por conta com entradas, saídas e saldo atual. Seletor mês/ano atualiza indicadores e lançamentos; organizar receitas, despesas e movimentos recentes em tela compacta e detalhes locais, usando registros reais existentes.
- [ ] **3. Contas a Pagar:** único cadastro principal de despesa recorrente anual (ex.: Conta de luz 2026) com 12 competências independentes. Cada mês tem mês/ano de referência, valor próprio, vencimento, documento próprio, fornecedor opcional, caixa/conta de pagamento, status pendente/pago/cancelado, data efetiva de pagamento e observações. Mostrar pagos, pendentes e sem lançamento; permitir meses futuros sem valor conhecido. Pagar cada competência gera ou atualiza exatamente uma movimentação efetiva, baixa a conta e atualiza saldo/extrato, sem duplicar despesa e pagamento. Preservar cadastro avulso sem obrigar recorrência.
- [ ] **4. Caixas e Bancos:** manter cadastro/gestão bancária e física; saldo atualizado pelos lançamentos reais, integrado ao Movimento/Contas a Pagar/demais movimentações. Extrato individual com entradas, saídas, transferências e saldo atual, sem controles paralelos.
- [ ] **5. Fornecedores:** preservar cadastro/gestão; vínculo às contas a pagar e despesas recorrentes; facilitar consulta das despesas e obrigações financeiras de cada fornecedor.
- [ ] **6. Produtos:** preservar cadastro/gestão, integração às movimentações financeiras e outros módulos que utilizam produtos, mantendo relacionamentos e funcionalidades existentes.
- [ ] **7. Departamentos:** preservar cadastro/gestão; receitas e despesas vinculáveis ao departamento correspondente para futura distribuição financeira.
- [ ] **8. Relatórios:** consultas por mês, ano, período personalizado, conta, categoria, fornecedor e departamento conforme aplicável; visualizar receitas/despesas por período, saldo consolidado, movimentação individual por conta, despesas por categoria/fornecedor/departamento, contas pagas/pendentes e histórico anual das despesas recorrentes. Usar a mesma fonte e critérios do dashboard para evitar divergências.
