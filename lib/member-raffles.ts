export interface SorteioMembroFonte {
  id?: unknown;
  igreja_id?: unknown;
  tipo?: unknown;
  status?: unknown;
  nome?: unknown;
  descricao?: unknown;
  valor_bilhete?: unknown;
  data_sorteio?: unknown;
  cartaz_url?: unknown;
  imagem_url?: unknown;
  created_at?: unknown;
}

export interface SorteioMembro {
  id: string;
  titulo: string;
  premio: string;
  valor_por_numero: number;
  imagem_url?: string | null;
  prazo: string | null;
  regra: string | null;
  link_publico: string;
}

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function textoPublico(value: unknown, limite: number): string | null {
  if (typeof value !== "string") return null;
  const texto = value.trim();
  return texto ? texto.slice(0, limite) : null;
}

function dataIsoValida(value: string): boolean {
  const partes = value.match(DATA_ISO);
  if (!partes) return false;
  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    Number.isFinite(ano) &&
    ano >= 1 &&
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia
  );
}

export function obterDataAtualSaoPaulo(instante = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(instante);
  const valor = (tipo: string) =>
    partes.find((parte) => parte.type === tipo)?.value || "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

export function dataSorteioEncerrada(
  valor: unknown,
  hoje = obterDataAtualSaoPaulo(),
): boolean {
  if (valor === null || valor === undefined || valor === "") return false;
  if (typeof valor !== "string" || !dataIsoValida(valor)) return true;
  if (!dataIsoValida(hoje)) return true;
  return valor < hoje;
}

export function linkPublicoSorteio(id: string): string {
  return `/sorteio/${encodeURIComponent(id)}`;
}

export function imagemPublicaSegura(value: unknown): string | null {
  const url = textoPublico(value, 2000);
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function valorNumerico(value: unknown): number | null {
  const numero = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

export function projetarSorteioMembro(
  row: SorteioMembroFonte,
  hoje = obterDataAtualSaoPaulo(),
): SorteioMembro | null {
  const id = textoPublico(row.id, 120);
  const titulo = textoPublico(row.nome, 300);
  const valor = valorNumerico(row.valor_bilhete);
  const data = row.data_sorteio === null || row.data_sorteio === undefined
    ? null
    : textoPublico(row.data_sorteio, 10);
  const regra = textoPublico(row.descricao, 10000);
  if (
    !id ||
    !titulo ||
    valor === null ||
    (data !== null && (!dataIsoValida(data) || dataSorteioEncerrada(data, hoje)))
  ) {
    return null;
  }
  return {
    id,
    titulo,
    premio: titulo,
    valor_por_numero: valor,
    imagem_url: imagemPublicaSegura(row.imagem_url ?? row.cartaz_url),
    prazo: data,
    regra,
    link_publico: linkPublicoSorteio(id),
  };
}

export function selecionarSorteiosAtivos(
  rows: SorteioMembroFonte[],
  hoje = obterDataAtualSaoPaulo(),
): SorteioMembro[] {
  return rows
    .filter((row) => row.status === "ativo" && (row.tipo === undefined || row.tipo === "sorteio"))
    .map((row) => projetarSorteioMembro(row, hoje))
    .filter((row): row is SorteioMembro => row !== null);
}
