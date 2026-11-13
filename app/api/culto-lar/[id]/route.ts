import {
  canEditOwnPost,
  isUuid,
  validarAutorizacaoImagem,
  validarCamposCultoLar,
} from "@/lib/culto-lar";
import {
  buscarCultoLarPost,
  caminhoFotoCultoLar,
  dtoCultoLar,
  editarCultoLarPost,
  enviarFotoCultoLar,
  erroCultoLar,
  exigirMembroAtivo,
  lerCamposForm,
  lerVersao,
  prepararFotoPrivada,
  removerFotoCultoLar,
  respostaErroCultoLar,
  resolverAcessoCultoLar,
  validarCamposSensíveis,
} from "@/lib/culto-lar-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

function headersPrivados(): HeadersInit {
  return { "Cache-Control": "private, no-store" };
}

export async function PATCH(request: Request, context: RouteContext) {
  let novoCaminho: string | null = null;
  let acesso: Awaited<ReturnType<typeof resolverAcessoCultoLar>> | null = null;
  try {
    const { id } = await context.params;
    if (!isUuid(id)) throw erroCultoLar(400, "Identificador de envio inválido.");
    acesso = await resolverAcessoCultoLar(request, true);
    const membro = exigirMembroAtivo(acesso.contexto);
    const atualResult = await buscarCultoLarPost(acesso.service, acesso.contexto.igrejaId, id);
    if (atualResult.error) throw erroCultoLar(503, "Não foi possível consultar o envio do Culto no Lar.");
    if (!atualResult.data || !canEditOwnPost(acesso.contexto, atualResult.data)) {
      throw erroCultoLar(404, "Envio do Culto no Lar não encontrado.");
    }
    const atual = atualResult.data;

    const form = await request.formData().catch(() => null);
    if (!form) throw erroCultoLar(400, "Formulário inválido.");
    validarCamposSensíveis(form, ["versao"]);
    const campos = validarCamposCultoLar(lerCamposForm(form));
    if (!campos.ok) throw erroCultoLar(400, campos.error);
    const autorizacao = validarAutorizacaoImagem(form.get("autorizacao_imagem"));
    if (!autorizacao.ok) throw erroCultoLar(400, autorizacao.error);
    const versao = lerVersao(form.get("versao"));

    let novaFoto: { caminho: string; mime: "image/jpeg" | "image/png" | "image/webp" } | undefined;
    if (form.has("foto")) {
      const fotoValue = form.get("foto");
      if (!(fotoValue instanceof File)) throw erroCultoLar(400, "A foto enviada é inválida.");
      const foto = await prepararFotoPrivada(Buffer.from(await fotoValue.arrayBuffer()), fotoValue.type);
      novoCaminho = caminhoFotoCultoLar(acesso.contexto.igrejaId, membro.id, id, foto.mime);
      await enviarFotoCultoLar(acesso.service, novoCaminho, foto.bytes, foto.mime);
      novaFoto = { caminho: novoCaminho, mime: foto.mime };
    }

    try {
      const atualizado = await editarCultoLarPost(
        acesso.service,
        atual,
        acesso.contexto,
        campos.value,
        versao,
        novaFoto,
      );
      if (novaFoto && atual.foto_path !== novaFoto.caminho) {
        await removerFotoCultoLar(acesso.service, atual.foto_path);
      }
      novoCaminho = null;
      return Response.json(
        { ok: true, status: atualizado.status, post: dtoCultoLar(atualizado, "meus") },
        { headers: headersPrivados() },
      );
    } catch (error) {
      if (novoCaminho) await removerFotoCultoLar(acesso.service, novoCaminho);
      novoCaminho = null;
      throw error;
    }
  } catch (error) {
    if (novoCaminho && acesso) await removerFotoCultoLar(acesso.service, novoCaminho);
    return respostaErroCultoLar(error);
  }
}
