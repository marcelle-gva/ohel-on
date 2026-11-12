import type { AvisoMembro, MonitorMembroData } from "@/lib/member-monitor";

export interface AvisoDashboard extends AvisoMembro {
  categoria?: "aviso" | "evento" | "oracao" | "culto";
  data_inicio?: string | null;
  data_fim?: string | null;
  hora_abertura?: string | null;
}

export interface DashboardMembroData extends MonitorMembroData {
  avisos: AvisoDashboard[];
  igreja: {
    nome: string;
    endereco: string | null;
    mapa_url: string | null;
  };
}

export function criarMapaUrl(
  igrejaNome: string,
  endereco: string | null,
): string | null {
  const enderecoNormalizado = endereco?.trim() || "";
  if (!enderecoNormalizado) return null;

  const nomeNormalizado = igrejaNome.trim();
  const consulta = [nomeNormalizado, enderecoNormalizado]
    .filter(Boolean)
    .join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}

function mapaUrlSeguro(igreja: DashboardMembroData["igreja"]): string | null {
  if (igreja.mapa_url) {
    try {
      const url = new URL(igreja.mapa_url);
      if (
        url.protocol === "https:" &&
        ["google.com", "www.google.com"].includes(url.hostname)
      ) {
        return url.href;
      }
    } catch {
      // Um endereço de mapa inválido não deve virar um link externo inseguro.
    }
  }
  return criarMapaUrl(igreja.nome, igreja.endereco);
}

export function criarMensagemConvite(
  igreja: DashboardMembroData["igreja"],
): string | null {
  const endereco = igreja.endereco?.trim() || "";
  if (!endereco) return null;

  const mapa = mapaUrlSeguro(igreja);
  if (!mapa) return null;

  const nome = igreja.nome.trim() || "nossa igreja";
  return [
    `Olá! Quero te convidar para estar com a gente na ${nome}.`,
    `Endereço: ${endereco}`,
    `Mapa: ${mapa}`,
  ].join("\n");
}

export function criarWhatsAppUrl(
  igreja: DashboardMembroData["igreja"],
): string | null {
  const mensagem = criarMensagemConvite(igreja);
  if (!mensagem) return null;

  // encodeURIComponent preserva quebras de linha como dados da mensagem e não
  // permite que o endereço controlado pela igreja altere o destino do link.
  return `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
}

export function obterMapaUrlSeguro(
  igreja: DashboardMembroData["igreja"],
): string | null {
  return mapaUrlSeguro(igreja);
}
