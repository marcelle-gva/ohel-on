"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, HeartPulse, Loader2, Search, User } from "lucide-react";
import { useAccess } from "@/components/layout/AccessShell";
import { Card } from "@/components/ui/Card";
import { podeAcessar } from "@/lib/access";
import {
  listarTodosRegistrosEmocionais,
  mensagemPastoral,
  requisicaoAbortada,
  type PeriodoEmocional,
} from "@/components/pastoral/api";
import type { RegistroEmocionalEquipe } from "@/lib/pastoral-care";

const EMOCOES = [
  { nome: "Feliz", cor: "bg-green-500", texto: "text-green-500" },
  { nome: "Agradecido", cor: "bg-emerald-400", texto: "text-emerald-400" },
  { nome: "Acolhido", cor: "bg-teal-400", texto: "text-teal-400" },
  { nome: "Ansioso", cor: "bg-yellow-500", texto: "text-yellow-500" },
  { nome: "Desanimado", cor: "bg-orange-500", texto: "text-orange-500" },
  { nome: "Fragilizado", cor: "bg-orange-600", texto: "text-orange-600" },
  { nome: "Doente", cor: "bg-red-500", texto: "text-red-500" },
  { nome: "Sem Amigos", cor: "bg-purple-600", texto: "text-purple-600" },
  { nome: "Sem Esperança", cor: "bg-red-700", texto: "text-red-700" },
] as const;

function formatarData(data: string) {
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EmocionalPage() {
  const contexto = useAccess();
  const podeLer = Boolean(contexto && podeAcessar(contexto, "gabinete", "ler"));
  const [registros, setRegistros] = useState<RegistroEmocionalEquipe[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodoEmocional>("mes");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  const carregar = useCallback(async (periodo: PeriodoEmocional) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setErro("");
    try {
      const dados = await listarTodosRegistrosEmocionais(periodo, controller.signal);
      if (!controller.signal.aborted) setRegistros(dados);
    } catch (error) {
      if (requisicaoAbortada(error) || controller.signal.aborted) return;
      setErro(mensagemPastoral(error, "Não foi possível carregar os registros emocionais. Tente novamente."));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!podeLer) return;
    const timer = window.setTimeout(() => void carregar(filtroPeriodo), 0);
    return () => {
      window.clearTimeout(timer);
      controllerRef.current?.abort();
    };
  }, [carregar, filtroPeriodo, podeLer, tentativa]);

  const registrosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase();
    return registros.filter((registro) => {
      const nome = registro.membros?.nome || "";
      return !termo || nome.toLocaleLowerCase().includes(termo) || registro.emoji.toLocaleLowerCase().includes(termo);
    });
  }, [busca, registros]);

  const totalRegistros = registrosFiltrados.length;
  const contagemPorEmocao = EMOCOES.map((emocao) => {
    const count = registrosFiltrados.filter((registro) => registro.emoji === emocao.nome).length;
    return {
      ...emocao,
      count,
      porcentagem: totalRegistros > 0 ? (count / totalRegistros) * 100 : 0,
    };
  }).sort((a, b) => b.count - a.count);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 pb-10">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <Link href="/gabinete" aria-label="Voltar ao gabinete" className="text-gray-400 transition-colors hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-white"><HeartPulse className="h-5 w-5 text-pink-500" /> Acompanhamento Emocional</h1>
            <p className="mt-0.5 text-xs text-gray-400">Monitore como os membros estão se sentindo para oferecer acolhimento.</p>
          </div>
        </div>
      </div>

      {erro && <div role="alert" className="flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between"><span>{erro}</span><button type="button" onClick={() => setTentativa((valor) => valor + 1)} className="shrink-0 rounded-md border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-500/20">Tentar novamente</button></div>}

      <Card className="flex flex-col items-center gap-3 border-gray-800 bg-ohel-surface/50 p-3 lg:flex-row">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
          <input type="search" aria-label="Buscar registros emocionais" placeholder="Buscar por nome ou emoção..." value={busca} onChange={(event) => setBusca(event.currentTarget.value)} className="w-full rounded-md border border-gray-700 bg-ohel-bg py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-ohel-blue" />
        </div>
        <div className="flex w-full rounded-md border border-gray-700 bg-ohel-bg p-1 lg:w-auto">
          {(["semana", "mes", "ano", "total"] as PeriodoEmocional[]).map((periodo) => <button key={periodo} type="button" onClick={() => setFiltroPeriodo(periodo)} className={`flex-1 rounded px-4 py-1.5 text-xs font-bold capitalize transition-colors lg:flex-none ${filtroPeriodo === periodo ? "bg-ohel-blue text-white" : "text-gray-400 hover:text-white"}`}>{periodo === "mes" ? "Mês" : periodo === "semana" ? "Semana" : periodo === "ano" ? "Ano" : "Tudo"}</button>)}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="flex flex-col border-gray-800 bg-ohel-surface p-5 lg:col-span-1">
          <h3 className="mb-4 border-b border-gray-800 pb-2 text-sm font-bold text-white">Visão Geral (Porcentagem)</h3>
          <div className="flex flex-1 flex-col justify-center gap-4">
            {loading ? <div role="status" className="flex items-center justify-center gap-2 py-8 text-xs text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando registros...</div> : erro ? <p className="py-8 text-center text-xs text-gray-500">O gráfico ficará disponível quando o carregamento for concluído.</p> : totalRegistros === 0 ? <p className="py-4 text-center text-xs text-gray-500">Nenhum registro neste período.</p> : contagemPorEmocao.map((emocao) => <div key={emocao.nome}><div className="mb-1 flex items-center justify-between text-xs"><span className="font-medium text-gray-300">{emocao.nome}</span><span className={`font-bold ${emocao.texto}`}>{emocao.count} ({emocao.porcentagem.toFixed(0)}%)</span></div><div className="h-2 w-full rounded-full bg-ohel-bg"><div className={`h-2 rounded-full ${emocao.cor}`} style={{ width: `${emocao.porcentagem}%` }} /></div></div>)}
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden border-gray-800 bg-ohel-surface p-0 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-800 p-4"><h3 className="text-sm font-bold text-white">Registros Recentes</h3><span className="rounded border border-pink-500/20 bg-pink-500/10 px-2 py-1 text-[10px] font-bold text-pink-500">{loading || erro ? "—" : `${totalRegistros} registros`}</span></div>
          <div className="max-h-[600px] flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-gray-800 bg-[#05080f] text-[9px] uppercase tracking-wider text-gray-400"><tr><th className="p-3 font-medium">Data</th><th className="p-3 font-medium">Pessoa</th><th className="p-3 font-medium">Emoção</th><th className="p-3 font-medium">Observação</th></tr></thead>
              <tbody className="divide-y divide-gray-800/30">
                {loading ? <tr><td colSpan={4} className="p-8 text-center text-gray-400"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando registros...</span></td></tr> : erro ? <tr><td colSpan={4} className="p-8 text-center text-gray-500">A lista não está disponível até que o carregamento seja concluído.</td></tr> : registrosFiltrados.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-gray-400">Nenhum registro encontrado.</td></tr> : registrosFiltrados.map((registro) => <tr key={registro.id} className="transition-colors hover:bg-white/[0.02]"><td className="p-3 text-gray-400">{formatarData(registro.created_at)}</td><td className="flex items-center gap-2 p-3 font-medium text-white"><User className="h-3.5 w-3.5 text-ohel-blue" /> {registro.membros?.nome || "Não informado"}</td><td className="p-3"><span className={`inline-flex rounded border border-gray-700 bg-ohel-bg px-2 py-0.5 text-[10px] font-bold ${EMOCOES.find((emocao) => emocao.nome === registro.emoji)?.texto || "text-white"}`}>{registro.emoji}</span></td><td className="max-w-[200px] truncate p-3 text-gray-300" title={registro.observacao || undefined}>{registro.observacao || "-"}</td></tr>)}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
