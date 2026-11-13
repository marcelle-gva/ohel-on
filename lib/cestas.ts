export type CestaStatus = "aberta" | "encerrada" | "arquivada";

export interface CestaCampanha {
  id: string;
  nome: string;
  descricao: string | null;
  status: CestaStatus | string;
  quantidade_cestas: number;
  created_at?: string;
}

export interface CestaItem {
  id: string;
  cesta_id: string;
  nome: string;
  unidade: string;
  /** Total necessário na campanha. Mantido para compatibilidade com a RPC existente. */
  quantidade_necessaria: number;
  /** Quantidade necessária em uma cesta; nulo identifica item legado não derivável. */
  quantidade_por_cesta: number | null;
  created_at?: string;
}

export interface CestaReserva {
  id: string;
  cesta_id?: string;
  item_id: string;
  membro_id?: string | null;
  nome_doador?: string;
  quantidade: number;
  status: "reservado" | "entregue" | "cancelado" | string;
  reservado_em: string;
  whatsapp_doador_status?: string;
  whatsapp_responsaveis_status?: string;
}

export interface CestaResponsavel {
  id: string;
  nome: string;
  telefone: string;
  ativo: boolean;
  notificar_reserva: boolean;
}

export interface CestaSugestao {
  nome: string;
  unidade: string;
  origem: "histórico da igreja" | "catálogo básico";
}

export const CATALOGO_CESTA_BASICA: ReadonlyArray<Pick<CestaSugestao, "nome" | "unidade">> = [
  { nome: "Arroz", unidade: "kg" },
  { nome: "Feijão", unidade: "kg" },
  { nome: "Macarrão", unidade: "pacote" },
  { nome: "Óleo", unidade: "litro" },
  { nome: "Açúcar", unidade: "kg" },
  { nome: "Farinha de trigo", unidade: "kg" },
  { nome: "Fubá", unidade: "kg" },
  { nome: "Leite em pó", unidade: "pacote" },
  { nome: "Café", unidade: "pacote" },
  { nome: "Sal", unidade: "kg" },
  { nome: "Biscoito", unidade: "pacote" },
  { nome: "Sardinha", unidade: "lata" },
  { nome: "Molho de tomate", unidade: "sachê" },
  { nome: "Sabonete", unidade: "unidade" },
  { nome: "Papel higiênico", unidade: "pacote" },
];

export function totalNecessario(item: Pick<CestaItem, "quantidade_necessaria" | "quantidade_por_cesta">, quantidadeCestas: number) {
  if (item.quantidade_por_cesta !== null && item.quantidade_por_cesta > 0) {
    return item.quantidade_por_cesta * Math.max(1, quantidadeCestas);
  }
  return item.quantidade_necessaria;
}

export function quantidadePorCestaSegura(
  item: Pick<CestaItem, "quantidade_necessaria" | "quantidade_por_cesta">,
  quantidadeCestas: number,
) {
  if (item.quantidade_por_cesta !== null && item.quantidade_por_cesta > 0) return item.quantidade_por_cesta;
  return quantidadeCestas === 1 ? item.quantidade_necessaria : null;
}

export function compromissoPorReserva(reservas: ReadonlyArray<Pick<CestaReserva, "quantidade" | "status">>) {
  return reservas.reduce((total, reserva) => {
    return reserva.status === "reservado" || reserva.status === "entregue"
      ? total + reserva.quantidade
      : total;
  }, 0);
}

export function separarCompromissos(reservas: ReadonlyArray<Pick<CestaReserva, "quantidade" | "status">>) {
  return reservas.reduce(
    (totais, reserva) => {
      if (reserva.status === "reservado") totais.reservado += reserva.quantidade;
      if (reserva.status === "entregue") totais.entregue += reserva.quantidade;
      return totais;
    },
    { reservado: 0, entregue: 0 },
  );
}

export function combinarSugestoes(
  historico: ReadonlyArray<Pick<CestaSugestao, "nome" | "unidade">>,
): CestaSugestao[] {
  const vistos = new Set<string>();
  const resultado: CestaSugestao[] = [];
  const adicionar = (item: Pick<CestaSugestao, "nome" | "unidade">, origem: CestaSugestao["origem"]) => {
    const nome = item.nome.trim();
    const unidade = item.unidade.trim() || "unidade";
    const chave = `${nome.toLocaleLowerCase("pt-BR")}::${unidade.toLocaleLowerCase("pt-BR")}`;
    if (!nome || vistos.has(chave)) return;
    vistos.add(chave);
    resultado.push({ nome, unidade, origem });
  };

  historico.forEach((item) => adicionar(item, "histórico da igreja"));
  CATALOGO_CESTA_BASICA.forEach((item) => adicionar(item, "catálogo básico"));
  return resultado;
}
