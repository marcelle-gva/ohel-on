import { ApiError, getApiContext, jsonApiError } from "@/lib/server/supabase-admin";
import { decryptSecret, encryptSecret } from "@/lib/server/secret-encryption";

export const dynamic = "force-dynamic";

async function getChurchAdmin(request: Request) {
  const context = await getApiContext(request);
  if (context.role !== "admin") throw new ApiError(403, "Somente o administrador da igreja pode configurar a instância.");
  return context;
}

export async function GET(request: Request) {
  try {
    const context = await getChurchAdmin(request);
    const { data, error } = await context.admin
      .from("configuracoes_whatsapp")
      .select("phone_number_id, business_account_id, display_phone_number, updated_at")
      .eq("igreja_id", context.churchId)
      .maybeSingle();
    if (error) throw new ApiError(500, "Não foi possível carregar a configuração do WhatsApp.");
    return Response.json({
      configured: Boolean(data),
      phoneNumberId: data?.phone_number_id ?? "",
      businessAccountId: data?.business_account_id ?? "",
      displayPhoneNumber: data?.display_phone_number ?? "",
      updatedAt: data?.updated_at ?? null,
      encryptionKeyConfigured: (process.env.OHEL_INTEGRATION_ENCRYPTION_KEY?.length ?? 0) >= 32,
      webhookUrl: `${new URL(request.url).origin}/api/whatsapp/webhook`,
      webhookConfigured: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && process.env.META_APP_SECRET),
    });
  } catch (error) {
    return jsonApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await getChurchAdmin(request);
    let body: {
      phoneNumberId?: unknown;
      businessAccountId?: unknown;
      displayPhoneNumber?: unknown;
      accessToken?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "O corpo da solicitação não é um JSON válido.");
    }

    const phoneNumberId = typeof body.phoneNumberId === "string" ? body.phoneNumberId.trim() : "";
    const businessAccountId = typeof body.businessAccountId === "string" ? body.businessAccountId.trim() : "";
    const displayPhoneNumber = typeof body.displayPhoneNumber === "string" ? body.displayPhoneNumber.trim() : "";
    const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
    if (!/^\d{5,30}$/.test(phoneNumberId) || !/^\d{5,30}$/.test(businessAccountId)) {
      throw new ApiError(400, "Informe os IDs numéricos válidos da instância Meta.");
    }

    let encryptedToken: string;
    if (accessToken.length >= 20) {
      encryptedToken = encryptSecret(accessToken);
    } else if (accessToken.length === 0) {
      const { data: current, error: currentError } = await context.admin
        .from("configuracoes_whatsapp")
        .select("access_token_encrypted")
        .eq("igreja_id", context.churchId)
        .maybeSingle();
      if (currentError) throw new ApiError(500, "Não foi possível validar o token já configurado.");
      if (!current?.access_token_encrypted) {
        throw new ApiError(400, "Informe um token de acesso válido da Meta.");
      }
      encryptedToken = current.access_token_encrypted;
    } else {
      throw new ApiError(400, "O token da Meta deve ter pelo menos 20 caracteres.");
    }

    const { error } = await context.admin.from("configuracoes_whatsapp").upsert({
      igreja_id: context.churchId,
      phone_number_id: phoneNumberId,
      business_account_id: businessAccountId,
      display_phone_number: displayPhoneNumber || null,
      access_token_encrypted: encryptedToken,
      created_by: context.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "igreja_id" });
    if (error) throw new ApiError(500, "Não foi possível salvar a configuração da instância.");

    return Response.json({ saved: true });
  } catch (error) {
    return jsonApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getChurchAdmin(request);
    const { data, error } = await context.admin
      .from("configuracoes_whatsapp")
      .select("phone_number_id, access_token_encrypted")
      .eq("igreja_id", context.churchId)
      .single();
    if (error || !data) throw new ApiError(404, "Configure a instância antes de testar a conexão.");

    const token = decryptSecret(data.access_token_encrypted);
    const version = process.env.META_GRAPH_API_VERSION ?? "v23.0";
    if (!/^v\d+\.\d+$/.test(version)) throw new ApiError(503, "META_GRAPH_API_VERSION está configurada em formato inválido.");
    const response = await fetch(
      `https://graph.facebook.com/${version}/${encodeURIComponent(data.phone_number_id)}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    const result = await response.json() as {
      display_phone_number?: string;
      verified_name?: string;
      error?: { message?: string };
    };
    if (!response.ok) throw new ApiError(502, result.error?.message ?? "A Meta recusou o teste da instância.");
    return Response.json({ connected: true, displayPhoneNumber: result.display_phone_number ?? "", verifiedName: result.verified_name ?? "" });
  } catch (error) {
    return jsonApiError(error);
  }
}
