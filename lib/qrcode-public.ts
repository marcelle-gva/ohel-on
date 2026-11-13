import { obterOrigemPublica } from "./public-site";

export type PublicQrCodeKind = "congregado" | "visitante";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function igrejaIdSeguro(igrejaId: string) {
  const valor = igrejaId.trim();
  return UUID_RE.test(valor) ? valor : "";
}

export function criarLinkPublicoCongregado(igrejaId: string) {
  const id = igrejaIdSeguro(igrejaId);
  return id ? `${obterOrigemPublica()}/congregado/${encodeURIComponent(id)}` : "";
}

export function criarLinkPublicoVisitante(igrejaId: string) {
  const id = igrejaIdSeguro(igrejaId);
  return id ? `${obterOrigemPublica()}/visitante/${encodeURIComponent(id)}` : "";
}

export function criarLinkPublicoQr(tipo: PublicQrCodeKind, igrejaId: string) {
  return tipo === "congregado"
    ? criarLinkPublicoCongregado(igrejaId)
    : criarLinkPublicoVisitante(igrejaId);
}
