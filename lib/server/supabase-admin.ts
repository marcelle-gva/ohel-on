import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type ApiContext = {
  admin: SupabaseClient;
  user: User;
  churchId: string;
  role: string;
  groupId: string | null;
};

export function createServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new ApiError(503, "A integração com o Supabase não está configurada no servidor.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function getApiContext(request: Request): Promise<ApiContext> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new ApiError(401, "Autenticação obrigatória.");
  const admin = createServiceClient();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) throw new ApiError(401, "Sessão inválida ou expirada.");
  const { data: profile, error: profileError } = await admin
    .from("usuarios")
    .select("igreja_id, role, grupo_id")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) throw new ApiError(500, "Não foi possível validar o perfil do usuário.");
  if (!profile?.igreja_id) throw new ApiError(403, "O usuário não está associado a uma igreja.");
  return {
    admin,
    user: authData.user,
    churchId: profile.igreja_id,
    role: profile.role ?? "",
    groupId: profile.grupo_id,
  };
}

export async function requireModulePermission(
  context: ApiContext,
  module: string,
  actions: string[],
) {
  if (context.role === "admin") return;
  if (!context.groupId) throw new ApiError(403, "Você não tem permissão para esta operação.");
  const { data: group, error: groupError } = await context.admin
    .from("grupos")
    .select("id")
    .eq("id", context.groupId)
    .eq("igreja_id", context.churchId)
    .maybeSingle();
  if (groupError) throw new ApiError(500, "Não foi possível validar o grupo do usuário.");
  if (!group) throw new ApiError(403, "O grupo do usuário não pertence a esta igreja.");
  const { data, error } = await context.admin
    .from("grupos_permissoes")
    .select("acao")
    .eq("grupo_id", context.groupId)
    .eq("modulo", module)
    .in("acao", actions);
  if (error) throw new ApiError(500, "Não foi possível verificar as permissões do usuário.");
  if (!data?.length) throw new ApiError(403, "Você não tem permissão para esta operação.");
}

export function jsonApiError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("Erro em API do servidor:", error);
  return Response.json({ error: "Não foi possível concluir a solicitação." }, { status: 500 });
}
