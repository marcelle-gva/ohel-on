export type TipoTransacaoFinanceira = "Receita" | "Despesa" | string;

export interface CaixaParaCalculo {
  id: string;
  nome: string;
  tipo: string;
  saldoInicialCentavos: number;
}

export interface TransacaoParaCalculo {
  id: string;
  tipo: TipoTransacaoFinanceira;
  mesReferencia: string;
  valorCentavos: number;
  caixaId: string | null;
}

export interface ContaPagarParaCalculo {
  id: string;
  descricao: string;
  dataVencimento: string;
  status: string;
  valorCentavos: number;
}

export interface ContaPagarCalculada extends ContaPagarParaCalculo {
  statusCalculado: string;
}

export interface IndicadoresFinanceiros {
  receitasCentavos: number;
  despesasCentavos: number;
  saldoMovimentoCentavos: number;
  saldoContasCentavos: number;
  transacoesSemConta: number;
  linhasIgnoradas: number;
  contas: Array<CaixaParaCalculo & {
    movimentoCentavos: number;
    saldoAtualCentavos: number;
  }>;
  contasPagar: ContaPagarCalculada[];
  contasPagarResumo: {
    previstoCentavos: number;
    pagoCentavos: number;
    emAbertoCentavos: number;
    canceladoCentavos: number;
  };
}

export function impactoTransacaoCentavos(
  tipo: TipoTransacaoFinanceira,
  valorCentavos: number,
): number {
  const valor = Math.abs(Math.trunc(valorCentavos));
  if (!Number.isSafeInteger(valor)) throw new Error("Valor de transação inválido.");
  if (tipo === "Receita") return valor;
  if (tipo === "Despesa") return -valor;
  // O schema atual só permite Receita/Despesa. Tipos futuros, como
  // transferência, não entram no saldo até possuírem vínculo explícito de origem/destino.
  return 0;
}

export function calcularIndicadoresFinanceiros({
  periodo,
  hojeSaoPaulo,
  caixas,
  transacoes,
  contasPagar,
}: {
  periodo: string;
  hojeSaoPaulo: string;
  caixas: CaixaParaCalculo[];
  transacoes: TransacaoParaCalculo[];
  contasPagar: ContaPagarParaCalculo[];
}): IndicadoresFinanceiros {
  const movimentoPorCaixa = new Map(caixas.map((caixa) => [caixa.id, 0]));
  let receitasCentavos = 0;
  let despesasCentavos = 0;
  let transacoesSemConta = 0;
  let linhasIgnoradas = 0;

  for (const transacao of transacoes) {
    const impacto = impactoTransacaoCentavos(transacao.tipo, transacao.valorCentavos);
    if (impacto === 0) {
      linhasIgnoradas += 1;
      continue;
    }

    if (transacao.mesReferencia === periodo) {
      if (impacto > 0) receitasCentavos += impacto;
      else despesasCentavos += Math.abs(impacto);
    }

    if (transacao.caixaId) {
      if (movimentoPorCaixa.has(transacao.caixaId)) {
        movimentoPorCaixa.set(
          transacao.caixaId,
          (movimentoPorCaixa.get(transacao.caixaId) || 0) + impacto,
        );
      } else {
        transacoesSemConta += 1;
      }
    } else {
      transacoesSemConta += 1;
    }
  }

  const contas = caixas.map((caixa) => {
    const movimentoCentavos = movimentoPorCaixa.get(caixa.id) || 0;
    return {
      ...caixa,
      movimentoCentavos,
      saldoAtualCentavos: caixa.saldoInicialCentavos + movimentoCentavos,
    };
  });

  const contasPagarCalculadas = contasPagar
    .filter((conta) => conta.dataVencimento.startsWith(periodo))
    .map((conta) => ({
      ...conta,
      statusCalculado:
        conta.status === "Pendente" && conta.dataVencimento < hojeSaoPaulo
          ? "Atrasado"
          : conta.status,
    }));

  let previstoCentavos = 0;
  let pagoCentavos = 0;
  let emAbertoCentavos = 0;
  let canceladoCentavos = 0;
  for (const conta of contasPagarCalculadas) {
    if (conta.statusCalculado === "Cancelado") {
      canceladoCentavos += conta.valorCentavos;
    } else {
      previstoCentavos += conta.valorCentavos;
      if (conta.statusCalculado === "Pago") pagoCentavos += conta.valorCentavos;
      else emAbertoCentavos += conta.valorCentavos;
    }
  }

  return {
    receitasCentavos,
    despesasCentavos,
    saldoMovimentoCentavos: receitasCentavos - despesasCentavos,
    saldoContasCentavos: contas.reduce((total, conta) => total + conta.saldoAtualCentavos, 0),
    transacoesSemConta,
    linhasIgnoradas,
    contas,
    contasPagar: contasPagarCalculadas,
    contasPagarResumo: {
      previstoCentavos,
      pagoCentavos,
      emAbertoCentavos,
      canceladoCentavos,
    },
  };
}
