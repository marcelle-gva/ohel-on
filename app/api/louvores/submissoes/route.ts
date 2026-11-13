import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  AcessoError,
  resolverAcesso,
  respostaErroAcesso,
} from "@/lib/access-server";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function texto(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const result = value.trim().slice(0, maxLength);
  return result || null;
}

async function garantirResponsavel(contexto: Awaited<ReturnType<typeof resolverAcesso>>["contexto"], service: Awaited<ReturnType<typeof resolverAcesso>>["service"]) {
  if (contexto.role === "admin") return;

  const { data, error } = await service
    .from("departamentos")
    .select("id")
    .eq("igreja_id", contexto.igrejaId)
    .eq("responsavel_usuario_id", contexto.usuarioId)
    .eq("ativo", true)
    .ilike("nome", "%louvor%")
    .limit(1)
    .maybeSingle();

  if (error) throw new AcessoError("Não foi possível conferir a responsabilidade pelo departamento de Louvor.", 503);
  if (!data) throw new AcessoError("Somente o responsável do departamento de Louvor pode revisar estas músicas.", 403);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Dados inválidos." }, { status: 400, headers: NO_STORE });
    }

    const igrejaId = texto((body as Record<string, unknown>).igreja_id, 64);
    const titulo = texto((body as Record<string, unknown>).titulo, 180);
    const tom = texto((body as Record<string, unknown>).tom, 24);
    if (!igrejaId || !UUID_PATTERN.test(igrejaId) || !titulo || !tom) {
      return Response.json({ error: "Informe a igreja, o nome da música e o tom." }, { status: 400, headers: NO_STORE });
    }

    const service = getSupabaseAdmin();
    const { data: igreja, error: churchError } = await service
      .from("igrejas")
      .select("id")
      .eq("id", igrejaId)
      .maybeSingle();
    if (churchError || !igreja) {
      return Response.json({ error: "Igreja não encontrada para este link." }, { status: 404, headers: NO_STORE });
    }

    const { error } = await service.from("louvor_submissoes").insert({
      igreja_id: igrejaId,
      titulo,
      tom,
      ministro: texto((body as Record<string, unknown>).ministro, 120),
      link_cifra: texto((body as Record<string, unknown>).link_cifra, 20000),
      link_video: texto((body as Record<string, unknown>).link_video, 2048),
      palavra_vinculada: texto((body as Record<string, unknown>).palavra_vinculada, 5000),
      status: "Pendente",
    });

    if (error) {
      console.error("Falha ao receber submissão de louvor.", error.message);
      return Response.json({ error: "Não foi possível enviar a música para avaliação." }, { status: 500, headers: NO_STORE });
    }

    return Response.json(
      { ok: true, message: "Música enviada para avaliação do responsável de Louvor." },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return Response.json({ error: "Serviço de envio indisponível no momento." }, { status: 503, headers: NO_STORE });
    }
    console.error("Erro no recebimento de submissão de louvor.", error);
    return Response.json({ error: "Não foi possível receber a música." }, { status: 500, headers: NO_STORE });
  }
}

export async function GET(request: Request) {
  try {
    const { contexto, service } = await resolverAcesso(request);
    await garantirResponsavel(contexto, service);

    const parsedOffset = Number(new URL(request.url).searchParams.get("offset") || "0");
    const offset = Number.isSafeInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
    const limit = 50;

    const { data, error } = await service
      .from("louvor_submissoes")
      .select("id, titulo, tom, ministro, link_cifra, link_video, palavra_vinculada, created_at")
      .eq("igreja_id", contexto.igrejaId)
      .eq("status", "Pendente")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new AcessoError("Não foi possível carregar as músicas aguardando revisão.", 503);
    const submissoes = data || [];
    return Response.json({
      submissoes,
      hasMore: submissoes.length === limit,
      nextOffset: offset + submissoes.length,
    }, { headers: NO_STORE });
  } catch (error) {
    return respostaErroAcesso(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { contexto, service } = await resolverAcesso(request);
    await garantirResponsavel(contexto, service);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Dados inválidos." }, { status: 400, headers: NO_STORE });
    }
    const values = body as Record<string, unknown>;
    const id = texto(values.id, 64);
    const decisao = values.decisao;
    if (!id || !UUID_PATTERN.test(id) || (decisao !== "Aprovado" && decisao !== "Rejeitado")) {
      return Response.json({ error: "Informe uma submissão e uma decisão válidas." }, { status: 400, headers: NO_STORE });
    }

    const { data, error } = await service.rpc("decidir_louvor_submissao", {
      p_submission_id: id,
      p_igreja_id: contexto.igrejaId,
      p_usuario_id: contexto.usuarioId,
      p_decisao: decisao,
    });

    if (error) {
      console.error("Falha ao decidir submissão de louvor.", error.message);
      return Response.json({ error: "A submissão não está pendente ou não foi possível registrar a decisão." }, { status: 409, headers: NO_STORE });
    }

    return Response.json({ ok: true, decisao, resultado: data }, { headers: NO_STORE });
  } catch (error) {
    return respostaErroAcesso(error);
  }
}
