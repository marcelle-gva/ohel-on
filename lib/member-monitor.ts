export interface AvisoMembro {
  id: string;
  tipo: "aviso" | "evento";
  titulo: string;
  conteudo: string | null;
  imagem_url: string | null;
  fotos: string[];
  created_at: string;
  preco_ingresso?: number | null;
  pregador_convidados?: string | null;
  informacoes_adicionais?: string | null;
}
export interface MonitorMembroData {
  avisos: AvisoMembro[];
  louvores: {
    id: string;
    titulo: string;
    tom: string | null;
    ministro: string | null;
    palavra_vinculada: string | null;
  }[];
  oracoes: { id: string; nome_solicitante: string | null; descricao: string }[];
  visitantes: number;
  culto: { id: string; titulo: string; link_ao_vivo: string | null } | null;
  palavra: {
    titulo: string | null;
    referencia: string | null;
    slides: string[];
  } | null;
}
