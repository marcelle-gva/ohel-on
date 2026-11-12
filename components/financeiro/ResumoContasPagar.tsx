"use client";

import Link from "next/link";
import { BarChart3, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/currency";
import {
  calcularResumoMensal,
  MESES_DO_ANO,
  type ContaResumoMensal,
} from "@/lib/financeiro/resumoMensal";

export function ResumoContasPagar({
  contas,
  periodo,
  anos,
  onChangePeriodo,
  loading = false,
  compacto = false,
  error = "",
  titulo = "Visão mensal das contas",
}: {
  contas: ContaResumoMensal[];
  periodo: string;
  anos: string[];
  onChangePeriodo: (periodo: string) => void;
  loading?: boolean;
  compacto?: boolean;
  error?: string;
  titulo?: string;
}) {
  const [ano, mes] = periodo.split("-");
  const nomeMes = MESES_DO_ANO.find((item) => item.numero === mes)?.nome || "Mês";
  const resumo = calcularResumoMensal(contas, periodo);
  const contasExibidas = compacto ? resumo.contasDoMes.slice(0, 4) : resumo.contasDoMes;
  const formatarData = (data: string) => {
    const partes = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : data;
  };
  const corStatus = (status: string) => status === "Pago"
    ? "bg-green-500/10 text-green-500 border-green-500/20"
    : status === "Atrasado"
      ? "bg-red-500/10 text-red-500 border-red-500/20"
      : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
  const corBarra = (status: string) => status === "Pago"
    ? "bg-green-500"
    : status === "Atrasado"
      ? "bg-red-500"
      : "bg-yellow-400";

  return (
    <Card className="border-gray-800 bg-ohel-surface/70 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-white">
            <BarChart3 className="h-4 w-4 text-ohel-blue" /> {titulo}
          </h2>
          <p className="mt-1 text-[10px] text-gray-400">Valores agrupados pelo mês de vencimento, não pela data de pagamento.</p>
          <p className="mt-1 text-[11px] font-semibold text-ohel-blue">{mes} — {nomeMes} / {ano}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:max-w-xs">
          <label className="flex flex-col gap-1 text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            Mês
            <select value={mes} onChange={(event) => onChangePeriodo(`${ano}-${event.target.value}`)} aria-label="Selecionar mês do resumo financeiro" className="w-full rounded-md border border-gray-700 bg-ohel-bg px-2 py-2 text-xs normal-case text-white outline-none focus:border-ohel-blue">
              {MESES_DO_ANO.map((item) => <option key={item.numero} value={item.numero}>{item.numero} — {item.nome}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[9px] font-semibold uppercase tracking-wide text-gray-400">
            Ano
            <select value={ano} onChange={(event) => onChangePeriodo(`${event.target.value}-${mes}`)} aria-label="Selecionar ano do resumo financeiro" className="w-full rounded-md border border-gray-700 bg-ohel-bg px-2 py-2 text-xs normal-case text-white outline-none focus:border-ohel-blue">
              {anos.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-800 border-l-2 border-l-ohel-blue bg-ohel-bg/60 px-3 py-2"><p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Contas no mês</p><p className="mt-1 text-lg font-bold text-white">{loading || error ? "—" : resumo.quantidade}</p></div>
        <div className="rounded-lg border border-gray-800 border-l-2 border-l-blue-400 bg-ohel-bg/60 px-3 py-2"><p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Total previsto</p><p className="mt-1 text-lg font-bold text-ohel-blue">{loading || error ? "—" : formatCurrency(resumo.totalPrevisto)}</p></div>
        <div className="rounded-lg border border-gray-800 border-l-2 border-l-green-500 bg-ohel-bg/60 px-3 py-2"><p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Pago / em aberto</p><p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs"><span className="font-bold text-green-400">{loading || error ? "—" : `${formatCurrency(resumo.totalPago)} pago`}</span><span className="font-bold text-yellow-400">{loading || error ? "—" : `${formatCurrency(resumo.totalEmAberto)} em aberto`}</span></p></div>
      </div>

      {error ? <p role="alert" className="py-5 text-center text-xs text-red-400">{error}</p> : loading ? <p className="py-5 text-center text-xs text-gray-500">Carregando resumo financeiro...</p> : resumo.contasDoMes.length === 0 ? (
        <p className="py-5 text-center text-xs text-gray-500">Nenhuma conta com vencimento em {nomeMes} de {ano}.</p>
      ) : (
        <div className={`mt-3 grid grid-cols-1 gap-2 pr-1 ${compacto ? "max-h-56 overflow-y-auto" : "max-h-72 overflow-y-auto xl:grid-cols-2"}`} aria-label={`Contas a pagar em ${mes}/${ano}`}>
          {contasExibidas.map((conta) => {
            const valor = Number(conta.valor || 0);
            const percentual = resumo.maiorConta > 0 ? Math.max(4, Math.round(valor / resumo.maiorConta * 100)) : 0;
            return (
              <div key={conta.id} className="rounded-lg border border-gray-800/80 bg-ohel-bg/50 px-3 py-2">
                <div className="mb-1.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white">{conta.descricao}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2"><span className="text-[10px] text-gray-500">Vence {formatarData(conta.data_vencimento)}</span><span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase ${corStatus(conta.status)}`}>{conta.status}</span></div>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-white">{formatCurrency(valor)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-800" role="progressbar" aria-label={`Valor de ${conta.descricao} em relação à maior conta do mês`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual}><div className={`h-full rounded-full transition-[width] duration-300 ${corBarra(conta.status)}`} style={{ width: `${percentual}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}
      {compacto && resumo.contasDoMes.length > 4 && <p className="mt-2 text-center text-[10px] text-gray-500">Exibindo 4 de {resumo.contasDoMes.length} contas.</p>}
      <div className="mt-3 flex items-center justify-between border-t border-gray-800 pt-2.5 text-[9px] text-gray-400">
        <div className="flex flex-wrap gap-3"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-green-500" /> Pago</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-yellow-400" /> Pendente</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-500" /> Atrasado</span></div>
        <Link href="/financeiro/contas-pagar" className="inline-flex items-center gap-1 text-ohel-blue hover:text-white">Abrir contas <ArrowRight className="h-3 w-3" /></Link>
      </div>
    </Card>
  );
}
