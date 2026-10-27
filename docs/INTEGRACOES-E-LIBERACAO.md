# Integrações e liberação do OHEL ON

Checklist operacional para ativar os envios de cartas e liberar as alterações atuais.
Não inclua valores de chaves neste arquivo, no Git ou em mensagens.

## Estado confirmado no código

- [x] O envio de e-mail de cartas usa Resend; permite escolher igrejas cadastradas com e-mail válido.
- [x] O envio de carta pelo WhatsApp usa mensagem de texto, com validação de consentimento do membro e da resposta da Meta.
- [x] O painel de WhatsApp permite salvar credenciais criptografadas e testar a conexão.
- [x] Há suporte a atualização de status do WhatsApp por webhook da Meta.
- [x] A prévia, a impressão e os envios usam o mesmo modelo renderizado.
- [x] O painel emocional conta as emoções registradas e mostra erros de consulta.
- [x] O pré-cadastro tem navegação explícita entre etapas e botão de envio acessível na etapa final.
- [x] O corpo da página permite rolagem e o painel usa altura dinâmica e rolagem interna com `min-height: 0`.
- [x] TypeScript, lint direcionado e build de produção passaram localmente; o build foi feito com valores fictícios de Supabase.
- [x] A navegação das três etapas e a mensagem para falha ao carregar congregações foram verificadas no navegador local.

## Pendências de banco de dados

- [x] Confirmar no esquema de produção a coluna `modelos_cartas.imagem_cabecalho_url`, adicionada por `supabase/migrations/20261023170000_letter_custom_header.sql`.
- [x] Confirmar no esquema de produção as tabelas e colunas esperadas de PIN e auditoria (`pedidos_oracao_pins` e `pedidos_oracao_aprovacoes_log`). A consulta anônima foi negada, conforme esperado para tabelas protegidas.
- [ ] Confirmar por consulta administrativa que as funções, trigger e políticas da migration `20261023160000_prayer_approval_pin_audit.sql` estão instalados; a consulta REST sem autenticação não verifica esses objetos.
- [ ] Após cada migration, confirmar no Supabase que terminou sem erro antes de publicar/usar a funcionalidade correspondente.

## Variáveis de ambiente da Vercel

Configurar no projeto Vercel, ambiente **Production** (e Preview apenas se for testar lá), depois fazer novo deploy:

| Variável | Origem / uso |
|---|---|
| `RESEND_API_KEY` | Chave secreta criada no Resend; necessária para enviar e-mails. |
| `RESEND_FROM_EMAIL` | Remetente verificado no Resend, por exemplo `OHEL ON <cartas@seudominio.com>`. Não é uma chave. |
| `OHEL_INTEGRATION_ENCRYPTION_KEY` | Segredo aleatório forte com pelo menos 32 caracteres; criptografa o token WhatsApp salvo no Supabase. Defina antes de salvar as credenciais e não o altere depois sem um plano de recriptografia. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Valor secreto escolhido por você; deve ser idêntico ao token informado na configuração do webhook da Meta. |
| `META_APP_SECRET` | App Secret do aplicativo Meta; usado para validar a assinatura dos webhooks recebidos. |
| `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY` | Chave de servidor usada pelas APIs protegidas. Confirmar que existe na Vercel. Nunca usar prefixo `NEXT_PUBLIC_` para esta chave. |
| `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Configuração pública do cliente Supabase; confirmar que já está correta na Vercel. |
| `META_GRAPH_API_VERSION` | Opcional; o código usa `v23.0` como padrão. Só definir se a versão desejada estiver disponível na Meta. |

Nunca cole chaves em chamados, no editor do repositório, no navegador ou neste checklist. Use somente os painéis oficiais do provedor e da Vercel.

## Configuração do Resend

- [ ] Adicionar e verificar no Resend o domínio remetente.
- [ ] Publicar os registros DNS solicitados pelo Resend (incluindo SPF/DKIM) e aguardar a verificação.
- [ ] Criar uma API key com o menor escopo possível e cadastrá-la como `RESEND_API_KEY` na Vercel.
- [ ] Definir `RESEND_FROM_EMAIL` com o endereço verificado.
- [ ] Fazer deploy após as variáveis e DNS estarem prontos.
- [ ] Enviar uma carta de teste para um endereço controlado e confirmar aceitação e recebimento. A API informa aceitação do Resend; isso, por si só, não garante entrega na caixa de entrada.

## Configuração do WhatsApp / Meta

- [ ] Definir `OHEL_INTEGRATION_ENCRYPTION_KEY`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` e `META_APP_SECRET` na Vercel e fazer deploy.
- [ ] Em **Configurações > Comunicações** no OHEL ON, salvar o Phone Number ID, WhatsApp Business Account ID e token de acesso da Meta.
- [ ] Usar **Testar conexão** e confirmar que a Meta validou a instância.
- [ ] Copiar a URL do webhook exibida na tela de configuração e cadastrá-la no aplicativo Meta; usar o mesmo `WHATSAPP_WEBHOOK_VERIFY_TOKEN` e assinar o campo `messages`.
- [ ] Confirmar na tela que webhook e chave de criptografia aparecem configurados.
- [ ] Registrar telefone válido e consentimento WhatsApp dos membros antes de selecioná-los.
- [ ] Testar com um destinatário controlado; depois verificar o histórico e os estados enviados/entregues/lidos pelo webhook.

O WhatsApp de cartas envia texto, não PDF. O fluxo atual exige consentimento, aceita até 100 destinatários por chamada da API geral e a carta deve caber no limite de 4.096 caracteres. A Meta pode exigir modelo previamente aprovado fora da janela de atendimento de 24 horas; o botão de carta usa envio de texto e não converte automaticamente o conteúdo para um modelo aprovado.

## Publicação e teste ponta a ponta

- [ ] Revisar e preservar todas as mudanças locais; elas ainda precisam ser incorporadas ao branch publicado.
- [ ] Confirmar que a migration de cabeçalho foi aplicada no Supabase de produção.
- [ ] Configurar variáveis e integrações acima sem expor valores.
- [ ] Fazer commit/push pelo fluxo do projeto e aguardar o deploy de produção da Vercel.
- [ ] Validar login, acesso por igreja e permissões de emissão no domínio canônico.
- [ ] Criar ou editar um modelo, testar variáveis, cabeçalho/rodapé personalizados, prévia, impressão e envio.
- [ ] Testar uma igreja sem e-mail, um membro sem consentimento WhatsApp e uma falha de provedor; o sistema deve mostrar que não enviou.
- [ ] Abrir o QR de pré-cadastro em Android, preencher as três etapas com teclado aberto, aceitar o consentimento e confirmar que o cadastro pendente aparece na secretaria; não testar com dados reais sem autorização.
- [ ] Testar rolagem em páginas longas do painel em Android, incluindo menu lateral, cabeçalho fixo e cards no final da página.
- [ ] No painel emocional, testar os períodos **Mês** e **Tudo** e confirmar que aparecem registros reais da igreja correta.
- [ ] Se o PIN/auditoria de orações fizer parte da mesma liberação, confirmar a migration de orações, configurar PIN de cada liderança autorizada e testar aprovação por líder e admin, incluindo o registro de auditoria.

## Limitações que permanecem

- O envio de e-mail reporta aceitação/falha na tela, mas ainda não grava um histórico persistente de e-mails no banco.
- O acompanhamento emocional mostra emoções existentes nos registros; não há catálogo administrativo de emoções identificado neste fluxo.
- O pré-cadastro foi verificado no navegador local, mas o envio real depende das políticas RLS e da conectividade do Supabase de produção; ainda precisa ser testado em Android.
- A consulta de produção verificou apenas a disponibilidade do esquema por consultas sem linhas retornadas; nenhum dado de membro foi lido, e nenhuma migration ou dado foi alterado.
- As variáveis de produção do Resend e da Meta/WhatsApp não estão cadastradas na Vercel; os respectivos envios permanecem pendentes de configuração.
- Não foi feito teste real com credenciais/provedores de e-mail ou WhatsApp. Os testes locais e as consultas de esquema não substituem as verificações operacionais acima.
