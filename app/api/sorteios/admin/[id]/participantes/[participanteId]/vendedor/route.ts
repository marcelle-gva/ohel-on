import { resolverAcesso, respostaErroAcesso } from "@/lib/access-server";
import { isUuid } from "@/lib/sorteios-admin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; participanteId: string }> };

type Body = { vendedorMembroId?: unknown };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id, participanteId } = await context.params;
    if (!isUuid(id) || !isUuid(participanteId)) {
      return Response.json({ error: "Identificador inválido." }, { status: 400 });
    }

    const { contexto, service } = await resolverAcesso(request);
    if (contexto.role !== "admin") {
      return Response.json({ error: "Somente administradores podem atribuir vendedores." }, { status: 403 });
    }

    const raffle = await service
      .from("sorteios")
      .select("id")
      .eq("id", id)
      .eq("igreja_id", contexto.igrejaId)
      .maybeSingle();
    if (raffle.error) return Response.json({ error: "Não foi possível conferir o sorteio." }, { status: 503 });
    if (!raffle.data) return Response.json({ error: "Sorteio não encontrado nesta igreja." }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as Body;
    const vendedorMembroId = body.vendedorMembroId === null || body.vendedorMembroId === ""
      ? null
      : body.vendedorMembroId;
    if (vendedorMembroId !== null && !isUuid(vendedorMembroId)) {
      return Response.json({ error: "Membro vendedor inválido." }, { status: 400 });
    }

    if (vendedorMembroId) {
      const membro = await service
        .from("membros")
        .select("id")
        .eq("id", vendedorMembroId)
        .eq("igreja_id", contexto.igrejaId)
        .eq("status", "Ativo")
        .maybeSingle();
      if (membro.error) return Response.json({ error: "Não foi possível conferir o membro vendedor." }, { status: 503 });
      if (!membro.data) return Response.json({ error: "Membro vendedor ativo não pertence a esta igreja." }, { status: 403 });
    }

    const updated = await service
      .from("sorteio_participantes")
      .update({ vendedor_membro_id: vendedorMembroId })
      .eq("id", participanteId)
      .eq("sorteio_id", id)
      .eq("igreja_id", contexto.igrejaId)
      .select("id, numero, origem, status, vendedor_membro_id")
      .maybeSingle();
    if (updated.error) return Response.json({ error: "Não foi possível salvar o vendedor do número." }, { status: 503 });
    if (!updated.data) return Response.json({ error: "Número não encontrado neste sorteio." }, { status: 404 });

    return Response.json({ participante: updated.data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return error instanceof Error && "status" in error
      ? Response.json({ error: error.message }, { status: Number((error as { status?: number }).status) || 500 })
      : respostaErroAcesso(error);
  }
}
