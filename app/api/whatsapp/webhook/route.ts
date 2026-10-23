import { createHmac, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) return Response.json({ error: "Webhook não configurado." }, { status: 503 });
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode !== "subscribe" || token !== verifyToken || !challenge) {
    return Response.json({ error: "Verificação do webhook recusada." }, { status: 403 });
  }
  return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return Response.json({ error: "Webhook não configurado." }, { status: 503 });
  const rawBody = await request.text();
  const suppliedSignature = request.headers.get("x-hub-signature-256") ?? "";
  const expectedSignature = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return Response.json({ error: "Assinatura do webhook inválida." }, { status: 401 });
  }

  let payload: {
    entry?: Array<{
      changes?: Array<{
        value?: { statuses?: Array<{ id?: string; status?: string; errors?: Array<{ title?: string }> }> };
      }>;
    }>;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  try {
    const admin = createServiceClient();
    const statusMap: Record<string, "enviada" | "entregue" | "lida" | "falhou"> = {
      sent: "enviada",
      delivered: "entregue",
      read: "lida",
      failed: "falhou",
    };
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const status of change.value?.statuses ?? []) {
          if (!status.id || !status.status || !statusMap[status.status]) continue;
          const { error } = await admin.from("mensagens_whatsapp")
            .update({
              status: statusMap[status.status],
              erro: status.status === "failed" ? status.errors?.[0]?.title ?? "Falha reportada pela Meta." : null,
              updated_at: new Date().toISOString(),
            })
            .eq("provider_message_id", status.id);
          if (error) throw error;
        }
      }
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Falha ao atualizar status de mensagem WhatsApp:", error);
    return Response.json({ error: "Não foi possível atualizar o histórico de entrega." }, { status: 500 });
  }
}
