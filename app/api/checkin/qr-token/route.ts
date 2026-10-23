import { createHash, randomBytes } from "node:crypto";
import { ApiError, getApiContext, jsonApiError, requireModulePermission } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const context = await getApiContext(request);
    await requireModulePermission(context, "configuracoes", ["ler"]);

    const { data: serverTime, error: timeError } = await context.admin.rpc("get_server_time");
    if (timeError) throw new ApiError(500, "Não foi possível validar o horário do servidor.");
    const now = new Date(serverTime);
    if (Number.isNaN(now.getTime())) throw new ApiError(500, "O horário do servidor está indisponível.");

    const { error: cleanupError } = await context.admin
      .from("checkin_qr_tokens")
      .delete()
      .eq("igreja_id", context.churchId)
      .lt("expires_at", new Date(now.getTime() - 60 * 60 * 1000).toISOString());
    if (cleanupError) throw new ApiError(500, "Não foi possível preparar um novo código de check-in.");

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + 2 * 60 * 1000).toISOString();
    const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
    const { error: insertError } = await context.admin.from("checkin_qr_tokens").insert({
      igreja_id: context.churchId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: context.user.id,
    });
    if (insertError) throw new ApiError(500, "Não foi possível criar o código de check-in.");

    return Response.json({ token, expiresAt });
  } catch (error) {
    return jsonApiError(error);
  }
}
