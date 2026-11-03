import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function responseError(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }

async function authorize(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: responseError("Sessão não informada.", 401) };
  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return { error: responseError("Sessão inválida.", 401) };
  const { data: platformAdmin } = await admin.from("ipocloud_platform_admins").select("id").eq("auth_user_id", authData.user.id).eq("ativo", true).maybeSingle();
  if (!platformAdmin) return { error: responseError("Somente o Admin Geral pode convidar administradores de clientes.", 403) };
  return { admin, user: authData.user };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorized = await authorize(request);
  if ("error" in authorized) return authorized.error;
  const { id: clienteId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const nome = String(body.nome || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email) || nome.length < 2) return responseError("Informe nome e e-mail válidos.");

  const { data: cliente } = await authorized.admin.from("ipocloud_clientes").select("id, nome, status").eq("id", clienteId).maybeSingle();
  if (!cliente) return responseError("Cliente não encontrado.", 404);
  if (cliente.status !== "ativo") return responseError("Só é possível convidar administradores para clientes ativos.", 409);
  const { data: igreja } = await authorized.admin.from("igrejas").select("id, nome").eq("ipocloud_cliente_id", clienteId).limit(1).maybeSingle();
  if (!igreja) return responseError("Cadastre uma igreja para este cliente antes de enviar o convite.", 409);

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: convite, error: conviteError } = await authorized.admin.from("ipocloud_cliente_convites").insert({ cliente_id: clienteId, email, nome, token_hash: tokenHash, convidado_por: authorized.user.id, expires_at: expiresAt }).select("id, email, nome, expires_at").single();
  if (conviteError || !convite) return responseError(conviteError?.message || "Não foi possível criar o convite.", 500);

  const redirectTo = `${new URL(request.url).origin}/ipocloud/convites/aceitar?token=${encodeURIComponent(rawToken)}`;
  const { error: inviteError } = await authorized.admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { ipocloud_cliente_id: clienteId, ipocloud_invite_token: rawToken, nome } });
  if (inviteError) {
    await authorized.admin.from("ipocloud_cliente_convites").delete().eq("id", convite.id);
    return responseError(`Não foi possível enviar o convite: ${inviteError.message}`, 502);
  }
  return NextResponse.json({ convite, cliente: cliente.nome, igreja: igreja.nome }, { status: 201 });
}
