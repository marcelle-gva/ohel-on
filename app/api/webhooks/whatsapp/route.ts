import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createWhatsappServiceClient } from "@/lib/whatsapp-server";

export const runtime = "nodejs";

type MetaStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: Array<{ title?: string; message?: string; code?: number }>;
};

type MetaWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: MetaStatus[];
      };
    }>;
  }>;
};

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function GET(request: Request) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) {
    return new Response("WhatsApp webhook verification is not configured.", { status: 500 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge || !safeEqual(token, verifyToken)) {
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    return new Response("WhatsApp webhook signature validation is not configured.", { status: 503 });
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (!signature?.startsWith("sha256=")) {
    return new Response("Missing webhook signature.", { status: 401 });
  }

  const rawBody = await request.text();
  const expectedSignature = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  if (!safeEqual(signature, expectedSignature)) {
    return new Response("Invalid webhook signature.", { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return new Response("Invalid JSON payload.", { status: 400 });
  }

  let supabase: SupabaseClient;
  try {
    supabase = createWhatsappServiceClient();
  } catch {
    return new Response("WhatsApp webhook storage is not configured.", { status: 503 });
  }

  const statuses = (payload.entry ?? [])
    .flatMap((entry) => entry.changes ?? [])
    .flatMap((change) => change.value?.statuses ?? []);

  for (const status of statuses) {
    const mappedStatus = status.status === "read"
      ? "lido"
      : status.status === "delivered"
        ? "entregue"
        : status.status === "sent"
          ? "enviado"
          : status.status === "failed"
            ? "falhou"
            : null;
    if (!status.id || !mappedStatus) continue;

    const { data: recipient, error: recipientError } = await supabase
      .from("whatsapp_destinatarios")
      .select("id, comunicacao_id, status")
      .eq("meta_message_id", status.id)
      .maybeSingle();

    if (recipientError) {
      return new Response("Could not read WhatsApp delivery status.", { status: 503 });
    }
    if (!recipient) continue;

    const rank = { na_fila: 0, enviado: 1, entregue: 2, lido: 3, falhou: 4 } as const;
    const currentRank = rank[recipient.status as keyof typeof rank] ?? 0;
    const nextRank = rank[mappedStatus];
    if (mappedStatus !== "falhou" && nextRank < currentRank) continue;

    const errorText = status.errors?.map((error) => error.message || error.title).filter(Boolean).join("; ").slice(0, 500) || null;
    const { error: updateRecipientError } = await supabase
      .from("whatsapp_destinatarios")
      .update({
        status: mappedStatus,
        erro: mappedStatus === "falhou" ? errorText || "A Meta informou falha na entrega." : null,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", recipient.id);

    if (updateRecipientError) {
      return new Response("Could not persist WhatsApp delivery status.", { status: 503 });
    }

    const { data: recipientStatuses, error: statusesError } = await supabase
      .from("whatsapp_destinatarios")
      .select("status")
      .eq("comunicacao_id", recipient.comunicacao_id);
    if (statusesError || !recipientStatuses) {
      return new Response("Could not summarize WhatsApp delivery status.", { status: 503 });
    }

    const accepted = recipientStatuses.filter((item) => ["enviado", "entregue", "lido"].includes(item.status)).length;
    const failed = recipientStatuses.filter((item) => item.status === "falhou").length;
    const queued = recipientStatuses.some((item) => item.status === "na_fila");
    const overallStatus = queued
      ? "enviando"
      : accepted === 0
        ? "falhou"
        : failed > 0
          ? "parcial"
          : "enviado";
    const { error: updateCommunicationError } = await supabase
      .from("whatsapp_comunicacoes")
      .update({ enviados: accepted, falhas: failed, status: overallStatus })
      .eq("id", recipient.comunicacao_id);
    if (updateCommunicationError) {
      return new Response("Could not update WhatsApp communication summary.", { status: 503 });
    }
  }

  return Response.json({ received: true });
}
