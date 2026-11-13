import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { obterPeriodoAtualSaoPaulo } from "@/lib/financeiro/resumoMensal";
import {
  calcularIndicadoresFinanceiros,
  type CaixaParaCalculo,
  type ContaPagarParaCalculo,
  type TransacaoParaCalculo,
} from "@/lib/financeiro/calculos";
import {
  normalizarCentavos,
  valorPositivoEmCentavos,
} from "@/lib/financeiro/dinheiro";

const TAMANHO_PAGINA = 500;

type FinanceService = SupabaseClient;

type CaixaRow = {
  id: string;
  nome: string;
  tipo: string;
  saldo_inicial: unknown;
};

type TransacaoRow = {
  id: string;
  tipo: string;
  data: string;
  mes_referencia: string;
  valor: unknown;
  caixa_id: string | null;
  categoria_id: string | null;
  congregacao_id: string | null;
  membro_id: string | null;
  origem_nome_manual: string | null;
  descricao: string | null;
};

type ContaPagarRow = {
  id: string;
  descricao: string;
  valor: unknown;
  data_vencimento: string;
  status: string;
};

type NomeRow = { id: string; nome: string };

export class FinanceiroConsultaError extends Error {
  constructor() {
    super("Não foi possível consultar os dados financeiros da igreja.");
  }
}

function erroConsulta() {
  throw new FinanceiroConsultaError();
}

async function carregarCaixas(service: FinanceService, igrejaId: string): Promise<CaixaRow[]> {
  const resultado: CaixaRow[] = [];
  for (let offset = 0; ; offset += TAMANHO_PAGINA) {
    const { data, error } = await service
      .from("caixas")
      .select("id, nome, tipo, saldo_inicial")
      .eq("igreja_id", igrejaId)
      .order("nome", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + TAMANHO_PAGINA - 1);
    if (error) erroConsulta();
    const pagina = (data || []) as CaixaRow[];
    resultado.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) return resultado;
  }
}

async function carregarTransacoes(service: FinanceService, igrejaId: string): Promise<TransacaoRow[]> {
  const resultado: TransacaoRow[] = [];
  for (let offset = 0; ; offset += TAMANHO_PAGINA) {
    const { data, error } = await service
      .from("transacoes")
      .select("id, tipo, data, mes_referencia, valor, caixa_id, categoria_id, congregacao_id, membro_id, origem_nome_manual, descricao")
      .eq("igreja_id", igrejaId)
      .order("data", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + TAMANHO_PAGINA - 1);
    if (error) erroConsulta();
    const pagina = (data || []) as TransacaoRow[];
    resultado.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) return resultado;
  }
}

async function carregarContasPagar(
  service: FinanceService,
  igrejaId: string,
  periodo: string,
): Promise<ContaPagarRow[]> {
  const [ano, mes] = periodo.split("-").map(Number);
  const inicio = `${periodo}-01`;
  const fim = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
  const resultado: ContaPagarRow[] = [];
  for (let offset = 0; ; offset += TAMANHO_PAGINA) {
    const { data, error } = await service
      .from("contas_pagar")
      .select("id, descricao, valor, data_vencimento, status")
      .eq("igreja_id", igrejaId)
      .gte("data_vencimento", inicio)
      .lt("data_vencimento", fim)
      .order("data_vencimento", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + TAMANHO_PAGINA - 1);
    if (error) erroConsulta();
    const pagina = (data || []) as ContaPagarRow[];
    resultado.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) return resultado;
  }
}

async function carregarNomes(
  service: FinanceService,
  tabela: "categorias_financeiras" | "congregacoes" | "membros",
  igrejaId: string,
): Promise<NomeRow[]> {
  const resultado: NomeRow[] = [];
  for (let offset = 0; ; offset += TAMANHO_PAGINA) {
    const { data, error } = await service
      .from(tabela)
      .select("id, nome")
      .eq("igreja_id", igrejaId)
      .order("nome", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + TAMANHO_PAGINA - 1);
    if (error) erroConsulta();
    const pagina = (data || []) as NomeRow[];
    resultado.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) return resultado;
  }
}

function hojeEmSaoPaulo() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value || "00";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

export interface ResumoFinanceiroApi {
  periodo: string;
  anos: string[];
  receitasCentavos: number;
  despesasCentavos: number;
  saldoMovimentoCentavos: number;
  saldoContasCentavos: number;
  transacoesSemConta: number;
  linhasIgnoradas: number;
  contas: Array<{
    id: string;
    nome: string;
    tipo: string;
    saldoInicialCentavos: number;
    movimentoCentavos: number;
    saldoAtualCentavos: number;
  }>;
  contasPagar: Array<{
    id: string;
    descricao: string;
    valorCentavos: number;
    data_vencimento: string;
    status: string;
  }>;
  contasPagarResumo: {
    previstoCentavos: number;
    pagoCentavos: number;
    emAbertoCentavos: number;
    canceladoCentavos: number;
  };
  movimentacoes: Array<{
    id: string;
    tipo: string;
    data: string;
    mesReferencia: string;
    valorCentavos: number;
    caixaId: string | null;
    caixaNome: string | null;
    categoriaNome: string | null;
    congregacaoNome: string | null;
    origemNome: string | null;
    descricao: string | null;
  }>;
}

export async function obterResumoFinanceiro(
  service: FinanceService,
  igrejaId: string,
  periodo = obterPeriodoAtualSaoPaulo(),
  incluirMovimentacoes = false,
): Promise<ResumoFinanceiroApi> {
  const [caixasRows, transacoesRows, contasPagarRows] = await Promise.all([
    carregarCaixas(service, igrejaId),
    carregarTransacoes(service, igrejaId),
    carregarContasPagar(service, igrejaId, periodo),
  ]);

  const caixas: CaixaParaCalculo[] = caixasRows.map((caixa) => ({
    id: caixa.id,
    nome: caixa.nome,
    tipo: caixa.tipo,
    saldoInicialCentavos: normalizarCentavos(caixa.saldo_inicial),
  }));
  const transacoes: TransacaoParaCalculo[] = transacoesRows.map((transacao) => ({
    id: transacao.id,
    tipo: transacao.tipo,
    mesReferencia: transacao.mes_referencia,
    valorCentavos: valorPositivoEmCentavos(transacao.valor),
    caixaId: transacao.caixa_id,
  }));
  const contasPagar: ContaPagarParaCalculo[] = contasPagarRows.map((conta) => ({
    id: conta.id,
    descricao: conta.descricao,
    dataVencimento: conta.data_vencimento,
    status: conta.status,
    valorCentavos: valorPositivoEmCentavos(conta.valor),
  }));

  const indicadores = calcularIndicadoresFinanceiros({
    periodo,
    hojeSaoPaulo: hojeEmSaoPaulo(),
    caixas,
    transacoes,
    contasPagar,
  });

  const caixaPorId = new Map(caixasRows.map((caixa) => [caixa.id, caixa.nome]));
  let categoriasPorId = new Map<string, string>();
  let congregacoesPorId = new Map<string, string>();
  let membrosPorId = new Map<string, string>();

  if (incluirMovimentacoes) {
    const [categorias, congregacoes, membros] = await Promise.all([
      carregarNomes(service, "categorias_financeiras", igrejaId),
      carregarNomes(service, "congregacoes", igrejaId),
      carregarNomes(service, "membros", igrejaId),
    ]);
    categoriasPorId = new Map(categorias.map((item) => [item.id, item.nome]));
    congregacoesPorId = new Map(congregacoes.map((item) => [item.id, item.nome]));
    membrosPorId = new Map(membros.map((item) => [item.id, item.nome]));
  }

  const movimentacoes = incluirMovimentacoes
    ? transacoesRows
        .filter(
          (transacao) =>
            transacao.mes_referencia === periodo &&
            (transacao.tipo === "Receita" || transacao.tipo === "Despesa"),
        )
        .map((transacao) => ({
          id: transacao.id,
          tipo: transacao.tipo,
          data: transacao.data,
          mesReferencia: transacao.mes_referencia,
          valorCentavos: valorPositivoEmCentavos(transacao.valor),
          caixaId: transacao.caixa_id,
          caixaNome: transacao.caixa_id ? caixaPorId.get(transacao.caixa_id) || null : null,
          categoriaNome: transacao.categoria_id ? categoriasPorId.get(transacao.categoria_id) || null : null,
          congregacaoNome: transacao.congregacao_id ? congregacoesPorId.get(transacao.congregacao_id) || null : null,
          origemNome: transacao.membro_id
            ? membrosPorId.get(transacao.membro_id) || null
            : transacao.origem_nome_manual || null,
          descricao: transacao.descricao,
        }))
    : [];

  return {
    periodo,
    anos: [...new Set([obterPeriodoAtualSaoPaulo().slice(0, 4), periodo.slice(0, 4), ...transacoesRows.map((linha) => linha.mes_referencia?.slice(0, 4)).filter((ano): ano is string => Boolean(ano && /^\d{4}$/.test(ano)))])].sort((a, b) => b.localeCompare(a)),
    receitasCentavos: indicadores.receitasCentavos,
    despesasCentavos: indicadores.despesasCentavos,
    saldoMovimentoCentavos: indicadores.saldoMovimentoCentavos,
    saldoContasCentavos: indicadores.saldoContasCentavos,
    transacoesSemConta: indicadores.transacoesSemConta,
    linhasIgnoradas: indicadores.linhasIgnoradas,
    contas: indicadores.contas.map((conta) => ({
      id: conta.id,
      nome: conta.nome,
      tipo: conta.tipo,
      saldoInicialCentavos: conta.saldoInicialCentavos,
      movimentoCentavos: conta.movimentoCentavos,
      saldoAtualCentavos: conta.saldoAtualCentavos,
    })),
    contasPagar: indicadores.contasPagar.map((conta) => ({
      id: conta.id,
      descricao: conta.descricao,
      valorCentavos: conta.valorCentavos,
      data_vencimento: conta.dataVencimento,
      status: conta.statusCalculado,
    })),
    contasPagarResumo: indicadores.contasPagarResumo,
    movimentacoes,
  };
}
