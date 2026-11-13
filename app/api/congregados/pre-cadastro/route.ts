import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function texto(valor: unknown, limite: number) {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

function dataValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function resposta(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const recebido = await request.json();
    if (!recebido || typeof recebido !== "object" || Array.isArray(recebido)) return resposta("Dados inválidos.", 400);
    body = recebido as Record<string, unknown>;
  } catch {
    return resposta("Dados inválidos.", 400);
  }

  const igrejaId = texto(body.igrejaId, 80);
  const nome = texto(body.nome, 120);
  const dataNascimento = texto(body.dataNascimento, 10);
  const telefone = texto(body.telefone, 40);
  const congregacaoId = texto(body.congregacaoId, 80);
  const conjugeNome = texto(body.conjugeNome, 120);
  const consentimento = body.consentimento === true;

  if (!UUID_RE.test(igrejaId)) return resposta("Igreja não identificada.", 400);
  if (nome.length < 3) return resposta("Informe seu nome completo.", 400);
  if (dataNascimento && !dataValida(dataNascimento)) return resposta("Informe uma data de nascimento válida.", 400);
  if (congregacaoId && !UUID_RE.test(congregacaoId)) return resposta("Congregação inválida.", 400);
  if (!consentimento) return resposta("Confirme a autorização para enviar os dados.", 400);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return resposta("Serviço temporariamente indisponível.", 503);

  const service = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: igreja, error: igrejaError } = await service
    .from("igrejas")
    .select("id")
    .eq("id", igrejaId)
    .maybeSingle();
  if (igrejaError || !igreja) return resposta("Igreja não encontrada.", 404);

  if (congregacaoId) {
    const { data: congregacao, error: congregacaoError } = await service
      .from("congregacoes")
      .select("id")
      .eq("id", congregacaoId)
      .eq("igreja_id", igrejaId)
      .maybeSingle();
    if (congregacaoError || !congregacao) return resposta("Congregação inválida para esta igreja.", 400);
  }

  const { error } = await service.from("congregados").insert({
    igreja_id: igreja.id,
    nome,
    data_nascimento: dataNascimento || null,
    telefone: telefone || null,
    congregacao_id: congregacaoId || null,
    conjuge_nome: conjugeNome || null,
    status: "Pré-Cadastro",
  });
  if (error) return resposta("Não foi possível enviar o pré-cadastro. Procure a secretaria se o problema continuar.", 503);

  return Response.json(
    { ok: true },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
