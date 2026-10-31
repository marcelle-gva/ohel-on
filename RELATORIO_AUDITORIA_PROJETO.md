# Relatório de auditoria do OHEL ON

**Data:** 30/10/2026  
**Escopo:** aplicação, arquitetura, autenticação, acesso a dados, experiência de uso, acessibilidade, qualidade estática e dependências.

## Resumo executivo

O OHEL ON é uma plataforma de gestão eclesiástica construída em Next.js 16, React 19 e Supabase. O código reúne cerca de 97 páginas, uma rota de callback OAuth e módulos de secretaria, financeiro, patrimônio, gabinete pastoral, ensino, eventos e mídia.

O build de produção agora conclui. A auditoria, porém, **não permite certificar a segurança do isolamento entre igrejas**: a aplicação é multi-tenant e acessa o Supabase diretamente pelo navegador, mas o repositório não contém schema, migrations ou políticas RLS para revisão. Isso não prova que o banco remoto esteja desprotegido; significa que a proteção decisiva não pôde ser verificada. Antes de produção, confirme as políticas no próprio Supabase e execute testes entre tenants.

| Área | Situação observada |
|---|---|
| Build | Corrigido; `npm run build` concluído com sucesso |
| Segurança HTTP | Cabeçalhos defensivos adicionados e verificados em resposta HTTP `200` |
| Autenticação | Há login, Google OAuth, MFA e recuperação de senha; persistência da sessão OAuth no callback requer validação/correção |
| Banco e isolamento | Acesso direto pelo cliente; políticas, constraints, índices e migrations não estão versionados |
| XSS | Campos usados como substituições em documentos agora são escapados; o HTML dos modelos ainda requer sanitização |
| Lint | 306 erros e 120 avisos no projeto; as novas páginas e o componente compartilhado alterado passam no lint direcionado |
| Dependências | `npm audit`: 16 avisos moderados no grafo completo; `npm audit --omit=dev`: nenhum aviso em dependências de produção |
| Testes | Não há script de testes configurado no `package.json` |

## Escopo e limites

Foi feita análise estática da estrutura e dos pontos centrais de autenticação, layout protegido, cadastro, formulários públicos, documentos HTML, componentes compartilhados e configuração. Também foram executados build, ESLint e auditoria de dependências.

Não foram acessados valores de `.env.local`, o projeto remoto do Supabase, dados de usuários, configurações de autenticação, policies ou logs. O arquivo `.env.local` está coberto pelo `.gitignore`. Não foi feita análise dinâmica autenticada, teste de invasão ou validação de fluxos de e-mail e Google OAuth; esses pontos dependem de configuração externa.

## Achados e ações recomendadas

### 1. Isolamento multi-tenant e autorização — prioridade alta

O layout [app/(painel)/layout.tsx](./app/(painel)/layout.tsx) verifica a sessão no cliente e busca permissões para montar o menu. Essa filtragem melhora a navegação, mas não é uma barreira de autorização: URLs podem ser acessadas diretamente e as chamadas às tabelas partem do navegador. A proteção efetiva dos dados precisa estar nas políticas RLS do Supabase e ser aplicada em cada tabela/operação.

**Não foi possível confirmar uma falha de RLS**, pois não há arquivos `.sql`, schema ou migrations no repositório. Verifique no Supabase, para todas as tabelas com `igreja_id`, leitura e escrita restritas ao tenant derivado da identidade autenticada; confira também operações administrativas, `storage`, RPCs e MFA/AAL em ações sensíveis. Não confie em `igreja_id` enviado pelo cliente.

### 2. Cadastro de igreja e vínculo de tenant — prioridade alta, condicionado às policies

Em [app/cadastro/page.tsx](./app/cadastro/page.tsx), o cliente cria primeiro uma igreja e depois envia o ID em metadados para `signUp`. A validação desse vínculo não aparece no código. Se o banco ou o trigger aceitar metadados arbitrários, pode haver criação de perfis ligados a um tenant indevido ou registros órfãos quando a segunda operação falha.

**Recomendação:** criar igreja, usuário e perfil por operação transacional/RPC segura ou fluxo server-side; validar a associação no banco a partir de uma fonte confiável e garantir rollback/limpeza. Testar tentativas de associação a IDs de outras igrejas.

### 3. HTML de modelos de cartas e certificados — prioridade alta

Os modelos de cartas usam `contentEditable` e persistem `innerHTML`; cartas e certificados depois renderizam conteúdo com `dangerouslySetInnerHTML` ([editor de cartas](./app/(painel)/secretaria/cartas/modelos/novo/page.tsx), [impressão de cartas](./app/(painel)/secretaria/cartas/imprimir/page.tsx), [certificados](./app/(painel)/secretaria/certificados/page.tsx)). Isso mantém risco de XSS persistente se conteúdo HTML não confiável for salvo no modelo.

**Correção parcial aplicada:** os valores dinâmicos de membros/congregados substituídos nos modelos são escapados antes de entrar no HTML. Isso evita que nomes e campos substituídos sejam interpretados como marcação. O próprio HTML do modelo continua sem sanitização; antes de produção, use sanitizador HTML com allowlist de tags/atributos na gravação e na renderização, incluindo modelos antigos.

### 4. OAuth e persistência de sessão — prioridade alta para disponibilidade do login

A rota [app/auth/callback/route.ts](./app/auth/callback/route.ts) troca o código OAuth usando o cliente Supabase compartilhado, sem adapter de cookies da requisição/resposta. Em um Route Handler, a sessão precisa ser persistida em cookies para que o navegador continue autenticado após o redirect. O fluxo Google deve ser testado ponta a ponta; é provável que a troca do código, isoladamente, não persista a sessão no navegador.

O cadastro também aceita senhas com seis caracteres ([app/cadastro/page.tsx](./app/cadastro/page.tsx)); a política efetiva do Supabase não está disponível para revisão.

**Recomendação:** integrar o cliente Supabase SSR com leitura/escrita de cookies conforme o fluxo App Router, configurar no Supabase uma política de senha mais forte e validar login, callback, atualização de sessão, logout e MFA em ambiente de teste.

### 5. Endpoints públicos e abuso de formulários — prioridade média

As páginas públicas enviam dados diretamente ao Supabase, incluindo inscrições/pedidos de eventos, pré-cadastro, check-in e pedidos de oração ([evento](./app/evento/[id]/page.tsx), [pré-cadastro](./app/pre-cadastro/page.tsx), [check-in](./app/checkin/page.tsx), [oração](./app/oracao/[id]/page.tsx)). A validação visível no cliente pode ser contornada; sem limites no banco/backend, esses fluxos podem receber spam, duplicatas e quantidades ou valores inválidos.

**Recomendação:** validar no servidor/banco, impor limites e constraints, impedir duplicidades com índices únicos quando aplicável e adicionar rate limit/CAPTCHA conforme o risco. Nunca confiar em `igreja_id`, preço, status ou total enviados pelo navegador.

### 6. Banco de dados — revisão incompleta por ausência de artefatos

Não foram encontrados migrations, schema SQL, Prisma, Drizzle ou definições de policies no repositório. Portanto, não foi possível verificar chaves estrangeiras, índices, unicidade, nulabilidade, integridade financeira, cascatas, RLS, triggers, backups ou procedimentos de restauração.

**Recomendação:** versionar migrations e políticas; definir constraints e índices para as consultas frequentes; usar transações para operações compostas; documentar retenção, backup e restauração; criar testes de isolamento por tenant e de integridade financeira.

### 7. Privacidade e comunicação legal — prioridade média

O pré-cadastro afirma conformidade com a LGPD e exibe um link `#` para um termo inexistente ([app/pre-cadastro/page.tsx](./app/pre-cadastro/page.tsx)). Não há política de privacidade identificada no projeto. Não é possível atestar conformidade somente pelo código.

**Recomendação:** substituir o link inoperante por aviso/política real, informar finalidade, base legal, retenção, compartilhamentos, direitos e contato do controlador; validar o texto com responsável jurídico/privacidade antes de declarar conformidade.

### 8. UX e acessibilidade — prioridade média/baixa

**Correções aplicadas:** inputs que recebem `label` agora têm `id` e `htmlFor` associados; o login ganhou rótulos e deixou de usar o link inerte de recuperação. Foram adicionadas páginas funcionais para solicitar e concluir a redefinição de senha, com resposta que não confirma se o e-mail está cadastrado. É necessário liberar `/redefinir-senha` na allowlist de Redirect URLs do Supabase e configurar o envio de e-mail.

**Pontos restantes:** a busca e o sino de notificações do cabeçalho são apenas visuais; há botões de edição/exclusão sem ação em algumas telas; o modal compartilhado não declara semântica de diálogo/foco acessível; o aviso legal citado acima também não leva a conteúdo.

### 9. Qualidade estática — prioridade média

O ESLint contabiliza **306 erros e 120 avisos em 113 arquivos**. Entre os erros estão 223 usos de `any`, 38 problemas de imutabilidade do React Hooks e 28 textos JSX com caracteres que precisam ser escapados. O build inicial também falhava porque a página pública de evento passava uma prop `noMask` que o componente `Logo` não aceita; a prop foi removida.

Não foi feita correção em massa do lint: parte requer tipagem e revisão funcional, então uma alteração automática ampla seria arriscada. Recomenda-se tratar por módulo, começando por autenticação, financeiro e formulários públicos, e adicionar testes para regras críticas.

### 10. Dependências

`npm audit` reportou 16 vulnerabilidades moderadas no grafo completo, sem críticas ou altas. `npm audit --omit=dev` não reportou vulnerabilidades nas dependências de produção; os avisos observados são do conjunto de desenvolvimento/ferramentas. Não foi aplicado update automático: as sugestões incluem alterações major e precisam ser avaliadas junto do ESLint/Next.

### 11. Documentação

O [README.md](./README.md) ainda é o texto padrão do create-next-app e não explica módulos, configuração do Supabase, variáveis necessárias, Redirect URLs, migrations, políticas, implantação ou recuperação de backup. Isso aumenta o risco operacional e torna difícil reproduzir o ambiente.

**Recomendação:** substituir o texto inicial por um guia do produto e de desenvolvimento, sem incluir valores de `.env.local`; documentar configuração do Supabase e os passos de deploy/backup.

## Correções implementadas nesta revisão

1. Removida a prop `noMask` inválida da chamada de `Logo`, que impedia o type-check do build.
2. Corrigida a associação dos rótulos aos inputs no componente compartilhado.
3. Implementados os fluxos de recuperação e redefinição de senha, com retorno genérico para reduzir enumeração de contas.
4. Escapados os dados dinâmicos inseridos em modelos de cartas e certificados.
5. Adicionados `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`; geolocalização permanece autorizada na própria origem porque o check-in a utiliza.

## Revisão complementar: financeiro, botões e valores

Foram revisados os botões de edição/exclusão apresentados nas telas financeiras. Os botões de edição de fornecedores e de contas/caixas eram visuais, sem ação; agora abrem formulários funcionais e salvam as alterações no registro da igreja correspondente. As transações do extrato também podem ser editadas (data, descrição e valor). A exclusão de fornecedores, caixas e contas agora confere o erro retornado pelo Supabase e informa quando o registro não pode ser removido; contas já pagas não podem ser apagadas ou editadas pela lista.

Os campos monetários de contas a pagar, movimentos e saldo inicial de caixas agora usam entrada em reais com máscara brasileira (ex.: `1.234,56`), conversão validada para número e exibição padronizada. Os totais do financeiro, relatórios e a prévia de importação OFX também exibem valores no padrão monetário brasileiro. O parcelamento divide em centavos e distribui eventual resto para que a soma das parcelas continue igual ao total informado.

**Contas fixas variáveis (água, luz e similares):** selecionar `Recorrente (Mensal)` cadastra o primeiro vencimento. Ao dar baixa, o sistema agenda apenas o próximo vencimento mensal, reaproveitando fornecedor, classificação, caixa e valor anterior. A próxima conta pode ser editada antes do pagamento para registrar a fatura real do mês. O dia é preservado quando possível, com ajuste para o último dia de meses mais curtos. Se houver erro ao criar a próxima conta, a baixa e o lançamento financeiro já realizados são informados e o próximo vencimento deve ser cadastrado manualmente.

**Atenção operacional:** a baixa ainda realiza lançamentos relacionados em mais de uma chamada ao Supabase (movimento, título pago e próxima recorrência). Sem uma RPC transacional e uma chave de idempotência no schema, não se pode garantir atomicidade diante de queda de conexão entre as etapas; a recomendação é consolidar a baixa em uma função transacional do banco/backend.

A edição de uma transação do extrato altera somente o movimento selecionado. Como não foi localizado um identificador que vincule a transação gerada à conta a pagar original, essa edição não sincroniza o título; correções de faturas devem ser feitas no registro da conta antes da baixa, e os lançamentos já pagos precisam ser conciliados com cuidado.

### SQL para revisar a compatibilidade do banco

Foi criado [SUPABASE_SQL_EDITOR_CONTAS_RECORRENTES.sql](./SUPABASE_SQL_EDITOR_CONTAS_RECORRENTES.sql) para execução manual no SQL Editor do Supabase. O script verifica a tabela `public.contas_pagar`, adiciona somente os campos de recorrência ausentes (`recorrente`, `dia_vencimento_mensal`, `tipo_conta`, `total_parcelas` e `parcela`), valida tipos compatíveis e apresenta constraints e policies RLS existentes para conferência. Se adicionar `recorrente` pela primeira vez, marca como recorrentes as contas cujo `tipo_conta` já seja `Recorrente`.

O script **não cria nem modifica policies RLS**: a leitura de policies é apenas diagnóstica, pois gerar regras seguras exige conhecer todas as tabelas, funções de tenant e permissões existentes. As constraints novas são `NOT VALID`: aplicam-se a gravações futuras sem fazer a execução falhar por dados antigos, que devem ser verificados e corrigidos antes de validar as constraints. Antes de executar: confirme o projeto e ambiente selecionados, faça backup, revise o arquivo e execute-o no SQL Editor; depois confira os três resultados de verificação. Se a tabela ou os tipos não corresponderem ao esperado, o bloco de migração aborta sem converter tipos existentes. **O script foi criado, mas não executado**: não há conexão autorizada ao banco remoto nesta sessão.

## Atualização do Git

Na verificação atual, a pasta contém `.git`, mas **não há commits** e os arquivos do projeto aparecem como não rastreados. O remoto configurado é `https://github.com/marcelle-gva/ohel-on.git`; `git ls-remote origin HEAD` retornou **Repository not found**. Isso pode significar URL incorreta, repositório privado sem acesso ou repositório indisponível. Nenhum commit ou push foi feito.

Antes de enviar código, confirme com o proprietário a URL e o acesso ao repositório. Se o remoto já tiver o histórico do projeto, clone a versão correta e transfira apenas as alterações revisadas; não tente publicar este diretório sem commits como se fosse uma atualização do histórico existente. Se o repositório for novo e vazio, confirme primeiro que `.env.local` continua ignorado e então:

```bash
git remote set-url origin https://github.com/USUARIO/REPOSITORIO.git
git ls-remote origin HEAD
git status
git add -A
git diff --cached --check
git diff --cached --stat
git diff --cached
git commit -m "Atualiza apresentação e gestão da igreja"
git push -u origin main
```

Se a branch de publicação não for `main`, use o nome correto. Não adicione `.env.local`, credenciais ou arquivos de chave ao Git. O ZIP manual mais recente contém o código e o relatório, mas exclui `.env.local`, `.git`, `.next`, `node_modules` e arquivos `.pem`.

## Validação executada

- `npm run build` — **aprovado**, com geração das rotas.
- `npx eslint` nos novos fluxos de senha, `Input`, configuração e helper de escape — **aprovado**.
- ESLint do projeto — **ainda falha** pelos 306 erros e 120 avisos preexistentes/distribuídos no restante do código.
- `npm run build` após as alterações financeiras — **aprovado**.
- ESLint dos helpers compartilhados de moeda e vencimento mensal — **aprovado**.
- A verificação de ESLint direcionada às telas financeiras ainda identifica erros preexistentes nessas páginas (principalmente `any` e regras de Hooks); o lint completo permanece com os números acima.
- `npm audit --omit=dev` — **0 vulnerabilidades** reportadas.
- `npm audit` — **16 moderadas**, sem altas/críticas.
- Servidor de produção local — resposta `HTTP 200` com os quatro cabeçalhos configurados.

## Plano recomendado

1. **Antes de produção:** revisar e testar todas as policies RLS, storage, RPCs e limites de privilégio no Supabase, incluindo acesso cruzado entre igrejas.
2. **Prioridade alta:** sanitizar os modelos HTML e confirmar persistência do OAuth/MFA em navegador real; configurar a URL de redefinição no Supabase.
3. **Prioridade alta:** mover cadastro multi-etapa e validações de formulários públicos para operações confiáveis/transacionais; proteger contra spam e duplicidade.
4. **Prioridade média:** versionar schema/migrations, policies, constraints, índices e plano de backup/restauração.
5. **Prioridade média:** corrigir o aviso LGPD/link, implementar ou remover controles visuais sem ação, melhorar semântica/foco dos modais e documentar setup/deploy.
6. **Evolução contínua:** reduzir erros do ESLint por módulos, adicionar testes de autorização e fluxos críticos e atualizar dependências moderadas em branch isolada com build e regressão.

## Atualização: webhook do WhatsApp e domínio

**Data:** 31/10/2026

Foi criada a rota de callback da Meta em [app/api/webhooks/whatsapp/route.ts](./app/api/webhooks/whatsapp/route.ts) e publicada em produção no commit `72a3489` (`main`). A migration [SUPABASE_SQL_EDITOR_WHATSAPP.sql](./SUPABASE_SQL_EDITOR_WHATSAPP.sql) foi executada no projeto Supabase de produção e conferida por consulta ao schema: as duas colunas de opt-in e as tabelas de comunicação/destinatários estão presentes.

- **Callback URL:** `https://www.ipocloud.com.br/api/webhooks/whatsapp`
- **Verify token:** o mesmo valor configurado na Vercel em `WHATSAPP_VERIFY_TOKEN` (não compartilhar nem versionar esse segredo).

A rota responde ao desafio GET de verificação e valida a assinatura HMAC SHA-256 dos webhooks POST. O código processa atualizações de entrega/leitura/falha sem armazenar o conteúdo de mensagens recebidas. A API de envio usa modelos aprovados, limita o envio a membros ativos com opt-in, exige usuário administrador da igreja, registra o histórico e impede reenvio com a mesma chave.

Os membros existentes permanecem sem consentimento (`whatsapp_opt_in = false`) até que a igreja confirme e registre a autorização no cadastro/edição. As variáveis Production `META_APP_SECRET`, `META_WA_ACCESS_TOKEN` e `META_WA_PHONE_NUMBER_ID` foram adicionadas à Vercel sem expor seus valores. O `WHATSAPP_VERIFY_TOKEN` e as variáveis Supabase necessárias também estão configurados. Os segredos devem permanecer na Vercel, nunca no chat nem no Git.

O redeploy de produção com as variáveis foi concluído. Os testes sem envio de mensagens confirmaram: o webhook GET rejeita token de verificação incorreto (403), o POST sem assinatura é rejeitado (401, em vez de erro de configuração) e o endpoint de envio exige autenticação (401). Ainda falta confirmar no painel Meta o callback `https://www.ipocloud.com.br/api/webhooks/whatsapp` e a assinatura do campo `messages`. O app Meta Ohel-on está em modo de desenvolvimento/não publicado; não foi feito envio real. Para liberar mensagens a membros, é necessário validar o número/token, publicar o app conforme requisitos de permissões da Meta, usar modelo aprovado e registrar opt-in. O painel distingue aceitação pela Meta de entrega final, que depende dos webhooks.

### Diagnóstico DNS realizado

Na consulta pública feita em 31/10/2026, `www.ipocloud.com.br` resolvia como CNAME para `cname.vercel-dns.com`, e os domínios `www` e raiz respondiam por HTTPS com servidor Vercel (`HTTP 200`). Os nameservers autoritativos observados são `athena.dns-parking.com` e `apollo.dns-parking.com`, ou seja, os registros DNS são administrados no provedor que controla esses nameservers (aparentemente Hostinger), não dentro da Vercel.

O domínio raiz `ipocloud.com.br` resolvia para o A `216.198.79.1`. Como ambos os endereços já serviam respostas da Vercel, não altere registros às cegas: compare o A esperado mostrado em **Vercel → Project → Settings → Domains → ipocloud.com.br** com o registro raiz no provedor DNS. Remova apenas registros conflitantes identificados pela Vercel e mantenha o CNAME `www` apontando para `cname.vercel-dns.com`, salvo se o painel da Vercel indicar um destino específico diferente para este projeto.

**Status:** DNS público e HTTPS estavam alcançáveis durante a verificação, mas isso não confirma que a Vercel marcou o domínio como validado no projeto correto. A rota nova foi compilada e validada localmente, porém a URL de produção retornou `404` antes do deploy desta alteração. Publique esta versão antes de tentar a verificação na Meta.

## Atualização: página pública de apresentação

**Data:** 31/10/2026

A rota `/` agora apresenta o OHEL ON como página institucional/comercial, com explicação dos módulos, adaptação para telas pequenas, botão **Solicitar cotação** para o WhatsApp comercial informado e botão **Entrar no sistema**. A tela de login foi preservada em `/login`.

Os links de login e os redirecionamentos de sessão expirada, logout, cadastro, recuperação de senha, redefinição de senha e falha no callback OAuth apontam para `/login`. Assim, o acesso público à página institucional não substitui nem interrompe a autenticação existente.

A página também explica a origem do sistema na Igreja IPO, a decisão de disponibilizá-lo a outras igrejas e o propósito de compartilhar tecnologia na nuvem em favor do Reino e da unidade do corpo. A área visual do hero foi atualizada com uma prévia ilustrativa inspirada nas telas reais do dashboard e do Monitor de Mídia; os indicadores são rótulos de módulos, não dados de uma igreja.

O texto comercial foi refinado para identificar a Igreja Pentecostal Ohel e apresentar os recursos solicitados: contatos e comunicação pelo WhatsApp, cadastros e carteirinhas, escalas, eventos, sorteios, mural, projeção de louvores, pedidos de oração e avisos durante o culto. A API oficial de comunicação foi publicada; o uso com destinatários fora do modo de desenvolvimento depende da ativação/publicação do app Meta e do consentimento dos contatos.

## Atualização: pré-cadastro Kids & Teens por QR Code

Implementados o formulário público por QR/link, classificação automática de Kids (0–11) e Teens (12–17), campos de contato do responsável, pessoas autorizadas a retirar, informações de saúde opcionais e consentimento explícito. O painel `Secretaria > Kids & Teens` gera QR/link por igreja, lista e analisa os cadastros e permite aprovar ou rejeitar. Foi criada permissão independente `kids-teens` para perfis/grupos; o SQL aplica RLS por igreja, permite somente inserção pública e restringe leitura/alteração aos usuários autenticados da própria igreja.

**Arquivo para preparar o banco:** [SUPABASE_SQL_EDITOR_KIDS_TEENS.sql](./SUPABASE_SQL_EDITOR_KIDS_TEENS.sql). Ele ainda não foi executado no Supabase remoto. Rode-o no projeto Supabase correto antes de testar o formulário; depois atribua a permissão `Kids & Teens` aos perfis/grupos que precisam administrar os dados. Como há dados pessoais de menores e possível informação de saúde, valide a política de privacidade/consentimento e a retenção com a pessoa responsável na igreja antes de produção. O consentimento implementado é operacional e não substitui revisão jurídica.

**Validação de código:** build de produção e lint direcionado às novas páginas concluídos; o lint dos arquivos preexistentes de permissões aponta erros/warnings anteriores nessas telas.

**Validação:** `npm run build` concluído com sucesso; a geração de rotas inclui `/` e `/login`.

## Atualização: apresentação comercial e pré-cadastro Kids & Teens

A página inicial agora apresenta dores comuns da rotina de gestão — informações espalhadas, escalas confusas, coordenação do culto e cuidado infantil — junto das ferramentas do OHEL ON que ajudam a organizar cada fluxo. O pré-cadastro Kids & Teens por QR Code foi destacado na prévia visual e relacionado ao preenchimento pelo responsável e à revisão da equipe.

Como não há capturas reais do sistema disponíveis em `public`, a página usa prévias de interface construídas com componentes visuais inspirados nas telas do produto. Elas são identificadas como ilustrativas; não apresentam dados reais nem devem ser interpretadas como depoimentos ou resultados medidos.

**Validação:** `npm run build` concluído com sucesso após as alterações da página inicial; a rota pública `/pre-cadastro-kids-teens/[igrejaId]` também foi gerada. O SQL de Kids & Teens continua dependendo de execução no Supabase remoto para habilitar o fluxo real.

## Revisão estática dos fluxos e OWASP

**Data:** 31/10/2026  
**Escopo desta revisão:** leitura estática dos fluxos de eventos/produtos, sorteios, financeiro, louvores/Monitor, patrimônio e gabinete, dos três arquivos SQL presentes e revisão de segurança OWASP por especialista. Não houve login em ambiente de teste, chamada autenticada ao Supabase, teste de upload real ou verificação de policies no banco remoto. Portanto, os resultados abaixo não certificam que o sistema esteja funcional ou seguro em produção.

| Módulo/fluxo | O que o código mostra | Situação |
|---|---|---|
| Louvores e Monitor de Mídia | Há cadastro/edição de louvores e comandos de projeção por canal Supabase; o resultado depende de conexão, Realtime e receptor de projeção configurados. | Parcialmente implementado; não validado ponta a ponta. |
| Patrimônio | Há cadastro, inventário imprimível e registro de movimentações. Os botões Editar e Excluir na lista não têm handlers nem navegação. A movimentação grava histórico e atualiza o bem em duas operações não transacionais. | Incompleto; edição/exclusão não funcionam e uma falha entre operações pode deixar histórico/status divergentes. |
| Gabinete pastoral | Atendimentos, acompanhamento emocional, sermões e integração server-side com a WhatsApp Cloud API. O envio é limitado a administradores e membros ativos com opt-in, usando modelos aprovados e histórico de entrega. | API publicada e protegida; envio real e callbacks ainda dependem da publicação/configuração final do app Meta e de teste com contato consentido. Dados emocionais e pastorais exigem acesso e retenção cuidadosamente limitados. |
| Eventos e produtos (incluindo camisas) | Inscrições e pedidos de produtos/variações são gravados. O painel permite anexar comprovante e marcar pedido como Pago. | A confirmação altera o status do pedido, mas não gera lançamento em `transacoes`, não credita caixa e não alimenta relatório/saldo financeiro. |
| Sorteios | O participante reserva número por RPC pública; o comprovante deixa a reserva pendente de conferência. O painel conta participantes e a página pública mostra quantidade disponível. | A migration segura ainda não foi aplicada no Supabase. Não há validação bancária, tela administrativa para conferir/confirmar nem gráfico financeiro ou lançamento em caixa. A interface mostra contagem numérica, não gráfico. |
| Financeiro | O módulo recebe lançamentos manuais/importados e fornece relatórios de transações. | Não há vínculo automático visível entre pagamento de evento/camisa/sorteio e transação financeira. Portanto, não existe “cofrinho” criado pelo nome do sorteio nem atualização financeira automática no gráfico/relatório. |
| Banco/SQL | O repositório possui scripts separados para contas recorrentes, sorteios e Kids & Teens. | Não existe dump/schema completo versionado. Não foram localizados scripts para tabelas e políticas de eventos/produtos, patrimônio, gabinete ou louvores. Os scripts disponíveis não comprovam que o Supabase remoto está atualizado. O SQL de sorteios agora habilita RLS e define RPCs públicas restritas, mas ainda precisa ser executado e validado no Supabase correto. |

### Achados OWASP de alta severidade

| # | Severidade | Arquivo | Linhas | Vulnerabilidade | Confiança |
|---|---|---|---|---|---|
| 1 | 🟠 HIGH | `SUPABASE_SQL_EDITOR_SORTEIOS.sql` | 64–74 | A revisão identificou RLS comentado nas tabelas de sorteios/participantes. **Correção local aplicada:** RLS por igreja, remoção das policies existentes dessas duas tabelas, revogação do acesso anônimo direto e RPCs públicas com dados limitados/token de acompanhamento; ainda não aplicada ao banco remoto. | 8/10 |
| 2 | 🟠 HIGH | `app/(painel)/secretaria/cartas/imprimir/page.tsx` | 112–129, 345–348, 396–399 | XSS persistente possível: HTML do modelo de carta é renderizado sem sanitização; escapar substituições não sanitiza o modelo salvo. | 8/10 |

**Ações de segurança recomendadas:** executar e validar as policies por tenant/RPC no banco de teste antes de produção; sanitizar o HTML com allowlist ao salvar e ao renderizar modelos de cartas. A policy de sorteios usa o vínculo `public.usuarios.id = auth.uid()` e `igreja_id`, padrão já usado pelo código existente. Uma segunda revisão especializada confirmou a remoção de policies permissivas antigas no script; não confirmou o estado remoto.

### Estado de validação geral

- `npm run build` passou após a correção local do fluxo público de sorteios.
- `npx eslint 'app/sorteio/[id]/page.tsx' 'app/sorteio/[id]/acompanhar/page.tsx'` passou após tipar os dados das RPCs.
- `npm run lint` foi executado nesta revisão e falhou com erros e avisos ESLint distribuídos pelo projeto; o primeiro trecho reporta `no-explicit-any` e uso de função antes da declaração em configuração de check-in. O log completo é volumoso.
- O `package.json` não declara script de testes automatizados. Não há evidência de testes end-to-end para os fluxos descritos.
- Conclusão: o projeto compila, mas **não pode ser considerado “tudo funcionando” nem aprovado para produção** com as evidências disponíveis. Pagamentos, upload, RLS, WhatsApp e persistência dependem de correções/configuração e validação no ambiente Supabase/Vercel real.

### Correção local do acesso público ao sorteio

Após a revisão, o fluxo público foi migrado de consultas e atualização direta de `sorteio_participantes` para RPCs `SECURITY DEFINER` com `search_path` fixo. O acesso anônimo direto às tabelas foi revogado; o script remove policies antigas nas duas tabelas e recria políticas por igreja para usuários autenticados. A reserva retorna um token aleatório de 256 bits, armazena somente o hash e coloca o token na parte fragmento (`#`) do link, sem expor telefone na URL. O comprovante agora deixa o status como `reservado` para conferência da igreja, em vez de marcar pagamento como confirmado automaticamente.

**Limites ainda pendentes:** esta migration não foi executada nem testada no Supabase; o fluxo público requer a aplicação do SQL antes de funcionar. Links antigos baseados em telefone não são compatíveis com o token novo. A política e a privacidade do bucket `comprovantes` ainda precisam ser revisadas separadamente; o uso de URL pública não foi alterado. Também falta uma tela administrativa para conferir/confirmar pagamentos do sorteio e criar os lançamentos financeiros, que continuam sem integração automática com `transacoes`.

## Segunda varredura estática: novos achados

**Data:** 31/10/2026. Foi feita leitura estática adicional de finanças, eventos, louvores/Monitor, patrimônio, gabinete, escalas e secretaria. Esta etapa não simulou cliques com sessão real nem consultou policies ou dados no Supabase.

| Prioridade | Arquivo/linhas | Achado e impacto |
|---|---|---|
| Alta | `app/(painel)/financeiro/movimento/novo/page.tsx:26, 111–139, 192–193` | A tela deixa selecionar `Data` e `Mês/Ano Ref` independentemente. O bloqueio de mês fechado e o lançamento usam apenas `mes_referencia`, sem validar que coincide com o mês de `data`. Um lançamento datado em mês fechado pode ser enviado com referência a outro mês aberto, contornando a verificação da interface e classificando incorretamente o período. Além disso, o bloqueio está no cliente e deve ter validação de servidor/banco para ser uma regra contábil efetiva. |
| Média | `app/(painel)/monitor-midia/page.tsx:77–95, 146–173` | Consultas Supabase não verificam os campos `error`; falhas de carga são mostradas como listas vazias. Nas operações de excluir louvor e aprovar/rejeitar oração, a interface altera o estado local mesmo se Supabase retornar `{ error }`, pois o cliente não lança essa resposta automaticamente. Isso pode mostrar uma alteração não persistida. |
| Revisar RLS | `app/(painel)/secretaria/escalas/page.tsx:71` e `app/(painel)/secretaria/escalas/nova/page.tsx:40` | A lista de membros usada nas escalas não aplica filtro explícito por `igreja_id`, embora a igreja do usuário esteja disponível/identificada. Isso não prova acesso entre igrejas: a exposição depende das policies RLS efetivas, que não foram acessadas. Recomenda-se filtrar pelo tenant e testar leitura/seleção com duas igrejas. |

Nenhum achado novo de alta confiança foi confirmado pela varredura limitada de eventos/financeiro além do problema conhecido de integração dos pagamentos com `transacoes`. Isso não equivale a uma aprovação desses módulos.

## Correções da segunda varredura

**Data:** 31/10/2026

- O lançamento financeiro agora verifica se estão fechados tanto o mês da data quanto o mês de referência, impedindo contorno do bloqueio pela tela. Também foi criado [SUPABASE_SQL_EDITOR_FECHAMENTO_FINANCEIRO.sql](./SUPABASE_SQL_EDITOR_FECHAMENTO_FINANCEIRO.sql): instala triggers no banco para validar formato/referência, bloquear transações em qualquer mês fechado e serializar o fechamento com advisory locks. **O script precisa ser executado no Supabase; ainda não foi aplicado nem validado no remoto.** Faça backup, confirme tabela/colunas no projeto correto e confira os triggers retornados ao final.
- A ação de fechar/reabrir mês agora verifica erros do Supabase, só atualiza a tela após confirmação e exibe falhas; o trigger protege também atualizações de transação, não somente novos lançamentos.
- O Monitor agora filtra dados pelo `igreja_id`, mostra falhas de consulta em vez de mascará-las como listas vazias, confere erros/ausência de linhas em exclusão e aprovação/rejeição, e corrige o nome dos campos das próximas escalas para `titulo` e `data_culto`.
- As consultas de membros nas páginas de gestão/criação de escalas agora filtram por `igreja_id`.
- A funcionalidade para eventos fixos já existia na aba `Eventos Regulares` de `Secretaria > Escalas`, com criação e geração de escalas mensais. Para torná-la mais fácil de encontrar, foi adicionado o botão `Novo Evento Fixo` no cabeçalho e a aba foi renomeada para `Grade Fixa`; essa mudança é apenas de navegação/UX, sem exigir nova tabela SQL.

**Verificação:** `npm run build` passou após estas alterações. O lint direcionado foi executado, mas continua falhando com `any` e avisos já existentes nos arquivos abrangidos; não foi possível declarar o lint limpo. O SQL depende da estrutura existente (`transacoes.igreja_id`, `transacoes.data`, `transacoes.mes_referencia`, `meses_fechados.igreja_id`, `meses_fechados.mes_referencia`) e aborta antes de criar funções/triggers se as tabelas/colunas não forem encontradas. Não foi possível executar/parsing-testar o SQL com uma instância PostgreSQL nem aplicá-lo ao Supabase remoto nesta sessão.
