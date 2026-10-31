import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type AdminContext = {
  supabase: SupabaseClient;
  igrejaId: string;
  userId: string;
};

type AuthorizationResult =
  | { context: AdminContext; response?: never }
  | { context?: never; response: Response };

export function createWhatsappServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server credentials are not configured.");

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function authorizeWhatsappAdmin(request: Request): Promise<AuthorizationResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!url || !anonKey) {
    return { response: new Response("Supabase authentication is not configured.", { status: 503 }) };
  }
  if (!accessToken) {
    return { response: new Response("Authentication required.", { status: 401 }) };
  }

  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !user) {
    return { response: new Response("Invalid or expired session.", { status: 401 }) };
  }

  let serviceClient: SupabaseClient;
  try {
    serviceClient = createWhatsappServiceClient();
  } catch {
    return { response: new Response("Supabase server credentials are not configured.", { status: 503 }) };
  }
  const { data: profile, error: profileError } = await serviceClient
    .from("usuarios")
    .select("igreja_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { response: new Response("Unable to verify user permissions.", { status: 503 }) };
  }
  if (!profile?.igreja_id || profile.role !== "admin") {
    return { response: new Response("Only a church administrator can manage WhatsApp broadcasts.", { status: 403 }) };
  }

  return {
    context: {
      supabase: serviceClient,
      igrejaId: profile.igreja_id,
      userId: user.id,
    },
  };
}

export function normalizeBrazilianPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withCountryCode = digits.startsWith("55") ? digits : `55${digits}`;
  if (!/^55\d{10,11}$/.test(withCountryCode)) return null;
  return withCountryCode;
}
