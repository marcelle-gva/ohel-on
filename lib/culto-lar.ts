import type { ContextoAcesso } from "@/lib/access";

export const CULTO_LAR_STATUS = ["Pendente", "Aprovado", "Rejeitado"] as const;
export type CultoLarStatus = (typeof CULTO_LAR_STATUS)[number];

export const CULTO_LAR_VISOES = ["mural", "meus", "moderacao"] as const;
export type CultoLarVisao = (typeof CULTO_LAR_VISOES)[number];

export const CULTO_LAR_STORAGE_BUCKET = "culto-lar-fotos";
export const MAX_CULTO_LAR_FOTO_BYTES = 4 * 1024 * 1024;
export const DEFAULT_CULTO_LAR_PAGE_SIZE = 25;
export const MAX_CULTO_LAR_PAGE_SIZE = 50;

export type CultoLarImagemMime = "image/jpeg" | "image/png" | "image/webp";

export interface CultoLarCampos {
  casa_nome: string;
  data_culto: string;
  titulo: string | null;
  referencia: string | null;
  palavra: string;
}

export interface CultoLarPostRow {
  id: string;
  igreja_id: string;
  membro_id: string;
  autor_usuario_id: string;
  casa_nome: string;
  data_culto: string;
  titulo: string | null;
  referencia: string | null;
  palavra: string;
  foto_path: string;
  foto_mime: CultoLarImagemMime;
  status: CultoLarStatus;
  motivo_rejeicao: string | null;
  versao: number;
  decidido_por: string | null;
  decidido_em: string | null;
  created_at: string;
  updated_at: string;
  autor?: { id: string; nome: string } | null;
}

export interface CultoLarPostDTO {
  id: string;
  casa_nome: string;
  data_culto: string;
  titulo: string | null;
  referencia: string | null;
  palavra: string;
  status: CultoLarStatus;
  versao: number;
  created_at: string;
  updated_at: string;
  decidido_em: string | null;
  autor: { id: string; nome: string };
  foto_endpoint: string;
  foto_mime: CultoLarImagemMime;
  motivo_rejeicao?: string | null;
}

export interface CultoLarListResult {
  posts: CultoLarPostDTO[];
  pagination: {
    page: number;
    page_size: number;
    has_more: boolean;
    next_page: number | null;
    total: number | null;
  };
  visao: CultoLarVisao;
}

export type Validacao<T> = { ok: true; value: T } | { ok: false; error: string };

function textoObrigatorio(value: unknown, nome: string, maximo: number): Validacao<string> {
  if (typeof value !== "string") return { ok: false, error: `Informe ${nome}.` };
  const normalizado = value.trim();
  if (!normalizado) return { ok: false, error: `Informe ${nome}.` };
  if (normalizado.length > maximo) {
    return { ok: false, error: `${nome[0]?.toUpperCase() || nome} deve ter no máximo ${maximo} caracteres.` };
  }
  return { ok: true, value: normalizado };
}

function textoOpcional(value: unknown, nome: string, maximo: number): Validacao<string | null> {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: `${nome} inválido.` };
  const normalizado = value.trim();
  if (!normalizado) return { ok: true, value: null };
  if (normalizado.length > maximo) {
    return { ok: false, error: `${nome[0]?.toUpperCase() || nome} deve ter no máximo ${maximo} caracteres.` };
  }
  return { ok: true, value: normalizado };
}

/** Valida um calendário civil YYYY-MM-DD sem conversão para o fuso local. */
export function validarDataCultoLar(value: unknown): Validacao<string> {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, error: "Informe uma data válida no formato AAAA-MM-DD." };
  }
  const [ano, mes, dia] = value.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    !Number.isInteger(ano) ||
    ano < 1900 ||
    ano > 2200 ||
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    return { ok: false, error: "Informe uma data válida no formato AAAA-MM-DD." };
  }
  return { ok: true, value };
}

export function validarCamposCultoLar(input: unknown): Validacao<CultoLarCampos> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Formulário inválido." };
  }
  const body = input as Record<string, unknown>;
  const casa = textoObrigatorio(body.casa_nome, "o nome da casa ou família", 150);
  if (!casa.ok) return casa;
  const data = validarDataCultoLar(body.data_culto);
  if (!data.ok) return data;
  const titulo = textoOpcional(body.titulo, "o título", 200);
  if (!titulo.ok) return titulo;
  const referencia = textoOpcional(body.referencia, "a referência", 200);
  if (!referencia.ok) return referencia;
  const palavra = textoObrigatorio(body.palavra, "a Palavra ministrada", 20_000);
  if (!palavra.ok) return palavra;
  return {
    ok: true,
    value: {
      casa_nome: casa.value,
      data_culto: data.value,
      titulo: titulo.value,
      referencia: referencia.value,
      palavra: palavra.value,
    },
  };
}

export function validarAutorizacaoImagem(value: unknown): Validacao<true> {
  if (value === true || value === "true") return { ok: true, value: true };
  return { ok: false, error: "Confirme a autorização para compartilhar a foto antes de enviar." };
}

export function detectarMimeFotoCultoLar(bytes: Uint8Array): CultoLarImagemMime | null {
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.byteLength >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.byteLength >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function validarFotoCultoLar(
  bytes: Uint8Array,
  mimeDeclarado: unknown,
): Validacao<{ mime: CultoLarImagemMime }> {
  if (bytes.byteLength === 0) return { ok: false, error: "A foto não pode estar vazia." };
  if (bytes.byteLength > MAX_CULTO_LAR_FOTO_BYTES) {
    return { ok: false, error: "A foto deve ter no máximo 4 MB." };
  }
  const mime = detectarMimeFotoCultoLar(bytes);
  if (!mime || mimeDeclarado !== mime) {
    return { ok: false, error: "Envie uma foto JPEG, PNG ou WebP válida." };
  }
  return { ok: true, value: { mime } };
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function parseCultoLarPage(value: string | null): Validacao<number> {
  if (value === null || value === "") return { ok: true, value: 0 };
  if (!/^\d+$/.test(value)) return { ok: false, error: "Página inválida." };
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 0 || page > 100_000) {
    return { ok: false, error: "Página inválida." };
  }
  return { ok: true, value: page };
}

export function parseCultoLarPageSize(value: string | null): Validacao<number> {
  if (value === null || value === "") return { ok: true, value: DEFAULT_CULTO_LAR_PAGE_SIZE };
  if (!/^\d+$/.test(value)) return { ok: false, error: "Tamanho de página inválido." };
  const pageSize = Number(value);
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_CULTO_LAR_PAGE_SIZE) {
    return { ok: false, error: `O tamanho de página deve ficar entre 1 e ${MAX_CULTO_LAR_PAGE_SIZE}.` };
  }
  return { ok: true, value: pageSize };
}

function semAcentos(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function permissaoDeModeracao(permissao: { modulo?: unknown; acao?: unknown }): boolean {
  const modulo = typeof permissao.modulo === "string" ? semAcentos(permissao.modulo) : "";
  const acao = typeof permissao.acao === "string" ? semAcentos(permissao.acao) : "";
  // mural é o módulo do Culto no Lar. Os dois módulos de oração são aceitos
  // para preservar a regra já aplicada ao grupo Liderança nessa área, sem
  // conceder nada a cargo, departamento ou membro básico.
  return (
    ["mural", "oracoes", "monitor-oracoes"].includes(modulo) &&
    ["aprovar", "editar"].includes(acao)
  );
}

/** Regra pura compartilhada pelo dashboard, fila e handlers: admin ou Liderança autorizada. */
export function canModerate(contexto: Pick<ContextoAcesso, "role" | "grupoNome" | "permissoes">): boolean {
  if (contexto.role === "admin") return true;
  if (semAcentos(contexto.grupoNome || "") !== "lideranca") return false;
  return contexto.permissoes.some(permissaoDeModeracao);
}

export function canEditOwnPost(
  contexto: Pick<ContextoAcesso, "igrejaId" | "membro" | "usuarioId">,
  post: Pick<CultoLarPostRow, "igreja_id" | "membro_id" | "autor_usuario_id">,
): boolean {
  return Boolean(
    contexto.membro &&
      contexto.igrejaId === post.igreja_id &&
      contexto.membro.id === post.membro_id &&
      contexto.usuarioId === post.autor_usuario_id,
  );
}

export function canViewPost(
  contexto: Pick<ContextoAcesso, "igrejaId" | "membro" | "usuarioId" | "role" | "grupoNome" | "permissoes">,
  post: Pick<CultoLarPostRow, "igreja_id" | "membro_id" | "autor_usuario_id" | "status">,
): boolean {
  if (contexto.igrejaId !== post.igreja_id) return false;
  if (canModerate(contexto)) return true;
  if (!contexto.membro) return false;
  if (post.status === "Aprovado") return true;
  return contexto.membro.id === post.membro_id && contexto.usuarioId === post.autor_usuario_id;
}

export function toCultoLarPostDTO(
  row: CultoLarPostRow,
  options: { includePrivateReason: boolean; fotoEndpoint?: string },
): CultoLarPostDTO {
  const dto: CultoLarPostDTO = {
    id: row.id,
    casa_nome: row.casa_nome,
    data_culto: row.data_culto,
    titulo: row.titulo,
    referencia: row.referencia,
    palavra: row.palavra,
    status: row.status,
    versao: row.versao,
    created_at: row.created_at,
    updated_at: row.updated_at,
    decidido_em: row.decidido_em,
    autor: row.autor || { id: row.membro_id, nome: "Membro" },
    foto_endpoint: options.fotoEndpoint || `/api/culto-lar/${row.id}/foto`,
    foto_mime: row.foto_mime,
  };
  if (options.includePrivateReason) dto.motivo_rejeicao = row.motivo_rejeicao;
  return dto;
}
