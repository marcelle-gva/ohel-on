# Cuidado pastoral na área do membro

O dashboard `/area-membro` oferece solicitação de atendimento, acompanhamento da agenda, cancelamento de atendimento em aberto e registro de sentimento. Os conteúdos do culto, avisos, perfil, check-in, oração, cestas e convite de visitantes foram preservados.

## Fluxo

O membro informa tipo, motivo, data preferida e horário opcional. A solicitação usa o estado `Agendado` e o responsável `Aguardando confirmação`, compatíveis com o schema atual. A interface distingue essa solicitação de uma agenda confirmada. Em `/gabinete/atendimentos`, a equipe filtra solicitações pendentes e, na edição, atribui o pastor e confirma data e horário. Depois pode marcar `Realizado` ou `Cancelado`.

O membro pode cancelar apenas o seu atendimento cujo estado ainda seja `Agendado`. A condição é aplicada na própria escrita para não sobrescrever uma conclusão concorrente. A edição da equipe também exige o estado anterior; atendimentos encerrados não podem ser reabertos, mas suas anotações podem ser atualizadas.

Cada atualização de sentimento gera uma entrada em `acompanhamento_emocional`, preservando a evolução ao longo do tempo. O registro não abre chat nem envia mensagens automaticamente. A equipe consulta os registros por período no fluxo já existente.

## Acesso e privacidade

Todas as novas APIs exigem o token da sessão Supabase. Identidade e igreja vêm de `resolverAcesso`, nunca do formulário. O membro deve estar ativo e vinculado à conta. Cada consulta e alteração pessoal filtra igreja e membro; a equipe é limitada à própria igreja e às ações `ler`, `criar` ou `editar` do módulo `gabinete`.

O histórico do membro não seleciona nem retorna `observacoes`, o campo de notas sigilosas da liderança. `motivo` é compartilhado com o membro. `observacao` no acompanhamento emocional é a anotação enviada pelo próprio membro. As respostas usam `Cache-Control: private, no-store`. Os históricos são paginados na API e carregados sem omitir registros após o limite de página.

Nenhuma tabela, policy ou migration nova é necessária. São reutilizadas as tabelas, o resolvedor de acesso e as variáveis já usadas pelo projeto: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` (ou a alternativa `SUPABASE_SECRET_KEY` suportada pelo resolvedor). A chave privada deve permanecer somente no servidor.

## Verificações da entrega

Os testes isolados exercitam seleção de aniversariantes, validações, identidade, permissões, projeção de campos privados, nomes relacionados de outras igrejas, paginação e transições concorrentes. Execute `node --test tests/*.test.mjs` em Node compatível com importação nativa dos arquivos TypeScript, `npx tsc --noEmit` e `npm run build`.

A inspeção do Supabase nesta revisão foi restrita a metadados de colunas, constraints e policies. Não foram criados ou alterados registros reais para testar. A validação autenticada ponta a ponta com contas reais não foi realizada neste ambiente, que não recebeu a chave privada do servidor.
