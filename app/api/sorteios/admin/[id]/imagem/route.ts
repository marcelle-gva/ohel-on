import { resolverAcesso, respostaErroAcesso } from "@/lib/access-server";
import { construirPromptPremio, IMAGE_GENERATION_COOLDOWN_MS, isUuid } from "@/lib/sorteios-admin";
import { buscarSorteioDaIgreja, chamarImageService, obterBytesDeImagemGerada, persistirFotoDoSorteio } from "@/lib/sorteios-admin-server";

export const runtime = "nodejs";
export const maxDuration = 90;

const ultimaGeracao = new Map<string, number>();
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return Response.json({ error: "Identificador de sorteio inválido." }, { status: 400 });

    const { contexto, service } = await resolverAcesso(request);
    if (contexto.role !== "admin") {
      return Response.json({ error: "Somente administradores podem gerar a foto do sorteio." }, { status: 403 });
    }

    const key = `${contexto.usuarioId}:${id}`;
    const agora = Date.now();
    const anterior = ultimaGeracao.get(key) || 0;
    if (agora - anterior < IMAGE_GENERATION_COOLDOWN_MS) {
      const retryAfter = Math.max(1, Math.ceil((IMAGE_GENERATION_COOLDOWN_MS - (agora - anterior)) / 1000));
      return Response.json(
        { error: "Aguarde um minuto antes de solicitar outra geração para este sorteio." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const sorteioResult = await buscarSorteioDaIgreja(service, contexto.igrejaId, id);
    if (sorteioResult.error) return Response.json({ error: "Não foi possível conferir o sorteio." }, { status: 503 });
    if (!sorteioResult.data) return Response.json({ error: "Sorteio não encontrado nesta igreja." }, { status: 404 });

    // Somente o clique explícito chega a este POST. O prompt usa prêmio/descrição,
    // nunca comprador, vendedor, telefone ou qualquer registro de participante.
    const prompt = construirPromptPremio(sorteioResult.data.nome, sorteioResult.data.descricao);
    ultimaGeracao.set(key, agora);

    const models = await chamarImageService("images.v1.ImageService/ListModels", {});
    const modelList = Array.isArray(models.models) ? models.models : [];
    const selected = modelList.find((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).model === "string") as Record<string, unknown> | undefined;
    if (!selected?.model) {
      ultimaGeracao.delete(key);
      return Response.json({ error: "O serviço de imagens não informou um modelo disponível." }, { status: 503 });
    }

    const generated = await chamarImageService("images.v1.ImageService/GenerateImage", {
      prompt,
      model: selected.model,
    });
    const image = await obterBytesDeImagemGerada(generated);
    const saved = await persistirFotoDoSorteio(service, sorteioResult.data, image.bytes, image.mime);

    return Response.json(
      { cartazUrl: saved.cartazUrl, status: "persistido" },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return error instanceof Error && "status" in error
      ? Response.json({ error: error.message }, { status: Number((error as { status?: number }).status) || 500 })
      : respostaErroAcesso(error);
  }
}
