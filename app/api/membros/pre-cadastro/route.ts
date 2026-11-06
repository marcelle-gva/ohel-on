import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 20;

const CAMPOS_TEXTO = [
  "nome", "data_nascimento", "sexo", "estado_civil", "cpf", "email", "telefone",
  "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf",
  "congregacao_id", "nome_pai", "nome_mae", "cargo",
] as const;
const CAMPOS_PERMISSAO_NAO_ACEITOS = ["role", "group", "tipo"] as const;
const LIMITE_CARGO = 80;

function texto(form: FormData, campo: string) {
  const valor = form.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !anonKey || !serviceKey) {
    return Response.json({ error: "Serviço de pré-cadastro não configurado." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Dados do pré-cadastro inválidos." }, { status: 400 });
  }

  if (CAMPOS_PERMISSAO_NAO_ACEITOS.some((campo) => form.has(campo))) {
    return Response.json({ error: "Campos de permissão não são aceitos no pré-cadastro." }, { status: 400 });
  }

  const igrejaId = texto(form, "igreja_id");
  const nome = texto(form, "nome");
  const email = texto(form, "email").toLowerCase();
  const senha = texto(form, "senha");
  const confirmarSenha = texto(form, "confirmar_senha");
  const telefone = texto(form, "telefone");
  const consentAccepted = texto(form, "consent_accepted") === "true";
  const whatsappOptIn = texto(form, "whatsapp_opt_in") === "true";
  const foto = form.get("foto");
  const cargoInformado = form.get("cargo");
  if (cargoInformado !== null && typeof cargoInformado !== "string") {
    return Response.json({ error: "Cargo eclesiástico inválido." }, { status: 400 });
  }
  const cargo = (typeof cargoInformado === "string" ? cargoInformado.trim() : "") || "Membro";
  if (cargo.length > LIMITE_CARGO) {
    return Response.json({ error: "O cargo eclesiástico deve ter no máximo 80 caracteres." }, { status: 400 });
  }

  if (!/^[0-9a-f-]{36}$/i.test(igrejaId)) return Response.json({ error: "Igreja não identificada." }, { status: 400 });
  if (nome.length < 3 || !email || !telefone) return Response.json({ error: "Preencha nome, e-mail e telefone." }, { status: 400 });
  if (!consentAccepted) return Response.json({ error: "Aceite o termo de consentimento para continuar." }, { status: 400 });
  if (senha.length < 8) return Response.json({ error: "A senha deve ter pelo menos 8 caracteres." }, { status: 400 });
  if (senha !== confirmarSenha) return Response.json({ error: "As senhas não conferem." }, { status: 400 });
  if (foto instanceof File && foto.size > 5 * 1024 * 1024) return Response.json({ error: "A foto deve ter no máximo 5 MB." }, { status: 400 });
  if (foto instanceof File && !foto.type.startsWith("image/")) return Response.json({ error: "Envie uma foto em formato de imagem." }, { status: 400 });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: igreja, error: igrejaError } = await admin.from("igrejas").select("id").eq("id", igrejaId).maybeSingle();
  if (igrejaError || !igreja) return Response.json({ error: "Igreja não encontrada." }, { status: 404 });

  const { data: existente } = await admin.from("membros").select("id, status").eq("igreja_id", igrejaId).ilike("email", email).maybeSingle();
  if (existente) return Response.json({ error: existente.status === "Pré-Cadastro" ? "Já existe um pré-cadastro aguardando aprovação para este e-mail." : "Este e-mail já está cadastrado nesta igreja." }, { status: 409 });

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { tipo: "membro", nome },
  });
  if (authError || !authData.user) return Response.json({ error: authError?.message || "Não foi possível criar o acesso." }, { status: 409 });

  let fotoUrl: string | null = null;
  try {
    if (foto instanceof File && foto.size > 0) {
      const ext = foto.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `membros/${authData.user.id}/perfil-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await admin.storage.from("avatars").upload(path, foto, { contentType: foto.type, upsert: false });
      if (uploadError) throw uploadError;
      fotoUrl = admin.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }

    const registro: Record<string, string | null | boolean> = {
      igreja_id: igrejaId,
      auth_user_id: authData.user.id,
      status: "Pré-Cadastro",
      foto_url: fotoUrl,
      whatsapp_opt_in: whatsappOptIn,
      whatsapp_opt_in_at: whatsappOptIn ? new Date().toISOString() : null,
    };
    for (const campo of CAMPOS_TEXTO) registro[campo] = campo === "email" ? email : campo === "cargo" ? cargo : (texto(form, campo) || null);
    const { error: membroError } = await admin.from("membros").insert(registro);
    if (membroError) throw membroError;
  } catch (error) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível concluir o pré-cadastro." }, { status: 409 });
  }

  return Response.json({ ok: true, status: "Pré-Cadastro", message: "Cadastro recebido. Aguarde a aprovação da igreja para acessar a Área do Membro." });
}
