import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AcessoError,
  resolverAcesso,
} from "@/lib/access-server";
import {
  CULTO_LAR_STORAGE_BUCKET,
  type CultoLarCampos,
  type CultoLarImagemMime,
  type CultoLarPostDTO,
  type CultoLarPostRow,
  type CultoLarStatus,
  type CultoLarVisao,
  canEditOwnPost,
  canModerate,
  canViewPost,
  toCultoLarPostDTO,
  validarFotoCultoLar,
} from "@/lib/culto-lar";

export const CULTO_LAR_SELECT =
  "id, igreja_id, membro_id, autor_usuario_id, casa_nome, data_culto, titulo, referencia, palavra, foto_path, foto_mime, status, motivo_rejeicao, versao, decidido_por, decidido_em, created_at, updated_at, autor:membros!culto_lar_posts_membro_id_fkey(id, nome)";

export class CultoLarError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "CultoLarError";
  }
}

export function erroCultoLar(status: number, message: string): CultoLarError {
  return new CultoLarError(message, status);
}

/** Não consulta configuração nem cria cliente antes de rejeitar uma requisição sem token. */
export function exigirTokenCultoLar(request: Request): void {
  if (!request.headers.get("authorization")?.match(/^Bearer\s+\S+$/i)) {
    throw new AcessoError("Entre novamente para acessar sua área.", 401);
  }
}

export async function resolverAcessoCultoLar(request: Request, exigirMembro = false) {
  exigirTokenCultoLar(request);
  return resolverAcesso(request, exigirMembro);
}

export function respostaErroCultoLar(error: unknown): Response {
  const status =
    error instanceof AcessoError || error instanceof CultoLarError
      ? error.status
      : 500;
  if (!(error instanceof AcessoError || error instanceof CultoLarError)) {
    console.error("Falha segura na API de Culto no Lar", {
      code: typeof error === "object" && error && "code" in error ? (error as { code?: unknown }).code : undefined,
    });
  }
  return Response.json(
    {
      error:
        error instanceof AcessoError || error instanceof CultoLarError
          ? error.message
          : "Não foi possível carregar o Culto no Lar. Tente novamente.",
    },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export function exigirMembroAtivo(contexto: Awaited<ReturnType<typeof resolverAcesso>>["contexto"]) {
  if (!contexto.membro) {
    throw erroCultoLar(403, "Seu acesso precisa estar vinculado a um membro ativo.");
  }
  return contexto.membro;
}

export function exigirModeracao(contexto: Awaited<ReturnType<typeof resolverAcesso>>["contexto"]): void {
  if (!canModerate(contexto)) {
    throw erroCultoLar(403, "Somente a liderança autorizada pode moderar o Culto no Lar.");
  }
}

function rowFromUnknown(value: unknown): CultoLarPostRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as CultoLarPostRow & { autor?: unknown };
  let autor: { id: string; nome: string } | null = null;
  if (Array.isArray(row.autor)) {
    const first = row.autor[0] as { id?: unknown; nome?: unknown } | undefined;
    if (typeof first?.id === "string" && typeof first.nome === "string") {
      autor = { id: first.id, nome: first.nome };
    }
  } else if (row.autor && typeof row.autor === "object") {
    const record = row.autor as { id?: unknown; nome?: unknown };
    if (typeof record.id === "string" && typeof record.nome === "string") {
      autor = { id: record.id, nome: record.nome };
    }
  }
  return { ...row, autor };
}

export async function buscarCultoLarPost(
  service: SupabaseClient,
  igrejaId: string,
  id: string,
): Promise<{ data: CultoLarPostRow | null; error: { code?: string } | null }> {
  const result = await service
    .from("culto_lar_posts")
    .select(CULTO_LAR_SELECT)
    .eq("id", id)
    .eq("igreja_id", igrejaId)
    .maybeSingle();
  return {
    data: rowFromUnknown(result.data),
    error: result.error ? { code: result.error.code } : null,
  };
}

export function dtoCultoLar(row: CultoLarPostRow, visao: CultoLarVisao): CultoLarPostDTO {
  return toCultoLarPostDTO(row, {
    includePrivateReason: visao !== "mural",
  });
}

export async function listarCultoLar(
  service: SupabaseClient,
  igrejaId: string,
  visao: CultoLarVisao,
  page: number,
  pageSize: number,
  membroId?: string,
  status?: CultoLarStatus,
  autorUsuarioId?: string,
): Promise<{ rows: CultoLarPostRow[]; total: number | null; hasMore: boolean }> {
  let query = service
    .from("culto_lar_posts")
    .select(CULTO_LAR_SELECT, { count: "exact" })
    .eq("igreja_id", igrejaId);
  if (visao === "mural") query = query.eq("status", "Aprovado");
  if (visao === "meus") query = query.eq("membro_id", membroId || "").eq("autor_usuario_id", autorUsuarioId || "");
  if (visao === "moderacao" && status) query = query.eq("status", status);
  const start = page * pageSize;
  const result = await query
    .order("data_culto", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(start, start + pageSize);
  if (result.error) {
    console.error("Falha ao listar Culto no Lar", { code: result.error.code });
    throw erroCultoLar(503, "Não foi possível carregar os envios do Culto no Lar.");
  }
  const rawRows = Array.isArray(result.data) ? result.data : [];
  const rows = rawRows.slice(0, pageSize).map(rowFromUnknown).filter((row): row is CultoLarPostRow => Boolean(row));
  return {
    rows,
    total: typeof result.count === "number" ? result.count : null,
    hasMore: rawRows.length > pageSize,
  };
}

export function normalizarMotivo(value: unknown): string | null | CultoLarError {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return erroCultoLar(400, "A razão da rejeição é inválida.");
  const motivo = value.trim();
  if (motivo.length > 500) return erroCultoLar(400, "A razão da rejeição deve ter no máximo 500 caracteres.");
  return motivo || null;
}

export function lerVersao(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") {
    throw erroCultoLar(400, "Envie a versão atual do envio para evitar sobrescrever uma revisão.");
  }
  const text = String(value);
  if (!/^\d+$/.test(text)) throw erroCultoLar(400, "A versão do envio é inválida.");
  const version = Number(text);
  if (!Number.isSafeInteger(version) || version < 1) throw erroCultoLar(400, "A versão do envio é inválida.");
  return version;
}

export function validarCamposSensíveis(form: FormData, permitidos: string[]): void {
  const sensíveis = [
    "igreja_id",
    "membro_id",
    "autor_usuario_id",
    "status",
    "foto_path",
    "foto_url",
    "object_path",
    "storage_path",
    "storage_bucket",
  ];
  for (const campo of sensíveis) {
    if (!permitidos.includes(campo) && form.has(campo)) {
      throw erroCultoLar(400, "O formulário contém um campo protegido que não pode ser enviado pelo cliente.");
    }
  }
}

export function lerCamposForm(form: FormData): CultoLarCampos {
  const result = {
    casa_nome: form.get("casa_nome"),
    data_culto: form.get("data_culto"),
    titulo: form.get("titulo"),
    referencia: form.get("referencia"),
    palavra: form.get("palavra"),
  };
  return result as unknown as CultoLarCampos;
}

export async function prepararFotoPrivada(
  bytes: Buffer,
  mimeDeclarado: string,
): Promise<{ bytes: Buffer; mime: CultoLarImagemMime }> {
  const validacao = validarFotoCultoLar(bytes, mimeDeclarado);
  if (!validacao.ok) throw erroCultoLar(400, validacao.error);
  let normalized: Buffer;
  // O reencode remove EXIF/GPS. Não há fallback para os bytes originais: um
  // decoder ausente ou uma imagem que não possa ser lida não deve preservar
  // metadados potencialmente sensíveis nem passar como foto válida.
  let sharp: ((input?: Buffer) => {
    rotate(): {
      jpeg(options: { quality: number }): { toBuffer(): Promise<Buffer> };
      png(): { toBuffer(): Promise<Buffer> };
      webp(options: { quality: number }): { toBuffer(): Promise<Buffer> };
    };
  }) | undefined;
  try {
    const sharpModule = await import("sharp");
    sharp = (sharpModule.default || sharpModule) as typeof sharp;
  } catch (error) {
    console.error("Sharp não está disponível para foto privada do Culto no Lar", {
      code: error instanceof Error ? error.name : undefined,
    });
    throw erroCultoLar(503, "O processamento seguro da foto está indisponível. Tente novamente.");
  }
  if (!sharp) throw erroCultoLar(503, "O processamento seguro da foto está indisponível. Tente novamente.");
  try {
    const image = sharp(bytes).rotate();
    normalized = await (
      validacao.value.mime === "image/jpeg"
        ? image.jpeg({ quality: 92 }).toBuffer()
        : validacao.value.mime === "image/png"
          ? image.png().toBuffer()
          : image.webp({ quality: 92 }).toBuffer()
    );
  } catch {
    throw erroCultoLar(400, "A foto não pôde ser lida ou normalizada com segurança.");
  }
  const finalValidation = validarFotoCultoLar(normalized, validacao.value.mime);
  if (!finalValidation.ok) throw erroCultoLar(400, finalValidation.error);
  return { bytes: normalized, mime: validacao.value.mime };
}

function extensaoFoto(mime: CultoLarImagemMime): string {
  return mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
}

export function caminhoFotoCultoLar(igrejaId: string, membroId: string, postId: string, mime: CultoLarImagemMime): string {
  return `${igrejaId}/${membroId}/${postId}/${crypto.randomUUID()}.${extensaoFoto(mime)}`;
}

export async function enviarFotoCultoLar(
  service: SupabaseClient,
  caminho: string,
  bytes: Buffer,
  mime: CultoLarImagemMime,
): Promise<void> {
  const result = await service.storage.from(CULTO_LAR_STORAGE_BUCKET).upload(caminho, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (result.error) {
    console.error("Falha ao salvar foto do Culto no Lar", { code: result.error.message });
    throw erroCultoLar(503, "Não foi possível salvar a foto privada do Culto no Lar.");
  }
}

export async function removerFotoCultoLar(service: SupabaseClient, caminho: string): Promise<void> {
  try {
    await service.storage.from(CULTO_LAR_STORAGE_BUCKET).remove([caminho]);
  } catch {
    // O registro já não referencia um caminho substituído; não vazar o erro de
    // limpeza nem transformar uma exclusão eventual em falha do envio.
  }
}

export async function inserirCultoLarPost(
  service: SupabaseClient,
  row: Record<string, unknown>,
): Promise<CultoLarPostRow> {
  const result = await service
    .from("culto_lar_posts")
    .insert(row)
    .select(CULTO_LAR_SELECT)
    .maybeSingle();
  if (result.error || !result.data) {
    console.error("Falha ao registrar Culto no Lar", { code: result.error?.code });
    throw erroCultoLar(503, "Não foi possível registrar o envio do Culto no Lar.");
  }
  const parsed = rowFromUnknown(result.data);
  if (!parsed) throw erroCultoLar(503, "O envio foi salvo sem um retorno válido.");
  return parsed;
}

export async function editarCultoLarPost(
  service: SupabaseClient,
  atual: CultoLarPostRow,
  contexto: Awaited<ReturnType<typeof resolverAcesso>>["contexto"],
  campos: CultoLarCampos,
  versao: number,
  novaFoto?: { caminho: string; mime: CultoLarImagemMime },
): Promise<CultoLarPostRow> {
  if (!canEditOwnPost(contexto, atual)) {
    throw erroCultoLar(404, "Envio do Culto no Lar não encontrado.");
  }
  const update = await service
    .from("culto_lar_posts")
    .update({
      casa_nome: campos.casa_nome,
      data_culto: campos.data_culto,
      titulo: campos.titulo,
      referencia: campos.referencia,
      palavra: campos.palavra,
      ...(novaFoto ? { foto_path: novaFoto.caminho, foto_mime: novaFoto.mime } : {}),
      status: "Pendente",
      motivo_rejeicao: null,
      decidido_por: null,
      decidido_em: null,
      versao: versao + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", atual.id)
    .eq("igreja_id", contexto.igrejaId)
    .eq("membro_id", contexto.membro?.id || "")
    .eq("autor_usuario_id", contexto.usuarioId)
    .eq("versao", versao)
    .select(CULTO_LAR_SELECT)
    .maybeSingle();
  if (update.error) {
    console.error("Falha ao editar Culto no Lar", { code: update.error.code });
    throw erroCultoLar(503, "Não foi possível atualizar o envio do Culto no Lar.");
  }
  if (!update.data) throw erroCultoLar(409, "Este envio foi alterado. Atualize a lista e tente novamente.");
  const parsed = rowFromUnknown(update.data);
  if (!parsed) throw erroCultoLar(503, "A edição foi salva sem um retorno válido.");
  return parsed;
}

export async function moderarCultoLarPost(
  service: SupabaseClient,
  postId: string,
  igrejaId: string,
  decididoPor: string,
  status: Extract<CultoLarStatus, "Aprovado" | "Rejeitado">,
  motivo: string | null,
  versao: number,
): Promise<CultoLarPostRow> {
  const result = await service.rpc("culto_lar_moderar_post", {
    p_post_id: postId,
    p_igreja_id: igrejaId,
    p_decidido_por: decididoPor,
    p_status: status,
    p_motivo: motivo,
    p_versao: versao,
  });
  if (result.error) {
    if (["P0001", "40001"].includes(result.error.code)) {
      throw erroCultoLar(409, "Este envio foi alterado. Atualize a fila e tente novamente.");
    }
    console.error("Falha ao moderar Culto no Lar", { code: result.error.code });
    throw erroCultoLar(503, "Não foi possível salvar a decisão do Culto no Lar.");
  }
  const value = Array.isArray(result.data) ? result.data[0] : result.data;
  const parsed = rowFromUnknown(value);
  if (!parsed) throw erroCultoLar(404, "Envio do Culto no Lar não encontrado.");
  return parsed;
}

export function podeVerFotoCultoLar(
  contexto: Awaited<ReturnType<typeof resolverAcesso>>["contexto"],
  row: CultoLarPostRow,
): boolean {
  return canViewPost(contexto, row);
}

export function validarVisao(value: string | null): CultoLarVisao {
  if (value === "mural" || value === "meus" || value === "moderacao") return value;
  throw erroCultoLar(400, "Visão do Culto no Lar inválida.");
}

export function validarStatusFiltro(value: string | null): CultoLarStatus | undefined {
  if (value === null || value === "" || value === "todos") return undefined;
  if (value === "Pendente" || value === "Aprovado" || value === "Rejeitado") return value;
  throw erroCultoLar(400, "Filtro de status inválido.");
}
