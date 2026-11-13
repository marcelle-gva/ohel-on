import { resolverAcesso, respostaErroAcesso } from "@/lib/access-server";
import { isUuid, validarImagemRecebida } from "@/lib/sorteios-admin";
import { buscarSorteioDaIgreja, persistirFotoDoSorteio } from "@/lib/sorteios-admin-server";

export const runtime = "nodejs";
export const maxDuration = 30;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return Response.json({ error: "Identificador de sorteio inválido." }, { status: 400 });

    const { contexto, service } = await resolverAcesso(request);
    if (contexto.role !== "admin") {
      return Response.json({ error: "Somente administradores podem enviar a foto do sorteio." }, { status: 403 });
    }
    const sorteioResult = await buscarSorteioDaIgreja(service, contexto.igrejaId, id);
    if (sorteioResult.error) return Response.json({ error: "Não foi possível conferir o sorteio." }, { status: 503 });
    if (!sorteioResult.data) return Response.json({ error: "Sorteio não encontrado nesta igreja." }, { status: 404 });

    const form = await request.formData();
    const value = form.get("foto");
    if (!(value instanceof File)) return Response.json({ error: "Selecione uma foto." }, { status: 400 });
    const bytes = Buffer.from(await value.arrayBuffer());
    const validation = validarImagemRecebida(bytes, value.type);
    if ("error" in validation) return Response.json({ error: validation.error }, { status: 400 });

    const saved = await persistirFotoDoSorteio(service, sorteioResult.data, bytes, validation.mime);
    return Response.json({ cartazUrl: saved.cartazUrl }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return error instanceof Error && "status" in error
      ? Response.json({ error: error.message }, { status: Number((error as { status?: number }).status) || 500 })
      : respostaErroAcesso(error);
  }
}
