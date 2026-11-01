import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!accessToken) return NextResponse.json({ error: "Sessão não informada." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    if (!token) return NextResponse.json({ error: "Token do convite não informado." }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !authData.user?.email) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { data: invitation, error: invitationError } = await admin
      .from("admin_convites")
      .select("id, igreja_id, email, nome, expires_at, accepted_at")
      .eq("token_hash", tokenHash)
      .is("accepted_at", null)
      .maybeSingle();

    if (invitationError || !invitation) return NextResponse.json({ error: "Convite inválido, já usado ou revogado." }, { status: 400 });
    if (new Date(invitation.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "Este convite expirou." }, { status: 410 });
    if (authData.user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) {
      return NextResponse.json({ error: "Entre com o mesmo e-mail que recebeu o convite." }, { status: 403 });
    }

    const { error: profileError } = await admin.from("usuarios").upsert({
      id: authData.user.id,
      email: invitation.email,
      nome: invitation.nome,
      igreja_id: invitation.igreja_id,
      role: "admin",
    }, { onConflict: "id" });

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

    const { error: acceptedError } = await admin
      .from("admin_convites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id)
      .is("accepted_at", null);

    if (acceptedError) return NextResponse.json({ error: acceptedError.message }, { status: 500 });
    return NextResponse.json({ ok: true, igreja_id: invitation.igreja_id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao aceitar convite." }, { status: 500 });
  }
}
