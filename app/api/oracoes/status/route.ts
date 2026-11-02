import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const MODULOS_ORACAO = ["oracoes", "monitor-oracoes"];

function ehGrupoLideranca(nome: unknown) {
  return typeof nome === "string" && ["liderança", "lideranca"].includes(nome.trim().toLocaleLowerCase("pt-BR"));
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!url || !anonKey || !serviceKey) {
    return Response.json({ error: "Serviço de aprovação de orações não configurado." }, { status: 503 });
  }
  if (!token) {
    return Response.json({ error: "Sessão não encontrada." }, { status: 401 });
  }

  let body: { id?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corpo da solicitação inválido." }, { status: 400 });
  }

  const pedidoId = typeof body.id === "string" ? body.id : "";
  const status = body.status === "Aprovado" || body.status === "Rejeitado" ? body.status : "";
  if (!/^[0-9a-f-]{36}$/i.test(pedidoId) || !status) {
    return Response.json({ error: "Pedido ou status inválido." }, { status: 400 });
  }

  const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) {
    return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  }

  const serviceClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  // O cliente usado na mutação mantém o JWT do usuário. Isso garante que
  // auth.uid() esteja disponível em policies e triggers de histórico do culto.
  const authenticatedClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: perfil, error: perfilError } = await serviceClient
    .from("usuarios")
    .select("igreja_id, role, grupo_id")
    .eq("id", user.id)
    .maybeSingle();

  if (perfilError || !perfil?.igreja_id) {
    return Response.json({ error: "Perfil da igreja não encontrado." }, { status: 403 });
  }

  let nomeGrupo = "";
  if (perfil.grupo_id) {
    const { data: grupo } = await serviceClient
      .from("grupos")
      .select("nome")
      .eq("id", perfil.grupo_id)
      .eq("igreja_id", perfil.igreja_id)
      .maybeSingle();
    nomeGrupo = grupo?.nome || "";
  }

  // A regra de negócio da igreja é deliberadamente mais restritiva:
  // somente usuários do grupo padrão Liderança podem tomar a decisão.
  let autorizado = ehGrupoLideranca(nomeGrupo);
  if (autorizado && perfil.grupo_id) {
    const { data: permissoes } = await serviceClient
      .from("grupos_permissoes")
      .select("modulo, acao")
      .eq("grupo_id", perfil.grupo_id)
      .in("modulo", MODULOS_ORACAO)
      .in("acao", ["aprovar", "editar"]);
    autorizado = Boolean(permissoes?.length);
  }

  if (!autorizado) {
    return Response.json({ error: "A decisão deve ser feita por um usuário autenticado do grupo Liderança com permissão para aprovar orações." }, { status: 403 });
  }

  const { data: pedido, error: pedidoError } = await serviceClient
    .from("pedidos_oracao")
    .select("id, igreja_id, status")
    .eq("id", pedidoId)
    .eq("igreja_id", perfil.igreja_id)
    .maybeSingle();

  if (pedidoError || !pedido) {
    return Response.json({ error: "Pedido de oração não encontrado nesta igreja." }, { status: 404 });
  }
  if (pedido.status !== "Pendente") {
    return Response.json({ error: `Este pedido já está ${pedido.status.toLowerCase()}.` }, { status: 409 });
  }

  const { data: atualizado, error: updateError } = await authenticatedClient
    .from("pedidos_oracao")
    .update({ status })
    .eq("id", pedido.id)
    .eq("igreja_id", perfil.igreja_id)
    .select("id, status")
    .maybeSingle();

  if (updateError || !atualizado) {
    return Response.json({ error: updateError?.message || "Não foi possível atualizar o pedido." }, { status: 409 });
  }

  return Response.json({ ok: true, pedido: atualizado });
}
