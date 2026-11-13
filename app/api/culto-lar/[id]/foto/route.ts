import { isUuid } from "@/lib/culto-lar";
import {
  buscarCultoLarPost,
  podeVerFotoCultoLar,
  respostaErroCultoLar,
  resolverAcessoCultoLar,
  erroCultoLar,
} from "@/lib/culto-lar-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function extensao(mime: string): string {
  return mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) throw erroCultoLar(404, "Foto não encontrada.");
    const acesso = await resolverAcessoCultoLar(request);
    const result = await buscarCultoLarPost(acesso.service, acesso.contexto.igrejaId, id);
    if (result.error) throw erroCultoLar(503, "Não foi possível consultar a foto do Culto no Lar.");
    if (!result.data || !podeVerFotoCultoLar(acesso.contexto, result.data)) {
      throw erroCultoLar(404, "Foto não encontrada.");
    }

    const download = await acesso.service.storage
      .from("culto-lar-fotos")
      .download(result.data.foto_path);
    if (download.error || !download.data) {
      console.error("Foto do Culto no Lar indisponível", { code: download.error?.message });
      throw erroCultoLar(404, "Foto não encontrada.");
    }
    return new Response(download.data, {
      status: 200,
      headers: {
        "Content-Type": result.data.foto_mime,
        "Content-Length": String(download.data.size),
        "Content-Disposition": `inline; filename="culto-no-lar-${result.data.id}.${extensao(result.data.foto_mime)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return respostaErroCultoLar(error);
  }
}
