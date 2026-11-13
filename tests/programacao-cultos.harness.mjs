export function validarIntervalo(inicio, fim) {
  if (!inicio || !fim || fim <= inicio) throw new Error("O horário de encerramento deve ser depois do horário de início.");
}

export function validarConflito(items, candidato, id = null) {
  validarIntervalo(candidato.inicio, candidato.fim);
  return items.some((item) => item.ativo !== false && item.id !== id && item.data === candidato.data && candidato.inicio < item.fim && candidato.fim > item.inicio);
}

export function editarModeloPreservandoSessoes(modelo, sessoes, alteracoes, agora) {
  validarIntervalo(alteracoes.inicio, alteracoes.fim);
  return {
    modelo: { ...modelo, ...alteracoes, vigencia_desde: agora },
    sessoes: sessoes.map((sessao) => ({ ...sessao })),
  };
}
