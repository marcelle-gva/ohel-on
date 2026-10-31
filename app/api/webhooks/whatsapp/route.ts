import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

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

  try {
    JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON payload.", { status: 400 });
  }

  return Response.json({ received: true });
}
