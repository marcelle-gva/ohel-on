import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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
  const status = body.status === "Em Oração" || body.status === "Rejeitado" ? body.status : "";
  if (!/^[0-9a-f-]{36}$/i.test(pedidoId) || !status) {
    return Response.json({ error: "Pedido ou decisão inválida." }, { status: 400 });
  }

  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) {
    return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  }

  const serviceClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await serviceClient.rpc("approve_prayer_request", {
    p_pedido_id: pedidoId,
    p_ator_id: user.id,
    p_status: status,
  });

  if (error) {
    const statusCode = error.code === "42501" ? 403 : error.code === "P0002" ? 409 : 400;
    return Response.json({ error: error.message || "Não foi possível atualizar o pedido." }, { status: statusCode });
  }

  const pedido = Array.isArray(data) ? data[0] : data;
  if (!pedido) {
    return Response.json({ error: "Pedido não encontrado ou já processado." }, { status: 409 });
  }

  return Response.json({ ok: true, pedido });
}
