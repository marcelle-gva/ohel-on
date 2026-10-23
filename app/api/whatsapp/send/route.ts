import { ApiError, getApiContext, jsonApiError, requireModulePermission } from "@/lib/server/supabase-admin";
import { decryptSecret } from "@/lib/server/secret-encryption";

export const dynamic = "force-dynamic";

type RecipientType = "membro" | "responsavel_kids";
type Recipient = { id: string; type: RecipientType; name: string; phone: string | null };
type SendRequest = {
  recipients?: unknown;
  type?: unknown;
  text?: unknown;
  templateName?: unknown;
  language?: unknown;
  templateParameters?: unknown;
};
type MetaResponse = {
  messages?: Array<{ id?: string }>;
  error?: { message?: string };
};

function normalizeRecipient(value: unknown): { id: string; type: RecipientType } | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string") return null;
  if (candidate.type !== "membro" && candidate.type !== "responsavel_kids") return null;
  return { id: candidate.id, type: candidate.type };
}

function formatPhone(phone: string | null) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12 || digits.length > 15) return null;
  return digits;
}

export async function POST(request: Request) {
  try {
    const context = await getApiContext(request);
    await requireModulePermission(context, "comunicacoes", ["criar", "editar"]);
    let body: SendRequest;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "O corpo da solicitação não é um JSON válido.");
    }

    const recipients = Array.isArray(body.recipients)
      ? body.recipients.map(normalizeRecipient).filter((recipient): recipient is { id: string; type: RecipientType } => Boolean(recipient))
      : [];
    const uniqueRecipients = [...new Map(recipients.map(recipient => [`${recipient.type}:${recipient.id}`, recipient])).values()];
    if (!uniqueRecipients.length || uniqueRecipients.length > 100) {
      throw new ApiError(400, "Selecione entre 1 e 100 destinatários com consentimento registrado.");
    }
    const type = body.type === "modelo" ? "modelo" : body.type === "texto" ? "texto" : null;
    if (!type) throw new ApiError(400, "Tipo de mensagem inválido.");
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const templateName = typeof body.templateName === "string" ? body.templateName.trim() : "";
    const language = typeof body.language === "string" && body.language.trim() ? body.language.trim() : "pt_BR";
    const templateParameters = Array.isArray(body.templateParameters)
      ? body.templateParameters.filter((value): value is string => typeof value === "string").map(value => value.trim())
      : [];
    if (type === "texto" && (!text || text.length > 4096)) {
      throw new ApiError(400, "A mensagem de texto deve ter entre 1 e 4.096 caracteres.");
    }
    if (type === "modelo" && !/^[a-zA-Z0-9_]{1,512}$/.test(templateName)) {
      throw new ApiError(400, "Informe o nome exato de um modelo aprovado pela Meta.");
    }
    if (templateParameters.length > 20 || templateParameters.some(value => value.length > 1024)) {
      throw new ApiError(400, "O modelo aceita no máximo 20 parâmetros de texto, com até 1.024 caracteres cada.");
    }

    const memberIds = uniqueRecipients.filter(recipient => recipient.type === "membro").map(recipient => recipient.id);
    const childIds = uniqueRecipients.filter(recipient => recipient.type === "responsavel_kids").map(recipient => recipient.id);
    if (childIds.length) await requireModulePermission(context, "infantil", ["ler"]);

    const { data: config, error: configError } = await context.admin
      .from("configuracoes_whatsapp")
      .select("phone_number_id, access_token_encrypted")
      .eq("igreja_id", context.churchId)
      .maybeSingle();
    if (configError) throw new ApiError(500, "Não foi possível ler a configuração do WhatsApp.");
    if (!config) throw new ApiError(409, "A instância do WhatsApp ainda não foi configurada.");

    const recipientsToSend: Recipient[] = [];
    if (memberIds.length) {
      const { data, error } = await context.admin
        .from("membros")
        .select("id, nome, telefone, whatsapp_opt_in")
        .eq("igreja_id", context.churchId)
        .eq("whatsapp_opt_in", true)
        .in("id", memberIds);
      if (error) throw new ApiError(500, "Não foi possível validar os membros destinatários.");
      if (!data || data.length !== memberIds.length) {
        throw new ApiError(400, "Todos os membros precisam ser desta igreja e ter consentimento WhatsApp registrado.");
      }
      recipientsToSend.push(...data.map(member => ({ id: member.id, type: "membro" as const, name: member.nome, phone: member.telefone })));
    }
    if (childIds.length) {
      const { data, error } = await context.admin
        .from("criancas")
        .select("id, nome, responsavel_nome, responsavel_telefone, responsavel_whatsapp_opt_in")
        .eq("igreja_id", context.churchId)
        .eq("responsavel_whatsapp_opt_in", true)
        .in("id", childIds);
      if (error) throw new ApiError(500, "Não foi possível validar os responsáveis Kids.");
      if (!data || data.length !== childIds.length) {
        throw new ApiError(400, "Todos os responsáveis precisam ser desta igreja e ter consentimento WhatsApp registrado.");
      }
      recipientsToSend.push(...data.map(child => ({
        id: child.id,
        type: "responsavel_kids" as const,
        name: child.responsavel_nome || child.nome,
        phone: child.responsavel_telefone,
      })));
    }

    const version = process.env.META_GRAPH_API_VERSION ?? "v23.0";
    if (!/^v\d+\.\d+$/.test(version)) throw new ApiError(503, "META_GRAPH_API_VERSION está configurada em formato inválido.");
    const token = decryptSecret(config.access_token_encrypted);
    const results: Array<{ recipientId: string; name: string; status: "aceita" | "falhou"; error?: string }> = [];
    const loggingErrors: string[] = [];

    for (const recipient of recipientsToSend) {
      const phone = formatPhone(recipient.phone);
      let providerMessageId: string | null = null;
      let failure: string | null = phone ? null : "Telefone ausente ou inválido; atualize o cadastro.";

      if (phone) {
        try {
          const payload = type === "texto"
            ? { messaging_product: "whatsapp", recipient_type: "individual", to: phone, type: "text", text: { preview_url: false, body: text } }
            : {
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: phone,
              type: "template",
              template: {
                name: templateName,
                language: { code: language },
                ...(templateParameters.length ? {
                  components: [{
                    type: "body",
                    parameters: templateParameters.map(value => ({ type: "text", text: value })),
                  }],
                } : {}),
              },
            };
          const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(config.phone_number_id)}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            cache: "no-store",
          });
          const result = await response.json() as MetaResponse;
          if (!response.ok) failure = result.error?.message ?? `A Meta recusou a mensagem (HTTP ${response.status}).`;
          else providerMessageId = result.messages?.[0]?.id ?? null;
          if (response.ok && !providerMessageId) failure = "A Meta não retornou um identificador para confirmar o envio.";
        } catch (sendError) {
          failure = sendError instanceof Error ? sendError.message : "Não foi possível confirmar a resposta da Meta.";
        }
      }

      const status = providerMessageId && !failure ? "aceita" : "falhou";
      const { error: logError } = await context.admin.from("mensagens_whatsapp").insert({
        igreja_id: context.churchId,
        destinatario_membro_id: recipient.type === "membro" ? recipient.id : null,
        destinatario_crianca_id: recipient.type === "responsavel_kids" ? recipient.id : null,
        destinatario_telefone: phone ?? recipient.phone ?? "",
        tipo: type,
        conteudo: type === "texto" ? text : templateName,
        nome_modelo: type === "modelo" ? templateName : null,
        idioma_modelo: type === "modelo" ? language : null,
        status,
        provider_message_id: providerMessageId,
        erro: failure,
        created_by: context.user.id,
      });
      if (logError) loggingErrors.push(recipient.id);
      results.push({
        recipientId: recipient.id,
        name: recipient.name,
        status,
        ...(failure ? { error: failure } : {}),
      });
    }

    const accepted = results.filter(result => result.status === "aceita").length;
    const failed = results.length - accepted;
    return Response.json({
      accepted,
      failed,
      results,
      historyIncompleteFor: loggingErrors,
      message: loggingErrors.length
        ? "Uma ou mais respostas da Meta não foram gravadas no histórico. Não repita essas mensagens sem verificar o estado na Meta."
        : accepted
          ? "A Meta aceitou a solicitação de envio. A entrega final depende do webhook da Meta."
          : "Nenhuma mensagem foi aceita pela Meta.",
    }, { status: loggingErrors.length ? 207 : 200 });
  } catch (error) {
    return jsonApiError(error);
  }
}
