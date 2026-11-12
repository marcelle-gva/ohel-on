import {
  AcessoError,
  respostaErroAcesso,
  resolverAcesso,
} from "@/lib/access-server";
import { obterPeriodoAtualSaoPaulo } from "@/lib/financeiro/resumoMensal";

export const runtime = "nodejs";
const TAMANHO_PAGINA = 1000;
type AcessoService = Awaited<ReturnType<typeof resolverAcesso>>["service"];

function proximoMes(periodo: string) {
  const [ano, mes] = periodo.split("-").map(Number);
  return new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
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

async function obterContasDoMes(service: AcessoService, igrejaId: string, inicio: string, fim: string) {
  const contas: { id: string; descricao: string; valor: number | string; data_vencimento: string; status: string }[] = [];
  for (let pagina = 0; ; pagina += 1) {
    const inicioPagina = pagina * TAMANHO_PAGINA;
    const { data, error } = await service
      .from("contas_pagar")
      .select("id, descricao, valor, data_vencimento, status")
      .eq("igreja_id", igrejaId)
      .gte("data_vencimento", inicio)
      .lt("data_vencimento", fim)
      .order("data_vencimento", { ascending: true })
      .order("id", { ascending: true })
      .range(inicioPagina, inicioPagina + TAMANHO_PAGINA - 1);
    if (error) throw new AcessoError("Não foi possível consultar as contas do mês.", 503);
    contas.push(...((data || []) as typeof contas));
    if (!data || data.length < TAMANHO_PAGINA) break;
  }
  return contas;
}

async function obterTransacoesDoMes(service: AcessoService, igrejaId: string, periodo: string) {
  const transacoes: { tipo: string; valor: number | string }[] = [];
  for (let pagina = 0; ; pagina += 1) {
    const inicioPagina = pagina * TAMANHO_PAGINA;
    const { data, error } = await service
      .from("transacoes")
      .select("tipo, valor")
      .eq("igreja_id", igrejaId)
      .eq("mes_referencia", periodo)
      .order("id", { ascending: true })
      .range(inicioPagina, inicioPagina + TAMANHO_PAGINA - 1);
    if (error) throw new AcessoError("Não foi possível consultar o movimento financeiro do mês.", 503);
    transacoes.push(...((data || []) as typeof transacoes));
    if (!data || data.length < TAMANHO_PAGINA) break;
  }
  return transacoes;
}

async function obterAnos(service: AcessoService, igrejaId: string) {
  const anos = new Set<string>([obterPeriodoAtualSaoPaulo().slice(0, 4)]);
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await service
      .from("contas_pagar")
      .select("data_vencimento")
      .eq("igreja_id", igrejaId)
      .not("data_vencimento", "is", null)
      .order("data_vencimento", { ascending: false })
      .range(inicio, inicio + TAMANHO_PAGINA - 1);
    if (error) throw new AcessoError("Não foi possível consultar o histórico financeiro.", 503);
    for (const linha of data || []) {
      const ano = linha.data_vencimento?.slice(0, 4);
      if (ano) anos.add(ano);
    }
    if (!data || data.length < TAMANHO_PAGINA) break;
  }
  return [...anos].sort((a, b) => Number(b) - Number(a));
}

export async function GET(request: Request) {
  try {
    const { service, contexto } = await resolverAcesso(request);
    if (contexto.role !== "admin") {
      throw new AcessoError("Este resumo financeiro está disponível somente para administradores.", 403);
    }

    const url = new URL(request.url);
    const periodoSolicitado = url.searchParams.get("periodo") || obterPeriodoAtualSaoPaulo();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodoSolicitado)) {
      throw new AcessoError("O período financeiro informado é inválido.", 400);
    }
    const [ano] = periodoSolicitado.split("-").map(Number);
    if (ano < 2000 || ano > 2100) {
      throw new AcessoError("O ano informado está fora do intervalo permitido.", 400);
    }
    const inicioMes = `${periodoSolicitado}-01`;
    const fimMes = proximoMes(periodoSolicitado);
    const hojeSaoPaulo = hojeEmSaoPaulo();

    const [contasRes, transacoes, anos] = await Promise.all([
      obterContasDoMes(service, contexto.igrejaId, inicioMes, fimMes),
      obterTransacoesDoMes(service, contexto.igrejaId, periodoSolicitado),
      obterAnos(service, contexto.igrejaId),
    ]);

    const contas = contasRes.map((conta) => ({
      ...conta,
      status: conta.status === "Pendente" && conta.data_vencimento < hojeSaoPaulo
        ? "Atrasado"
        : conta.status,
    }));
    const receitas = transacoes.filter((linha) => linha.tipo === "Receita").reduce((total, linha) => total + Number(linha.valor || 0), 0);
    const despesas = transacoes.filter((linha) => linha.tipo === "Despesa").reduce((total, linha) => total + Number(linha.valor || 0), 0);

    return Response.json(
      {
        periodo: periodoSolicitado,
        anos,
        contas,
        saldoMovimento: receitas - despesas,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return respostaErroAcesso(error);
  }
}
