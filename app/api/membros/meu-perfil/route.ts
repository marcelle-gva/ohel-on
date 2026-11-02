import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const CAMPOS_PERMITIDOS = [
  "nome",
  "data_nascimento",
  "sexo",
  "estado_civil",
  "telefone",
  "cep",
  "logradouro",
  "numero",
  "bairro",
  "cidade",
  "uf",
  "whatsapp_opt_in",
] as const;

type CampoPermitido = (typeof CAMPOS_PERMITIDOS)[number];

type MembroPerfil = Record<CampoPermitido, string | boolean | null> & {
  id: string;
  email: string | null;
  foto_url: string | null;
  status: string;
};

function getClients(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!url || !anonKey || !serviceKey || !token) return null;
  return {
    token,
    auth: createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } }),
    service: createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }),
  };
}

async function getMember(request: Request) {
  const clients = getClients(request);
  if (!clients) return { error: "Serviço de perfil não configurado.", status: 503 as const };
  const { data: authData, error: authError } = await clients.auth.auth.getUser(clients.token);
  const email = authData.user?.email?.trim().toLowerCase();
  if (authError || !email) return { error: "Sessão do membro inválida ou expirada.", status: 401 as const };

  const { data: membro, error } = await clients.service
    .from("membros")
    .select("id, nome, email, status, foto_url, data_nascimento, sexo, estado_civil, telefone, cep, logradouro, numero, bairro, cidade, uf, whatsapp_opt_in")
    .ilike("email", email)
    .eq("status", "Ativo")
    .maybeSingle();
  if (error || !membro) return { error: "Membro ativo não encontrado para esta sessão.", status: 403 as const };
  return { clients, membro: membro as MembroPerfil };
}

export async function GET(request: Request) {
  const result = await getMember(request);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ membro: result.membro });
}

export async function PATCH(request: Request) {
  const result = await getMember(request);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return Response.json({ error: "Dados inválidos." }, { status: 400 }); }

  const update: Partial<Record<CampoPermitido, string | boolean | null>> = {};
  for (const campo of CAMPOS_PERMITIDOS) {
    if (!(campo in body)) continue;
    const valor = body[campo];
    if (campo === "whatsapp_opt_in") {
      update[campo] = valor === true;
      continue;
    }
    update[campo] = typeof valor === "string" ? valor.trim() || null : null;
  }
  if (typeof update.nome !== "undefined" && !update.nome) return Response.json({ error: "Informe seu nome." }, { status: 400 });
  if (typeof update.whatsapp_opt_in !== "undefined") {
    (update as Record<string, string | boolean | null>).whatsapp_opt_in_at = update.whatsapp_opt_in ? new Date().toISOString() : null;
  }

  const { data: membro, error } = await result.clients.service
    .from("membros")
    .update(update)
    .eq("id", result.membro.id)
    .eq("status", "Ativo")
    .select("id, nome, email, status, foto_url, data_nascimento, sexo, estado_civil, telefone, cep, logradouro, numero, bairro, cidade, uf, whatsapp_opt_in")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 409 });
  return Response.json({ membro });
}

export async function POST(request: Request) {
  const result = await getMember(request);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });

  const form = await request.formData();
  const file = form.get("foto");
  if (!(file instanceof File)) return Response.json({ error: "Selecione uma imagem." }, { status: 400 });
  if (!file.type.startsWith("image/")) return Response.json({ error: "Envie uma imagem válida." }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return Response.json({ error: "A foto deve ter no máximo 5 MB." }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `membros/${result.membro.id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await result.clients.service.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return Response.json({ error: "Não foi possível enviar a foto." }, { status: 409 });
  const { data: publicUrl } = result.clients.service.storage.from("avatars").getPublicUrl(path);

  const { data: membro, error } = await result.clients.service.from("membros").update({ foto_url: publicUrl.publicUrl }).eq("id", result.membro.id).eq("status", "Ativo").select("id, nome, email, status, foto_url").single();
  if (error) return Response.json({ error: error.message }, { status: 409 });
  return Response.json({ membro });
}
