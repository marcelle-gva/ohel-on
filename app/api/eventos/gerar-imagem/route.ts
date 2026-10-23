import { createHash } from "node:crypto";
import { ApiError, getApiContext, jsonApiError, requireModulePermission } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const context = await getApiContext(request);
    await requireModulePermission(context, "eventos", ["criar", "editar"]);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new ApiError(503, "Configure OPENAI_API_KEY no ambiente Production da Vercel.");

    let body: { eventName?: unknown; direction?: unknown };
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "O corpo da solicitação não é um JSON válido.");
    }
    const eventName = typeof body.eventName === "string" ? body.eventName.trim() : "";
    const direction = typeof body.direction === "string" ? body.direction.trim() : "";
    if (!eventName || eventName.length > 160 || !direction || direction.length > 1500) {
      throw new ApiError(400, "Informe o nome do evento e uma descrição visual de até 1.500 caracteres.");
    }

    const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-sunburst";
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: `Create a polished, premium event poster artwork for a church event called "${eventName}". Visual direction: ${direction}. Produce artwork only: no text, no letters, no dates, no logos, no watermarks. Use a respectful, welcoming visual style and a clear focal point.`,
        size: "1024x1024",
        n: 1,
        safety_identifier: createHash("sha256").update(context.user.id).digest("hex"),
      }),
      cache: "no-store",
    });
    const result = await response.json() as {
      data?: Array<{ b64_json?: string }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      console.error("OpenAI image generation failed:", response.status, result.error?.message ?? "Unknown provider error");
      throw new ApiError(502, "A geração da imagem foi recusada. Verifique o modelo, os créditos e a chave da OpenAI.");
    }
    const imageBase64 = result.data?.[0]?.b64_json;
    if (!imageBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
      throw new ApiError(502, "A API de imagens não retornou um arquivo válido.");
    }
    return Response.json({ imageBase64, mimeType: "image/png" });
  } catch (error) {
    return jsonApiError(error);
  }
}
