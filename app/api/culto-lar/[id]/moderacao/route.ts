import { isUuid } from "@/lib/culto-lar";
import {
  moderarCultoLarPost,
  normalizarMotivo,
  exigirModeracao,
  lerVersao,
  dtoCultoLar,
  respostaErroCultoLar,
  resolverAcessoCultoLar,
} from "@/lib/culto-lar-server";
import { erroCultoLar } from "@/lib/culto-lar-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) throw erroCultoLar(400, "Identificador de envio inválido.");
    const acesso = await resolverAcessoCultoLar(request);
    exigirModeracao(acesso.contexto);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw erroCultoLar(400, "Decisão de moderação inválida.");
    }
    const keys = Object.keys(body as Record<string, unknown>);
    if (keys.some((key) => !["status", "versao", "motivo"].includes(key))) {
      throw erroCultoLar(400, "A decisão contém campos não permitidos.");
    }
    const input = body as { status?: unknown; versao?: unknown; motivo?: unknown };
    if (input.status !== "Aprovado" && input.status !== "Rejeitado") {
      throw erroCultoLar(400, "Escolha Aprovado ou Rejeitado.");
    }
    const versao = lerVersao(input.versao);
    const motivo = normalizarMotivo(input.motivo);
    if (motivo instanceof Error) throw motivo;
    if (input.status === "Aprovado" && motivo) {
      throw erroCultoLar(400, "A aprovação não aceita razão de rejeição.");
    }

    const post = await moderarCultoLarPost(
      acesso.service,
      id,
      acesso.contexto.igrejaId,
      acesso.contexto.usuarioId,
      input.status,
      input.status === "Rejeitado" ? motivo : null,
      versao,
    );
    return Response.json(
      { ok: true, status: post.status, post: dtoCultoLar(post, "moderacao") },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return respostaErroCultoLar(error);
  }
}
