import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sessão não informada." }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const { data: platformAdmin } = await admin
    .from("ipocloud_platform_admins")
    .select("id")
    .eq("auth_user_id", authData.user.id)
    .eq("ativo", true)
    .maybeSingle();
  if (!platformAdmin) return NextResponse.json({ error: "Somente o Admin Geral pode alterar a logo IPO CLOUD." }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Envie um arquivo de imagem válido." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "A imagem deve ter no máximo 5 MB." }, { status: 400 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `ipocloud/logo-${Date.now()}.${extension}`;
  const { error: uploadError } = await admin.storage.from("logos").upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicUrl } = admin.storage.from("logos").getPublicUrl(path);
  const { error: updateError } = await admin
    .from("ipocloud_platform_admins")
    .update({ logo_url: publicUrl.publicUrl })
    .eq("ativo", true);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ logo_url: publicUrl.publicUrl });
}
