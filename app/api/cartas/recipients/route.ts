import { ApiError, getApiContext, jsonApiError, requireModulePermission } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  try {
    const context = await getApiContext(request);
    await requireModulePermission(context, "comunicacoes", ["ler"]);
    const { data, error } = await context.admin
      .from("igrejas")
      .select("id, nome, email")
      .not("email", "is", null)
      .order("nome");
    if (error) throw new ApiError(500, "Não foi possível carregar as igrejas com e-mail cadastrado.");

    const churches = (data ?? [])
      .filter(church => typeof church.email === "string" && emailPattern.test(church.email.trim()))
      .map(church => ({ id: church.id, nome: church.nome, email: church.email.trim() }));
    return Response.json({ churches }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonApiError(error);
  }
}
