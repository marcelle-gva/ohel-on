# WhatsApp na aprovação do membro

A aprovação de um pré-cadastro chama a rota server-side `/api/membros/aprovar`. Depois de alterar o status para `Ativo`, ela envia um template da WhatsApp Cloud API somente quando o membro marcou o consentimento específico de WhatsApp no pré-cadastro.

## Template na Meta

Crie e aprove um template transacional, em português, com o nome `membro_aprovado` ou outro nome definido na variável abaixo. O corpo deve conter uma variável de texto (`{{1}}`). O sistema envia nessa variável uma mensagem com o nome do membro, a confirmação da aprovação e o link da Área do Membro.

## Variáveis na Vercel Production

```text
META_WA_ACCESS_TOKEN=...
META_WA_PHONE_NUMBER_ID=...
META_GRAPH_API_VERSION=v23.0
META_MEMBER_APPROVAL_TEMPLATE_NAME=membro_aprovado
META_MEMBER_APPROVAL_TEMPLATE_LANGUAGE=pt_BR
NEXT_PUBLIC_APP_URL=https://www.ipocloud.com.br
SUPABASE_SERVICE_ROLE_KEY=...
```

A aprovação é mantida mesmo se o envio falhar. A tela informa se a mensagem foi enviada, se faltou consentimento ou se a Meta ainda não está configurada.
