import {
  AcessoError,
  respostaErroAcesso,
  resolverAcesso,
} from "@/lib/access-server";
import { podeAcessar } from "@/lib/access";
import {
  FinanceiroConsultaError,
  obterResumoFinanceiro,
} from "@/lib/financeiro/resumoFinanceiro";
import { obterPeriodoAtualSaoPaulo } from "@/lib/financeiro/resumoMensal";

export const runtime = "nodejs";

const PERIODO_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

function validarPeriodo(valor: string) {
  if (!PERIODO_PATTERN.test(valor)) {
    throw new AcessoError("O período financeiro informado é inválido.", 400);
  }
  const ano = Number(valor.slice(0, 4));
  if (ano < 2000 || ano > 2100) {
    throw new AcessoError("O ano informado está fora do intervalo permitido.", 400);
  }
  return valor;
}

export async function GET(request: Request) {
  try {
    const { service, contexto } = await resolverAcesso(request);
    if (!podeAcessar(contexto, "financeiro", "ler")) {
      throw new AcessoError("Você não possui permissão para consultar o financeiro desta igreja.", 403);
    }

    const url = new URL(request.url);
    const periodo = validarPeriodo(
      url.searchParams.get("periodo") || obterPeriodoAtualSaoPaulo(),
    );
    const modo = url.searchParams.get("modo") || "resumo";
    if (modo !== "resumo" && modo !== "movimento") {
      throw new AcessoError("Modo de consulta financeira inválido.", 400);
    }
    const caixaId = url.searchParams.get("caixaId");
    if (caixaId && !UUID_PATTERN.test(caixaId)) {
      throw new AcessoError("Conta financeira inválida.", 400);
    }

    const resumo = await obterResumoFinanceiro(
      service,
      contexto.igrejaId,
      periodo,
      modo === "movimento",
    );
    const filtrado = caixaId
      ? {
          ...resumo,
          movimentacoes: resumo.movimentacoes.filter((item) => item.caixaId === caixaId),
        }
      : resumo;

    return Response.json(
      filtrado,
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof FinanceiroConsultaError) {
      return respostaErroAcesso(new AcessoError(error.message, 503));
    }
    return respostaErroAcesso(error);
  }
}
