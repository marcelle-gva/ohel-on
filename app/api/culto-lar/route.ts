import {
  parseCultoLarPage,
  parseCultoLarPageSize,
  validarAutorizacaoImagem,
  validarCamposCultoLar,
  type CultoLarStatus,
} from "@/lib/culto-lar";
import {
  caminhoFotoCultoLar,
  dtoCultoLar,
  enviarFotoCultoLar,
  exigirMembroAtivo,
  exigirModeracao,
  inserirCultoLarPost,
  lerCamposForm,
  listarCultoLar,
  prepararFotoPrivada,
  removerFotoCultoLar,
  erroCultoLar,
  respostaErroCultoLar,
  resolverAcessoCultoLar,
  validarCamposSensíveis,
  validarStatusFiltro,
  validarVisao,
} from "@/lib/culto-lar-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function headersPrivados(): HeadersInit {
  return { "Cache-Control": "private, no-store" };
}

export async function GET(request: Request) {
  try {
    const acesso = await resolverAcessoCultoLar(request);
    const url = new URL(request.url);
    const visao = validarVisao(url.searchParams.get("visao") || "mural");
    const page = parseCultoLarPage(url.searchParams.get("page"));
    if (!page.ok) throw erroCultoLar(400, page.error);
    const pageSize = parseCultoLarPageSize(url.searchParams.get("pageSize"));
    if (!pageSize.ok) throw erroCultoLar(400, pageSize.error);
    const status = validarStatusFiltro(url.searchParams.get("status"));

    if (visao === "moderacao") exigirModeracao(acesso.contexto);
    else exigirMembroAtivo(acesso.contexto);

    const resultado = await listarCultoLar(
      acesso.service,
      acesso.contexto.igrejaId,
      visao,
      page.value,
      pageSize.value,
      acesso.contexto.membro?.id,
      visao === "moderacao" ? status : undefined,
      acesso.contexto.usuarioId,
    );
    return Response.json(
      {
        visao,
        posts: resultado.rows.map((row) => dtoCultoLar(row, visao)),
        pagination: {
          page: page.value,
          page_size: pageSize.value,
          has_more: resultado.hasMore,
          next_page: resultado.hasMore ? page.value + 1 : null,
          total: resultado.total,
        },
      },
      { headers: headersPrivados() },
    );
  } catch (error) {
    return respostaErroCultoLar(error);
  }
}

export async function POST(request: Request) {
  let caminho: string | null = null;
  try {
    const acesso = await resolverAcessoCultoLar(request, true);
    const membro = exigirMembroAtivo(acesso.contexto);
    const form = await request.formData().catch(() => null);
    if (!form) throw erroCultoLar(400, "Formulário inválido.");
    validarCamposSensíveis(form, []);
    const campos = validarCamposCultoLar(lerCamposForm(form));
    if (!campos.ok) throw erroCultoLar(400, campos.error);
    const autorizacao = validarAutorizacaoImagem(form.get("autorizacao_imagem"));
    if (!autorizacao.ok) throw erroCultoLar(400, autorizacao.error);

    const fotoValue = form.get("foto");
    if (!(fotoValue instanceof File)) {
      throw erroCultoLar(400, "A foto é obrigatória no novo envio.");
    }
    const bytes = Buffer.from(await fotoValue.arrayBuffer());
    const foto = await prepararFotoPrivada(bytes, fotoValue.type);
    const postId = crypto.randomUUID();
    caminho = caminhoFotoCultoLar(acesso.contexto.igrejaId, membro.id, postId, foto.mime);
    await enviarFotoCultoLar(acesso.service, caminho, foto.bytes, foto.mime);

    try {
      const post = await inserirCultoLarPost(acesso.service, {
        id: postId,
        igreja_id: acesso.contexto.igrejaId,
        membro_id: membro.id,
        autor_usuario_id: acesso.contexto.usuarioId,
        casa_nome: campos.value.casa_nome,
        data_culto: campos.value.data_culto,
        titulo: campos.value.titulo,
        referencia: campos.value.referencia,
        palavra: campos.value.palavra,
        foto_path: caminho,
        foto_mime: foto.mime,
        status: "Pendente" satisfies CultoLarStatus,
        motivo_rejeicao: null,
        versao: 1,
        decidido_por: null,
        decidido_em: null,
      });
      caminho = null;
      return Response.json(
        { ok: true, status: post.status, post: dtoCultoLar(post, "meus") },
        { status: 201, headers: headersPrivados() },
      );
    } catch (error) {
      if (caminho) await removerFotoCultoLar(acesso.service, caminho);
      caminho = null;
      throw error;
    }
  } catch (error) {
    if (caminho) {
      // Erros antes do insert também não deixam um objeto privado órfão.
      try {
        const acesso = await resolverAcessoCultoLar(request, true);
        await removerFotoCultoLar(acesso.service, caminho);
      } catch {
        // A resposta continua segura; eventual limpeza pode ser feita pelo Storage.
      }
    }
    return respostaErroCultoLar(error);
  }
}
