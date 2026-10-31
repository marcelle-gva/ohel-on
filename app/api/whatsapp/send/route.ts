import { authorizeWhatsappAdmin, normalizeBrazilianPhone } from "@/lib/whatsapp-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_RECIPIENTS = 250;
const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v23.0";

export async function GET(request: Request) {
  const authorization = await authorizeWhatsappAdmin(request);
  if (!authorization.context) return authorization.response;

  const { data, error } = await authorization.context.supabase
    .from("membros")
    .select("id, nome, telefone")
    .eq("igreja_id", authorization.context.igrejaId)
    .eq("status", "Ativo")
    .eq("whatsapp_opt_in", true)
    .not("telefone", "is", null)
    .limit(MAX_RECIPIENTS + 1);

  if (error) {
    return Response.json({ error: "Não foi possível consultar os contatos autorizados." }, { status: 503 });
  }

  const uniquePhones = new Set(
    (data ?? [])
      .map((member) => member.telefone ? normalizeBrazilianPhone(member.telefone) : null)
      .filter((phone): phone is string => phone !== null),
  );

  return Response.json({
    count: uniquePhones.size,
    exceedsLimit: (data?.length ?? 0) > MAX_RECIPIENTS,
    maxRecipients: MAX_RECIPIENTS,
  });
}

export async function POST(request: Request) {
  const authorization = await authorizeWhatsappAdmin(request);
  if (!authorization.context) return authorization.response;
  const { supabase, igrejaId, userId } = authorization.context;

  const accessToken = process.env.META_WA_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    return Response.json({ error: "A API de envio do WhatsApp ainda não está configurada na Vercel." }, { status: 503 });
  }

  let payload: {
    requestId?: unknown;
    templateName?: unknown;
    languageCode?: unknown;
    parameterText?: unknown;
    confirmConsent?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corpo da solicitação inválido." }, { status: 400 });
  }

  const requestId = typeof payload.requestId === "string" ? payload.requestId : "";
  const templateName = typeof payload.templateName === "string" ? payload.templateName.trim() : "";
  const languageCode = typeof payload.languageCode === "string" ? payload.languageCode.trim() : "";
  const parameterText = typeof payload.parameterText === "string" ? payload.parameterText.trim() : "";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return Response.json({ error: "Identificador de envio inválido." }, { status: 400 });
  }
  if (!/^[a-z0-9_]{1,512}$/i.test(templateName) || !/^[a-z]{2}_[A-Z]{2}$/.test(languageCode)) {
    return Response.json({ error: "Informe o nome e o idioma de um modelo aprovado na Meta." }, { status: 400 });
  }
  if (parameterText.length > 1024 || payload.confirmConsent !== true) {
    return Response.json({ error: "Confirme o consentimento dos destinatários e use um texto de até 1.024 caracteres." }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("whatsapp_comunicacoes")
    .select("id")
    .eq("igreja_id", igrejaId)
    .eq("request_id", requestId)
    .maybeSingle();
  if (existingError) {
    return Response.json({ error: "Não foi possível validar a solicitação de envio." }, { status: 503 });
  }
  if (existing) {
    return Response.json({ error: "Este envio já foi processado; não o repita para evitar mensagens duplicadas." }, { status: 409 });
  }

  const { data: members, error: membersError } = await supabase
    .from("membros")
    .select("id, nome, telefone")
    .eq("igreja_id", igrejaId)
    .eq("status", "Ativo")
    .eq("whatsapp_opt_in", true)
    .not("telefone", "is", null)
    .limit(MAX_RECIPIENTS + 1);

  if (membersError) {
    return Response.json({ error: "Não foi possível carregar os contatos autorizados." }, { status: 503 });
  }
  if ((members?.length ?? 0) > MAX_RECIPIENTS) {
    return Response.json({
      error: `O grupo excede o limite seguro de ${MAX_RECIPIENTS} destinatários por envio.`,
      maxRecipients: MAX_RECIPIENTS,
    }, { status: 413 });
  }

  const recipients = new Map<string, { memberId: string; name: string; phone: string }>();
  for (const member of members ?? []) {
    if (!member.telefone) continue;
    const phone = normalizeBrazilianPhone(member.telefone);
    if (phone && !recipients.has(phone)) {
      recipients.set(phone, { memberId: member.id, name: member.nome, phone });
    }
  }
  if (recipients.size === 0) {
    return Response.json({ error: "Não há membros ativos com telefone válido e consentimento para WhatsApp." }, { status: 422 });
  }

  const { data: communication, error: communicationError } = await supabase
    .from("whatsapp_comunicacoes")
    .insert({
      igreja_id: igrejaId,
      criado_por: userId,
      request_id: requestId,
      template_name: templateName,
      language_code: languageCode,
      parameter_text: parameterText || null,
      status: "enviando",
      total_destinatarios: recipients.size,
    })
    .select("id")
    .single();

  if (communicationError || !communication) {
    return Response.json({ error: "Não foi possível iniciar o registro do envio." }, { status: 503 });
  }

  const recipientRows = [...recipients.values()].map((recipient) => ({
    comunicacao_id: communication.id,
    igreja_id: igrejaId,
    membro_id: recipient.memberId,
    nome: recipient.name,
    telefone: recipient.phone,
    status: "na_fila",
  }));
  const { data: insertedRecipients, error: recipientsError } = await supabase
    .from("whatsapp_destinatarios")
    .insert(recipientRows)
    .select("id, telefone");

  if (recipientsError || !insertedRecipients) {
    await supabase.from("whatsapp_comunicacoes").delete().eq("id", communication.id);
    return Response.json({ error: "Não foi possível registrar os destinatários do envio." }, { status: 503 });
  }

  let accepted = 0;
  let failed = 0;
  let persistenceIssue = false;
  const endpoint = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  for (let offset = 0; offset < insertedRecipients.length; offset += 10) {
    const batch = insertedRecipients.slice(offset, offset + 10);
    await Promise.all(batch.map(async (recipient) => {
      const template: Record<string, unknown> = {
        name: templateName,
        language: { code: languageCode },
      };
      if (parameterText) {
        template.components = [{
          type: "body",
          parameters: [{ type: "text", text: parameterText }],
        }];
      }

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: recipient.telefone,
            type: "template",
            template,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        const result = await response.json() as {
          messages?: Array<{ id?: string }>;
          error?: { message?: string };
        };
        const messageId = result.messages?.[0]?.id;
        if (!response.ok || !messageId) {
          failed += 1;
          const { error: saveFailureError } = await supabase.from("whatsapp_destinatarios").update({
            status: "falhou",
            erro: result.error?.message?.slice(0, 500) || "A Meta não aceitou o envio.",
          }).eq("id", recipient.id);
          if (saveFailureError) persistenceIssue = true;
          return;
        }

        accepted += 1;
        const { error: saveSuccessError } = await supabase.from("whatsapp_destinatarios").update({
          status: "enviado",
          meta_message_id: messageId,
          enviado_em: new Date().toISOString(),
          erro: null,
        }).eq("id", recipient.id).eq("status", "na_fila");
        if (saveSuccessError) persistenceIssue = true;
      } catch {
        failed += 1;
        const { error: saveNetworkError } = await supabase.from("whatsapp_destinatarios").update({
          status: "falhou",
          erro: "Falha de comunicação com a API da Meta.",
        }).eq("id", recipient.id);
        if (saveNetworkError) persistenceIssue = true;
      }
    }));
  }

  const { data: finalRecipients, error: finalRecipientsError } = await supabase
    .from("whatsapp_destinatarios")
    .select("status")
    .eq("comunicacao_id", communication.id);
  if (finalRecipientsError || !finalRecipients) {
    return Response.json({ error: "O envio foi iniciado, mas não foi possível confirmar os resultados no histórico. Não repita imediatamente." }, { status: 503 });
  }

  accepted = finalRecipients.filter((recipient) => ["enviado", "entregue", "lido"].includes(recipient.status)).length;
  failed = finalRecipients.filter((recipient) => recipient.status === "falhou").length;
  const stillProcessing = finalRecipients.some((recipient) => recipient.status === "na_fila");
  const status = stillProcessing
    ? "enviando"
    : accepted === 0
      ? "falhou"
      : failed > 0
        ? "parcial"
        : "enviado";
  const { error: updateError } = await supabase
    .from("whatsapp_comunicacoes")
    .update({
      status,
      enviados: accepted,
      falhas: failed,
      concluido_em: new Date().toISOString(),
    })
    .eq("id", communication.id);

  if (updateError || persistenceIssue) {
    return Response.json({ error: "A Meta recebeu os envios, mas não foi possível salvar o resumo. Consulte o histórico antes de repetir." }, { status: 503 });
  }

  return Response.json({
    communicationId: communication.id,
    total: recipients.size,
    aceitosPelaMeta: accepted,
    falhas: failed,
    status,
  });
}
