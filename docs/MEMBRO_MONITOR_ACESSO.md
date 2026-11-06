# Acesso de membro ao Monitor

## Execução e escopo

Execute [`SUPABASE_SQL_EDITOR_MEMBRO_MONITOR.sql`](../SUPABASE_SQL_EDITOR_MEMBRO_MONITOR.sql) **uma vez** no SQL Editor do projeto Supabase correto, como `postgres`, depois de confirmar o ambiente e fazer backup. A migration é transacional e idempotente; ela não foi executada nesta sessão e não faz chamadas de produção. Não execute este arquivo em outro banco.

Ela altera somente o banco: não modifica UI, rotas, APIs ou o menu. O frontend deve entregar o comportamento de entrada padrão em `/api/membros/monitor`, com autenticação e service-role whitelisted no servidor. Foto/perfil e sair continuam no fluxo server-side. Nunca exponha service-role ao navegador.

## Baseline e vínculo da conta

Um membro `Ativo` com `igreja_id` e `auth_user_id` válido provisiona somente o baseline em `usuarios`: `role = 'membro'`, `grupo_id = NULL` e `perfil_id = NULL`, copiando nome/e-mail quando necessário. Cargo e departamento são dados declaratórios/título; não são fonte de autorização. A migration não lê metadata Auth para escolher role e não transforma `cargo` em privilégio.

Se `membros.auth_user_id` faltava, o script cria a coluna UUID e a FK para `auth.users(id) ON DELETE SET NULL`; também garante `usuarios.perfil_id` nullable. A unicidade parcial de `auth_user_id` mantém o vínculo 1:1 sem impedir pré-cadastros sem conta.

Rows existentes de `usuarios` são preservadas quando já têm `igreja_id`, inclusive admins, role, grupo e perfil. Um placeholder existente com o mesmo Auth ID e `igreja_id IS NULL` é normalizado para o baseline de membro; ele não é tratado como outra igreja. Uma conta já tenantizada em outra igreja rejeita o vínculo para evitar mislink. O backfill só usa Auth confirmado e vínculo inequívoco: mais de um membro `Ativo` sem vínculo com o mesmo e-mail faz o candidato ser ignorado, assim como e-mail Auth confirmado ambíguo, vínculo já usado ou tenant conflitante.

O provisionamento usa lock da linha de `usuarios` para tratar concorrência. Chamadas de API/service-role, sem `auth.uid()`, podem executar aprovações server-side; uma chamada autenticada de não-admin não pode alterar `auth_user_id`, `igreja_id` ou `status` de um membro.

## Autorização por grupo e tenant

O acesso de membro exige simultaneamente cadastro `Ativo`, vínculo Auth atual, usuário e grupo no mesmo `igreja_id`, e `grupos_permissoes.modulo/acao` compatível. A tabela não listada no mapa fechado e qualquer filho/descendente FK sem regra explícita falham fechado; não existe fallback de “mesma igreja”. A migration cria policies `AS RESTRICTIVE` para limitar policies legadas e policies permissivas específicas para conceder as ações do grupo. Sem grupo, o membro não recebe acesso direto a módulos de tenant.

O antigo bloqueio absoluto de dados do Monitor foi removido. `oracoes`, `escalas`, `mural`, `monitor-midia` e demais módulos normais continuam protegidos por grupo + ação + tenant. O deny absoluto fica reservado a controles administrativos/PII como `admin_convites`, `perfis`, `perfis_permissoes`, controles de grupos/usuários, billing e `igrejas`. A whitelist do endpoint `/api/membros/monitor` continua obrigatória, mesmo que uma conta tenha outras permissões.

As decisões de oração preservam a regra anterior: o grupo deve se chamar `Liderança` (ou `Lideranca`) e possuir `aprovar` ou `editar` em `oracoes` ou `monitor-oracoes`. Declarar o cargo de pastor ou receber uma permissão em outro grupo não substitui essa exigência.

O mapa acompanha as páginas existentes: `produtos` e `fornecedores` são `financeiro` (não `patrimonio`); `sermoes` é `gabinete`; `grupos_trabalho` é `escalas`; tabelas de eventos, variações e inscrições têm relações filhas/descendentes fechadas; `departamentos` aceita o contexto de `financeiro` e `configuracoes` sem inventar privilégios. A concessão de um módulo não concede automaticamente outro módulo nem privilégios de responsável de departamento.

## Membros e controles administrativos

A leitura de `membros` permite o próprio registro `Ativo` ou, para abrir a Secretaria com segurança, exige `gp.membros = ler` no mesmo tenant. Mutations de `membros` só são concedidas pelas ações explícitas `criar`, `editar`/`aprovar`/`movimentar` e `excluir`, além das policies legadas aplicáveis. O trigger permite dados administrativos opcionais para um membro autorizado, mas bloqueia para qualquer não-admin autenticado alteração de `auth_user_id`, `igreja_id` ou `status`; inserções autenticadas não podem vincular outra conta Auth. A aprovação/desativação deve continuar no endpoint server-side autorizado (ou no fluxo legado de admin/pastor/secretaria), que não é limitado por esse actor guard.

`usuarios`, `grupo_id`, `grupos`, `grupos_permissoes`, `perfis`, `perfis_permissoes` e convites administrativos continuam com escrita administrativa. Um membro não pode se autoelevar escrevendo role, tenant, grupo ou perfil. Cargo, departamento e qualquer metadata Auth não substituem `grupos_permissoes`.

## Cestas e Check-in

Se `cestas_basicas`, `cesta_itens` e `cesta_doacoes` já existirem, a migration atualiza condicionalmente a RPC `public.reservar_item_cesta(uuid, integer)`, preservando assinatura, lock do item, limite de 1–100, soma de reservas `reservado`/`entregue` e inserção no mesmo tenant. A RPC exige `auth.uid()` com e-mail confirmado, prioriza membro `Ativo` vinculado por `auth_user_id` e só usa fallback de e-mail quando há exatamente uma conta Auth confirmada e exatamente um membro `Ativo` sem vínculo. Ela é `SECURITY DEFINER` com `search_path` fixo, sem execução pública/anon e com execução apenas para `authenticated`.

As APIs server-side de cestas e check-in validam novamente identidade, membro Ativo, tenant, item/cesta e payload; o membro baseline não precisa de leitura SQL direta de cestas, check-ins ou configuração para entrar no Monitor. Essas APIs não autorizam vazamento por service-role.

## Configuração pelo administrador

Depois da aprovação, abra **Configurações > Grupos e Permissões > Membros do Grupo**. Atribua o usuário ao grupo da mesma igreja e configure as ações por módulo. Um título/cargo sozinho não concede nada. Um grupo administrativo deve receber os módulos reais de que precisa — a migration não vincula automaticamente privilégios de departamentos e não transforma grupo em admin de perfis.

## Conferências pós-execução

- Confirme que a consulta final lista helpers, policies novas e somente baseline para novos membros Ativo; não deve haver vínculo Ativo cruzando tenants.
- Confirme que uma linha `usuarios` existente com tenant preserva admin/grupo/perfil, enquanto um placeholder sem tenant recebe `membro` sem grupo/perfil.
- Atribua um grupo com `membros/ler` e valide a leitura da Secretaria; remova essa ação e confirme que só a própria linha Ativa permanece visível.
- Teste `membros/criar`, `editar` e `excluir` em tenant correto e tente alterar vínculo Auth, igreja e status; a tentativa autenticada deve falhar. Teste aprovação pelo endpoint service-side.
- Para uma conta Ativo sem grupo, confirme entrada padrão no Monitor e ausência de acesso SQL aos módulos. Para grupo autorizado, valide separadamente `ler`, `criar`, `editar` e `excluir` no módulo concedido e entre duas igrejas.
- Confirme que `/api/membros/monitor` entrega apenas a whitelist prevista e que o fallback de reserva de cesta rejeita e-mails ambíguos ou não confirmados.

## Assumptions e lacunas críticas

- `public.membros`, `public.usuarios`, `public.grupos` e `public.grupos_permissoes` são pré-condições; `perfis`/`perfis_permissoes` são legado opcional. O campo `role` é tratado como texto comparável aos valores `admin` e `membro`; outras roles legadas continuam dependendo das policies e APIs existentes.
- Policies RLS não protegem chamadas service-role. O allowlist e as verificações de identidade, status, igreja, grupo e payload das APIs `/api/acesso`, `/api/membros/monitor`, `/api/membros/cestas` e `/api/membros/checkin` continuam obrigatórios.
- O mapa fechado e a descoberta recursiva de descendentes não concedem acesso a tabela nova automaticamente. Para incluir uma tabela, adicione o mapeamento e a regra de tenant após revisão; não use policy permissiva genérica de “mesma igreja”.
- Policies RLS restringem linhas, não colunas de `SELECT *`; o frontend de membro deve preferir `/api/acesso`, que retorna somente o contexto necessário. A validação definitiva precisa ser feita no banco de teste isolado e, antes de produção, com cenários autenticados entre tenants.
