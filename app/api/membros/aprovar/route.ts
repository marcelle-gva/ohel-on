import { resolverAcesso, respostaErroAcesso } from "@/lib/access-server";
import { podeAcessar } from "@/lib/access";
import { normalizeBrazilianPhone } from "@/lib/whatsapp-server";

export const runtime = "nodejs";
export const maxDuration = 20;

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v23.0";

async function enviarAvisoAprovacao(telefone: string, nome: string, link: string) {
  const accessToken = process.env.META_WA_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) return { status: "nao_configurado", detalhe: "Credenciais da Meta não configuradas na Vercel." };

  const phone = normalizeBrazilianPhone(telefone);
  if (!phone) return { status: "telefone_invalido", detalhe: "O telefone do membro não é válido." };

  const templateName = process.env.META_MEMBER_APPROVAL_TEMPLATE_NAME || "membro_aprovado";
  const languageCode = process.env.META_MEMBER_APPROVAL_TEMPLATE_LANGUAGE || "pt_BR";
  const texto = `Olá, ${nome}! Seu cadastro foi aprovado. Acesse a Área do Membro por este link: ${link}`;

  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [{ type: "body", parameters: [{ type: "text", text: texto.slice(0, 1024) }] }],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json() as { messages?: Array<{ id?: string }>; error?: { message?: string } };
    if (!response.ok || !result.messages?.[0]?.id) return { status: "falhou", detalhe: result.error?.message || "A Meta não aceitou a mensagem." };
    return { status: "enviado", messageId: result.messages[0].id };
  } catch {
    return { status: "falhou", detalhe: "Falha de comunicação com a API do WhatsApp." };
  }
}

export async function POST(request: Request) {
  let body: { id?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Corpo da solicitação inválido." }, { status: 400 }); }
  const membroId = typeof body.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(membroId)) return Response.json({ error: "Identificador de membro inválido." }, { status: 400 });

  let acesso;
  try { acesso = await resolverAcesso(request); }
  catch (error) { return respostaErroAcesso(error); }
  const { contexto, service: serviceClient } = acesso;
  if (!["admin", "pastor", "secretaria"].includes(contexto.role) && !podeAcessar(contexto, "membros", "aprovar")) return Response.json({ error: "Você não tem permissão para aprovar pré-cadastros." }, { status: 403 });
  const perfil = { igreja_id: contexto.igrejaId };

  const { data: membro, error: membroError } = await serviceClient.from("membros").select("id, nome, telefone, email, whatsapp_opt_in, status").eq("id", membroId).eq("igreja_id", perfil.igreja_id).maybeSingle();
  if (membroError || !membro) return Response.json({ error: "Pré-cadastro não encontrado nesta igreja." }, { status: 404 });
  if (membro.status !== "Pré-Cadastro") return Response.json({ error: "Este cadastro já foi processado." }, { status: 409 });

  const { data: atualizado, error: updateError } = await serviceClient.from("membros").update({ status: "Ativo" }).eq("id", membro.id).eq("igreja_id", perfil.igreja_id).select("id, status").maybeSingle();
  if (updateError || !atualizado) return Response.json({ error: updateError?.message || "Não foi possível atualizar o status do membro." }, { status: 409 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  const link = `${appUrl}/login-membro`;
  const whatsapp = membro.whatsapp_opt_in && membro.telefone
    ? await enviarAvisoAprovacao(membro.telefone, membro.nome, link)
    : { status: "nao_autorizado", detalhe: "O membro não autorizou mensagens WhatsApp no cadastro." };

  return Response.json({ ok: true, status: atualizado.status, whatsapp, link });
}
