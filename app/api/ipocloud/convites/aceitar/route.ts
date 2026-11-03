import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const tokenAuth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!tokenAuth) return NextResponse.json({ error: "Sessão não informada." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || "").trim();
  if (!token) return NextResponse.json({ error: "Token não informado." }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.getUser(tokenAuth);
  if (authError || !authData.user?.email) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: convite } = await admin.from("ipocloud_cliente_convites").select("id, cliente_id, email, nome, expires_at, accepted_at").eq("token_hash", tokenHash).is("accepted_at", null).maybeSingle();
  if (!convite) return NextResponse.json({ error: "Convite inválido, usado ou revogado." }, { status: 400 });
  if (new Date(convite.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "Este convite expirou." }, { status: 410 });
  if (authData.user.email.trim().toLowerCase() !== convite.email.trim().toLowerCase()) return NextResponse.json({ error: "Use o mesmo e-mail que recebeu o convite." }, { status: 403 });
  const { data: igreja } = await admin.from("igrejas").select("id").eq("ipocloud_cliente_id", convite.cliente_id).limit(1).maybeSingle();
  if (!igreja) return NextResponse.json({ error: "O cliente ainda não possui uma igreja vinculada." }, { status: 409 });

  const { error: profileError } = await admin.from("usuarios").upsert({ id: authData.user.id, email: convite.email, nome: convite.nome, igreja_id: igreja.id, role: "admin" }, { onConflict: "id" });
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  const { error: memberError } = await admin.from("ipocloud_cliente_usuarios").upsert({ cliente_id: convite.cliente_id, auth_user_id: authData.user.id, papel: "administrador_organizacao", ativo: true }, { onConflict: "cliente_id,auth_user_id" });
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });
  const { error: acceptedError } = await admin.from("ipocloud_cliente_convites").update({ accepted_at: new Date().toISOString() }).eq("id", convite.id).is("accepted_at", null);
  if (acceptedError) return NextResponse.json({ error: acceptedError.message }, { status: 500 });
  return NextResponse.json({ ok: true, cliente_id: convite.cliente_id, igreja_id: igreja.id });
}
