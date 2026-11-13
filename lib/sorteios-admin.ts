export const SORTEIOS_STORAGE_BUCKET = "cartazes";
export const MAX_SORTEIO_IMAGE_BYTES = 8 * 1024 * 1024;
export const IMAGE_GENERATION_COOLDOWN_MS = 60 * 1000;

export type ImagemMime = "image/jpeg" | "image/png" | "image/webp";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function parseNumeroManual(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function validarCadastroComprador(nome: unknown, telefone: unknown): string | null {
  if (typeof nome !== "string" || nome.trim().length < 2 || nome.trim().length > 150) {
    return "Informe o nome do comprador (2 a 150 caracteres).";
  }
  if (typeof telefone !== "string" || telefone.trim().length < 8 || telefone.trim().length > 30) {
    return "Informe um telefone válido (8 a 30 caracteres).";
  }
  return null;
}

export function detectarMimeImagem(bytes: Uint8Array): ImagemMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
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
    bytes.length >= 12 &&
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

export function validarImagemRecebida(
  bytes: Uint8Array,
  declarado: string,
): { mime: ImagemMime } | { error: string } {
  if (bytes.byteLength === 0) return { error: "A foto enviada está vazia." };
  if (bytes.byteLength > MAX_SORTEIO_IMAGE_BYTES) {
    return { error: "A foto deve ter no máximo 8 MB." };
  }
  const mime = detectarMimeImagem(bytes);
  if (!mime) return { error: "Envie uma imagem JPEG, PNG ou WebP válida." };
  if (declarado && declarado !== mime) {
    return { error: "O conteúdo da foto não corresponde ao MIME informado." };
  }
  return { mime };
}

function removerPossiveisDadosPessoais(value: string): string {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function construirPromptPremio(nome: string, descricao: string | null | undefined): string {
  const premio = removerPossiveisDadosPessoais(nome).slice(0, 160) || "prêmio do sorteio";
  const detalhes = removerPossiveisDadosPessoais(descricao || "").slice(0, 360);
  return [
    "Crie uma foto promocional realista e acolhedora para um sorteio de uma igreja.",
    `Prêmio: ${premio}.`,
    detalhes ? `Detalhes do prêmio: ${detalhes}.` : "",
    "Não inclua texto, logotipos, nomes de pessoas, telefones, e-mails ou qualquer dado pessoal na imagem.",
    "Composição limpa, iluminação natural, foco no prêmio, formato quadrado e fundo discreto.",
  ].filter(Boolean).join(" ");
}
