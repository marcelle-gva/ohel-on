import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!url || !anonKey || !serviceKey) return Response.json({ error: "Serviço de acesso não configurado." }, { status: 503 });
  if (!token) return Response.json({ error: "Sessão não encontrada." }, { status: 401 });

  const auth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user?.email) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: byAuth } = await service.from("membros").select("id, nome, status").eq("auth_user_id", user.id).maybeSingle();
  const { data: membro } = byAuth ? { data: byAuth } : await service.from("membros").select("id, nome, status").ilike("email", user.email).maybeSingle();
  if (!membro) return Response.json({ error: "Seu usuário ainda não está vinculado a um cadastro de membro." }, { status: 403 });

  return Response.json({ id: membro.id, nome: membro.nome, status: membro.status, aprovado: membro.status === "Ativo" });
}
