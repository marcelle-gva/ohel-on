import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const igrejaId = new URL(request.url).searchParams.get("igreja") || "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      igrejaId,
    )
  )
    return Response.json({ error: "Igreja inválida." }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    return Response.json(
      { error: "Formulário indisponível." },
      { status: 503 },
    );
  const service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: igreja } = await service
    .from("igrejas")
    .select("id")
    .eq("id", igrejaId)
    .maybeSingle();
  if (!igreja)
    return Response.json({ error: "Igreja não encontrada." }, { status: 404 });
  const [cargos, congregacoes] = await Promise.all([
    service
      .from("cargos")
      .select("id, nome")
      .eq("igreja_id", igrejaId)
      .order("nome")
      .limit(100),
    service
      .from("congregacoes")
      .select("id, nome")
      .eq("igreja_id", igrejaId)
      .order("nome")
      .limit(100),
  ]);
  if (cargos.error || congregacoes.error)
    return Response.json(
      { error: "Não foi possível consultar as opções da igreja." },
      { status: 503 },
    );
  return Response.json(
    { cargos: cargos.data || [], congregacoes: congregacoes.data || [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
