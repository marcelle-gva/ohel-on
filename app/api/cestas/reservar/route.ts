import { createClient } from "@supabase/supabase-js";
import { normalizeBrazilianPhone } from "@/lib/whatsapp-server";

export const runtime = "nodejs";
export const maxDuration = 30;

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v23.0";

type Reserva = {
  id: string;
  igreja_id: string;
  nome_doador: string;
  telefone: string | null;
  whatsapp_opt_in: boolean;
  item_nome: string;
  unidade: string;
  quantidade: number;
  cesta_nome: string;
};

async function enviarTemplate(telefone: string, texto: string) {
  const accessToken = process.env.META_WA_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) return { status: "nao_configurado", erro: "Credenciais Meta ausentes" };

  const templateName = process.env.META_CESTA_TEMPLATE_NAME || "cesta_doacao_reserva";
  const languageCode = process.env.META_CESTA_TEMPLATE_LANGUAGE || "pt_BR";
  const phone = normalizeBrazilianPhone(telefone);
  if (!phone) return { status: "telefone_invalido", erro: "Telefone inválido" };

  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: { name: templateName, language: { code: languageCode }, components: [{ type: "body", parameters: [{ type: "text", text: texto.slice(0, 1024) }] }] },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json() as { messages?: Array<{ id?: string }>; error?: { message?: string } };
    if (!response.ok || !result.messages?.[0]?.id) return { status: "falhou", erro: result.error?.message || "A Meta não aceitou a mensagem" };
    return { status: "enviado", messageId: result.messages[0].id };
  } catch {
    return { status: "falhou", erro: "Falha de comunicação com a API da Meta" };
  }
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!url || !anonKey || !token) return Response.json({ error: "Faça login na Área do Membro para reservar um item." }, { status: 401 });

  let body: { itemId?: unknown; quantidade?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Corpo inválido." }, { status: 400 }); }
  const itemId = typeof body.itemId === "string" ? body.itemId : "";
  const quantidade = Number(body.quantidade);
  if (!/^[0-9a-f-]{36}$/i.test(itemId) || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 100) {
    return Response.json({ error: "Item ou quantidade inválida." }, { status: 400 });
  }

  const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: reserva, error: reservaError } = await authClient.rpc("reservar_item_cesta", { p_item_id: itemId, p_quantidade: quantidade });
  if (reservaError || !reserva) return Response.json({ error: reservaError?.message || "Não foi possível reservar este item." }, { status: 409 });

  const dados = reserva as Reserva;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!serviceKey) return Response.json({ ok: true, reserva: dados, notificacoes: "pendentes_configuracao" });

  const serviceClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: responsaveis } = await serviceClient.from("cestas_responsaveis").select("id, nome, telefone").eq("igreja_id", dados.igreja_id).eq("ativo", true).eq("notificar_reserva", true);
  const texto = `${dados.nome_doador} reservou ${dados.quantidade} ${dados.unidade} de ${dados.item_nome} para a cesta ${dados.cesta_nome}.`;

  const resultadosResponsaveis = await Promise.all((responsaveis || []).map((responsavel) => enviarTemplate(responsavel.telefone, texto)));
  const statusResponsaveis = resultadosResponsaveis.length === 0 ? "sem_destinatario" : resultadosResponsaveis.every((resultado) => resultado.status === "enviado") ? "enviado" : resultadosResponsaveis.some((resultado) => resultado.status === "enviado") ? "parcial" : resultadosResponsaveis[0].status;
  const resultadoDoador = dados.whatsapp_opt_in && dados.telefone ? await enviarTemplate(dados.telefone, `Olá, ${dados.nome_doador}! Sua reserva de ${dados.quantidade} ${dados.unidade} de ${dados.item_nome} foi registrada para a cesta ${dados.cesta_nome}.`) : { status: dados.whatsapp_opt_in ? "sem_telefone" : "nao_autorizado" };

  await serviceClient.from("cesta_doacoes").update({ whatsapp_doador_status: resultadoDoador.status, whatsapp_responsaveis_status: statusResponsaveis, whatsapp_detalhes: { doador: resultadoDoador, responsaveis: resultadosResponsaveis } }).eq("id", dados.id).eq("igreja_id", dados.igreja_id);
  return Response.json({ ok: true, reserva: dados, notificacoes: { doador: resultadoDoador.status, responsaveis: statusResponsaveis } });
}
