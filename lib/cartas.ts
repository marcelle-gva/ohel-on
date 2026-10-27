type DataRecord = Record<string, unknown>;

export type AssinaturaCarta = {
  cargo: string;
  nome: string;
};

export type OpcoesCarta = {
  mostrarCabecalho: boolean;
  mostrarRodape: boolean;
  incluirAssinatura: boolean;
  assinaturas: AssinaturaCarta[];
};

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatDate(value: unknown, long = false): string {
  const raw = textValue(value);
  if (!raw) return "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00`)
    : new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("pt-BR", long
    ? { day: "2-digit", month: "long", year: "numeric" }
    : { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function sanitizeLetterHtml(html: string): string {
  if (typeof DOMParser === "undefined") return escapeHtml(html);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const allowedTags = new Set(["P", "DIV", "SPAN", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "BLOCKQUOTE", "H1", "H2", "H3", "H4"]);
  const blockedTags = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG", "MATH", "TEMPLATE"]);
  parsed.body.querySelectorAll("*").forEach(element => {
    if (blockedTags.has(element.tagName)) {
      element.remove();
    } else if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
    } else {
      Array.from(element.attributes).forEach(attribute => element.removeAttribute(attribute.name));
    }
  });
  return parsed.body.innerHTML;
}

export function renderLetterBody(
  content: string,
  member: DataRecord,
  church: DataRecord,
  emissionDate: string,
  destinationChurch?: DataRecord,
): string {
  const congregation = member.congregacoes && typeof member.congregacoes === "object"
    ? member.congregacoes as DataRecord
    : {};
  const values: Record<string, string> = {
    nome: textValue(member.nome),
    cpf: textValue(member.cpf, "Não informado"),
    rg: textValue(member.rg, "Não informado"),
    cargo: textValue(member.cargo, "Membro"),
    congregacao: textValue(congregation.nome, "Sede"),
    denominacao: textValue(church.nome, "Igreja"),
    nome_igreja: textValue(church.nome, "Igreja"),
    igreja_destino: textValue(destinationChurch?.nome),
    email_igreja_destino: textValue(destinationChurch?.email),
    data_atual: formatDate(emissionDate, true),
    data_emissao: formatDate(emissionDate, true),
    data_nascimento: formatDate(member.data_nascimento),
    data_batismo: formatDate(member.data_batismo),
    email: textValue(member.email),
    telefone: textValue(member.telefone),
    endereco: textValue(member.endereco),
    cidade: textValue(member.cidade),
    estado: textValue(member.estado),
    cep: textValue(member.cep),
  };
  return content.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (placeholder, key: string) =>
    escapeHtml(values[key] ?? placeholder));
}

function safeImageUrl(value: unknown): string {
  const raw = textValue(value);
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function buildLetterHtml(
  model: DataRecord,
  member: DataRecord,
  church: DataRecord,
  emissionDate: string,
  options: OpcoesCarta,
  safeTemplateContent: string,
  destinationChurch?: DataRecord,
): string {
  const bannerUrl = model.tipo_cabecalho === "custom"
    ? safeImageUrl(model.imagem_cabecalho_url)
    : "";
  const logoUrl = safeImageUrl(church.logo_url);
  const header = options.mostrarCabecalho
    ? bannerUrl
      ? `<header style="margin-bottom:32px;text-align:center"><img src="${escapeHtml(bannerUrl)}" alt="Cabeçalho da igreja" style="max-width:100%;max-height:150px;object-fit:contain"></header>`
      : `<header style="display:flex;justify-content:space-between;align-items:center;gap:24px;border-bottom:2px solid #222;padding-bottom:16px;margin-bottom:32px">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logotipo da igreja" style="max-width:140px;max-height:72px;object-fit:contain">` : ""}<div style="text-align:right"><strong style="font-size:20px;text-transform:uppercase">${escapeHtml(textValue(church.nome, "Igreja"))}</strong><div style="font-size:11px;line-height:1.5;color:#444">${escapeHtml(textValue(church.cnpj))}<br>${escapeHtml(textValue(church.endereco))}<br>${escapeHtml(textValue(church.email))} ${escapeHtml(textValue(church.telefone))}</div></div></header>`
    : "";
  const renderedBody = renderLetterBody(safeTemplateContent, member, church, emissionDate, destinationChurch);
  const signatures = options.incluirAssinatura && options.assinaturas.length
    ? `<section style="display:flex;justify-content:space-around;gap:32px;flex-wrap:wrap;margin-top:64px">${options.assinaturas.map(signature => `<div style="min-width:180px;border-top:1px solid #222;padding-top:8px;text-align:center"><strong>${escapeHtml(signature.nome || signature.cargo)}</strong><br><span style="font-size:12px;color:#555">${escapeHtml(signature.cargo)}</span></div>`).join("")}</section>`
    : "";
  const footerText = model.tipo_rodape === "custom"
    ? textValue(model.texto_rodape)
    : "Documento gerado eletronicamente pelo sistema OHEL ON.";
  const footer = options.mostrarRodape && footerText
    ? `<footer style="border-top:1px solid #ccc;padding-top:10px;margin-top:48px;font-size:10px;color:#666;white-space:pre-wrap">${escapeHtml(footerText)}</footer>`
    : "";
  return `<article style="box-sizing:border-box;background:#fff;color:#111;font-family:Arial,sans-serif;font-size:14px;line-height:1.7">${header}<main style="text-align:justify;white-space:pre-wrap">${renderedBody}</main>${signatures}${footer}</article>`;
}

export function letterHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote|header|main|footer|section|article)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_entity, code: string) => {
      const point = Number(code);
      return point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
