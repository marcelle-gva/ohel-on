const ORIGEM_PUBLICA_PADRAO = "https://www.ipocloud.com.br";

/** Links distribuídos às famílias nunca devem depender do domínio do painel/preview. */
export function obterOrigemPublica(configurada = process.env.NEXT_PUBLIC_APP_URL) {
  try {
    const url = new URL(configurada?.trim() || ORIGEM_PUBLICA_PADRAO);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      host === "vercel.app" ||
      host.endsWith(".vercel.app") ||
      host === "vercel.com" ||
      host.endsWith(".vercel.com") ||
      host === "localhost" ||
      host === "127.0.0.1"
    ) {
      return ORIGEM_PUBLICA_PADRAO;
    }
    return url.origin;
  } catch {
    return ORIGEM_PUBLICA_PADRAO;
  }
}

export function criarLinkPublicoKids(igrejaId: string) {
  const id = igrejaId.trim();
  return id ? `${obterOrigemPublica()}/pre-cadastro-kids-teens/${encodeURIComponent(id)}` : "";
}
