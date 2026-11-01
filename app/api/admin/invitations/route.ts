import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const OWNER_EMAIL = (
  process.env.ADMIN_INVITE_OWNER_EMAIL ||
  process.env.ADMIN_INVITE_SENDER_EMAIL ||
  "marcelle.gva@gmail.com"
).trim().toLowerCase();

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getAuthorizedOwner(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return { error: jsonError("Sessão não informada.", 401) };

  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return { error: jsonError("Sessão inválida.", 401) };

  const { data: profile, error: profileError } = await admin
    .from("usuarios")
    .select("id, email, nome, role, igreja_id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin") {
    return { error: jsonError("Somente um administrador pode gerenciar convites.", 403) };
  }

  if ((profile.email || authData.user.email || "").trim().toLowerCase() !== OWNER_EMAIL) {
    return { error: jsonError("Somente o administrador proprietário autorizado pode convidar novos administradores.", 403) };
  }

  return { admin, authUser: authData.user, profile };
}

export async function GET(request: Request) {
  try {
    const authorized = await getAuthorizedOwner(request);
    if ("error" in authorized) return authorized.error;

    const { data, error } = await authorized.admin
      .from("admin_convites")
      .select("id, email, nome, expires_at, accepted_at, created_at, igrejas(nome)")
      .order("created_at", { ascending: false });

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ invitations: data || [] });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erro ao listar convites.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const authorized = await getAuthorizedOwner(request);
    if ("error" in authorized) return authorized.error;

    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const nome = String(body.nome || "").trim();
    const igrejaNome = String(body.igrejaNome || "").trim();

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return jsonError("Informe um e-mail válido.");
    if (!nome || nome.length < 2) return jsonError("Informe o nome do novo administrador.");
    if (!igrejaNome || igrejaNome.length < 2) return jsonError("Informe o nome da nova igreja.");
    if (email === OWNER_EMAIL) return jsonError("Esse e-mail já é o administrador proprietário.");

    const { data: church, error: churchError } = await authorized.admin
      .from("igrejas")
      .insert({ nome: igrejaNome })
      .select("id")
      .single();
    if (churchError || !church) return jsonError(churchError?.message || "Não foi possível criar a nova igreja.", 500);

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invitation, error: insertError } = await authorized.admin
      .from("admin_convites")
      .insert({
        igreja_id: church.id,
        email,
        nome,
        token_hash: tokenHash,
        convidado_por: authorized.authUser.id,
        expires_at: expiresAt,
      })
      .select("id, email, nome, expires_at")
      .single();

    if (insertError) {
      await authorized.admin.from("igrejas").delete().eq("id", church.id);
      return jsonError(insertError.message, 500);
    }

    const origin = new URL(request.url).origin;
    const redirectTo = `${origin}/configuracoes/administradores/aceitar?token=${encodeURIComponent(rawToken)}`;
    const { error: inviteError } = await authorized.admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { admin_invite_token: rawToken, nome },
    });

    if (inviteError) {
      await authorized.admin.from("admin_convites").delete().eq("id", invitation.id);
      await authorized.admin.from("igrejas").delete().eq("id", church.id);
      return jsonError(`Não foi possível enviar o convite: ${inviteError.message}`, 502);
    }

    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erro ao criar convite.", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const authorized = await getAuthorizedOwner(request);
    if ("error" in authorized) return authorized.error;

    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    if (!id) return jsonError("Convite não informado.");

    const { error } = await authorized.admin
      .from("admin_convites")
      .delete()
      .eq("id", id)
      .is("accepted_at", null);

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erro ao revogar convite.", 500);
  }
}
