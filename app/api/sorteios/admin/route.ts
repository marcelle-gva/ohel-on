import { resolverAcesso, respostaErroAcesso } from "@/lib/access-server";

export const runtime = "nodejs";

const LIST_FIELDS = "id, nome, descricao, status, valor_bilhete, total_numeros, numero_inicial, numero_final, data_sorteio, cartaz_url, created_at, updated_at";

function respostaInterna(error: unknown) {
  return Response.json(
    { error: error instanceof Error ? error.message : "Não foi possível carregar os sorteios." },
    { status: 503, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET(request: Request) {
  try {
    const { contexto, service } = await resolverAcesso(request);
    if (contexto.role !== "admin") {
      return Response.json({ error: "Somente administradores podem gerenciar sorteios." }, { status: 403 });
    }

    const { data, error } = await service
      .from("sorteios")
      .select(LIST_FIELDS)
      .eq("igreja_id", contexto.igrejaId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return respostaInterna(error);

    return Response.json(
      { sorteios: data || [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return error instanceof Error && "status" in error
      ? Response.json({ error: error.message }, { status: Number((error as { status?: number }).status) || 500 })
      : respostaErroAcesso(error);
  }
}
