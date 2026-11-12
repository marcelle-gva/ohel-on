export const STATUS_ORACAO_PUBLICADA = "Em Oração" as const;
export const VISIBILIDADE_ORACAO_PUBLICA = "Público" as const;
export const JANELA_ORACAO_RECENTE_DIAS = 7;

export function inicioJanelaOracaoRecente(agora = new Date()): string {
  return new Date(
    agora.getTime() - JANELA_ORACAO_RECENTE_DIAS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

export function oracaoPublicaRecente(
  pedido: {
    status?: unknown;
    visibilidade?: unknown;
    created_at?: unknown;
  },
  agora = new Date(),
): boolean {
  if (
    pedido.status !== STATUS_ORACAO_PUBLICADA ||
    pedido.visibilidade !== VISIBILIDADE_ORACAO_PUBLICA ||
    typeof pedido.created_at !== "string"
  ) {
    return false;
  }

  const criadoEm = Date.parse(pedido.created_at);
  return (
    Number.isFinite(criadoEm) &&
    criadoEm >= Date.parse(inicioJanelaOracaoRecente(agora)) &&
    criadoEm <= agora.getTime()
  );
}
