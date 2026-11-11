import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function texto(value: unknown, limite: number) {
  return typeof value === "string" ? value.trim().slice(0, limite) : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const igrejaId = texto(body.igrejaId, 80);
    const nome = texto(body.nome, 120);
    const telefone = texto(body.telefone, 40);
    const observacao = texto(body.observacao, 1000);
    if (!igrejaId || nome.length < 2) return Response.json({ error: "Informe seu nome completo." }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) return Response.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });
    const service = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: igreja, error: igrejaError } = await service.from("igrejas").select("id").eq("id", igrejaId).maybeSingle();
    if (igrejaError || !igreja) return Response.json({ error: "Igreja não encontrada." }, { status: 404 });

    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const { error } = await service.from("visitantes").insert({ igreja_id: igreja.id, nome, telefone: telefone || null, data_visita: hoje, observacao: observacao || null });
    if (error) return Response.json({ error: "Não foi possível registrar sua visita." }, { status: 503 });
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: "Não foi possível registrar sua visita." }, { status: 400 });
  }
}
