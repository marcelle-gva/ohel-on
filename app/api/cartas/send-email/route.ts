import sanitizeHtml from "sanitize-html";
import { buildLetterHtml, type OpcoesCarta } from "@/lib/cartas";
import { ApiError, getApiContext, jsonApiError, requireModulePermission } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

type SendRequest = {
  modelId?: unknown;
  memberIds?: unknown;
  churchIds?: unknown;
  emissionDate?: unknown;
  options?: unknown;
};

type EmailResult = {
  member: string;
  church: string;
  status: "accepted" | "failed";
  error?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const maxEmailsPerRequest = 20;

function readIds(value: unknown, max: number, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) {
    throw new ApiError(400, `Selecione de 1 a ${max} ${label}.`);
  }
  const ids = [...new Set(value.filter((item): item is string => typeof item === "string"))];
  if (ids.length !== value.length || ids.some(id => !uuidPattern.test(id))) {
    throw new ApiError(400, `A lista de ${label} contém identificadores inválidos.`);
  }
  return ids;
}

function readOptions(value: unknown): OpcoesCarta {
  if (!value || typeof value !== "object") {
    throw new ApiError(400, "As opções do documento são inválidas.");
  }
  const options = value as Record<string, unknown>;
  const signatures = Array.isArray(options.assinaturas)
    ? options.assinaturas.map(signature => {
      if (!signature || typeof signature !== "object") throw new ApiError(400, "Uma assinatura é inválida.");
      const item = signature as Record<string, unknown>;
      if (typeof item.cargo !== "string" || typeof item.nome !== "string" || item.cargo.length > 100 || item.nome.length > 150) {
        throw new ApiError(400, "Uma assinatura contém dados inválidos.");
      }
      return { cargo: item.cargo.trim(), nome: item.nome.trim() };
    })
    : [];
  if (signatures.length > 8) throw new ApiError(400, "O documento aceita até oito assinaturas.");
  return {
    mostrarCabecalho: options.mostrarCabecalho === true,
    mostrarRodape: options.mostrarRodape === true,
    incluirAssinatura: options.incluirAssinatura === true,
    assinaturas: signatures,
  };
}

function validDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T12:00:00`).getTime())) {
    throw new ApiError(400, "Informe uma data de emissão válida.");
  }
  return value;
}

function validSender(value: string | undefined): string {
  const sender = value?.trim() ?? "";
  if (!sender || sender.length > 200 || /[\r\n]/.test(sender)) {
    throw new ApiError(503, "Configure RESEND_FROM_EMAIL com um remetente verificado no Resend.");
  }
  const address = sender.match(/<([^<>]+)>$/)?.[1] ?? sender;
  if (!emailPattern.test(address)) {
    throw new ApiError(503, "RESEND_FROM_EMAIL deve conter um endereço de e-mail válido e verificado.");
  }
  return sender;
}

export async function POST(request: Request) {
  try {
    const context = await getApiContext(request);
    await requireModulePermission(context, "comunicacoes", ["criar", "editar"]);
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new ApiError(503, "Configure RESEND_API_KEY no ambiente de produção da Vercel.");
    const sender = validSender(process.env.RESEND_FROM_EMAIL);

    let body: SendRequest;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "O corpo da solicitação não é um JSON válido.");
    }
    if (typeof body.modelId !== "string" || !uuidPattern.test(body.modelId)) {
      throw new ApiError(400, "Selecione um modelo de carta válido.");
    }
    const memberIds = readIds(body.memberIds, maxEmailsPerRequest, "membros");
    const churchIds = readIds(body.churchIds, maxEmailsPerRequest, "igrejas destinatárias");
    if (memberIds.length * churchIds.length > maxEmailsPerRequest) {
      throw new ApiError(400, `O envio permite no máximo ${maxEmailsPerRequest} cartas por solicitação.`);
    }
    const emissionDate = validDate(body.emissionDate);
    const options = readOptions(body.options);

    const [modelResult, churchResult, membersResult, recipientsResult] = await Promise.all([
      context.admin.from("modelos_cartas").select("*").eq("igreja_id", context.churchId).eq("id", body.modelId).maybeSingle(),
      context.admin.from("igrejas").select("*").eq("id", context.churchId).maybeSingle(),
      context.admin.from("membros").select("*, congregacoes(nome)").eq("igreja_id", context.churchId).in("id", memberIds),
      context.admin.from("igrejas").select("id, nome, email").in("id", churchIds),
    ]);
    if (modelResult.error || churchResult.error || membersResult.error || recipientsResult.error) {
      throw new ApiError(500, "Não foi possível validar os dados das cartas e destinatários.");
    }
    if (!modelResult.data || !churchResult.data) throw new ApiError(404, "Modelo ou igreja remetente não encontrados.");
    if ((membersResult.data ?? []).length !== memberIds.length) {
      throw new ApiError(400, "Um ou mais membros não pertencem à igreja remetente.");
    }
    const recipients = recipientsResult.data ?? [];
    if (recipients.length !== churchIds.length || recipients.some(church => typeof church.email !== "string" || !emailPattern.test(church.email.trim()))) {
      throw new ApiError(400, "Todas as igrejas selecionadas precisam ter um e-mail válido cadastrado.");
    }

    const allowedTags = ["p", "div", "span", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4"];
    const safeContent = sanitizeHtml(modelResult.data.conteudo ?? "", {
      allowedTags,
      allowedAttributes: {},
      disallowedTagsMode: "discard",
    });
    const results: EmailResult[] = [];

    for (const member of membersResult.data ?? []) {
      for (const recipient of recipients) {
        const html = buildLetterHtml(modelResult.data, member, churchResult.data, emissionDate, options, safeContent, recipient);
        let status: EmailResult["status"] = "failed";
        let failure = "O Resend não confirmou a aceitação da mensagem.";
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: sender,
              to: [recipient.email.trim()],
              subject: `${modelResult.data.nome} — ${member.nome}`,
              html,
              ...(typeof churchResult.data.email === "string" && emailPattern.test(churchResult.data.email)
                ? { reply_to: churchResult.data.email }
                : {}),
            }),
            cache: "no-store",
          });
          const result = await response.json().catch(() => null) as { id?: string; message?: string; name?: string } | null;
          if (!response.ok) {
            failure = result?.message ?? `O Resend recusou a mensagem (HTTP ${response.status}).`;
          } else if (typeof result?.id === "string" && result.id) {
            status = "accepted";
            failure = "";
          }
        } catch (sendError) {
          failure = sendError instanceof Error ? sendError.message : "Não foi possível confirmar a resposta do Resend.";
        }
        results.push({
          member: member.nome,
          church: recipient.nome,
          status,
          ...(failure ? { error: failure } : {}),
        });
      }
    }

    const accepted = results.filter(result => result.status === "accepted").length;
    const failed = results.length - accepted;
    return Response.json({
      accepted,
      failed,
      results,
      message: accepted
        ? "O Resend confirmou a aceitação dos e-mails. A entrega final depende do provedor destinatário."
        : "Nenhum e-mail foi aceito pelo Resend.",
    }, { status: failed ? 207 : 200 });
  } catch (error) {
    return jsonApiError(error);
  }
}
