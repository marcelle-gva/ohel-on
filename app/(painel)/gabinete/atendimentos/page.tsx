"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, CheckCircle2, Clock, Loader2, Plus, RefreshCw, Search, User } from "lucide-react";
import { useAccess } from "@/components/layout/AccessShell";
import { Card } from "@/components/ui/Card";
import { podeAcessar } from "@/lib/access";
import {
  aguardandoConfirmacao,
  rotuloAtendimento,
  type AtendimentoEquipe,
} from "@/lib/pastoral-care";
import {
  listarTodosAtendimentos,
  mensagemPastoral,
  requisicaoAbortada,
} from "@/components/pastoral/api";

function formatarData(data: string) {
  return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR");
}

function classeStatus(atendimento: AtendimentoEquipe) {
  if (atendimento.status === "Realizado") return "bg-green-500/10 text-green-500 border-green-500/20";
  if (atendimento.status === "Cancelado") return "bg-red-500/10 text-red-500 border-red-500/20";
  return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
}

export default function AtendimentosPage() {
  const contexto = useAccess();
  const podeLer = Boolean(contexto && podeAcessar(contexto, "gabinete", "ler"));
  const podeCriar = Boolean(contexto && podeAcessar(contexto, "gabinete", "criar"));
  const podeEditar = Boolean(contexto && podeAcessar(contexto, "gabinete", "editar"));
  const [atendimentos, setAtendimentos] = useState<AtendimentoEquipe[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const requestId = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const currentRequest = ++requestId.current;
    if (silencioso) setAtualizando(true);
    else setLoading(true);
    setErro("");
    try {
      const dados = await listarTodosAtendimentos(controller.signal);
      if (currentRequest !== requestId.current) return;
      setAtendimentos(dados);
    } catch (error) {
      if (requisicaoAbortada(error) || currentRequest !== requestId.current) return;
      setErro(mensagemPastoral(error, "Não foi possível carregar os atendimentos. Tente novamente."));
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setAtualizando(false);
        controllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!podeLer) return;
    const timer = window.setTimeout(() => void carregar(), 0);
    return () => {
      window.clearTimeout(timer);
      controllerRef.current?.abort();
      requestId.current += 1;
    };
  }, [carregar, podeLer, tentativa]);

  useEffect(() => {
    const atualizarAoVoltar = () => {
      if (!document.hidden) void carregar(true);
    };
    const interval = window.setInterval(atualizarAoVoltar, 30000);
    window.addEventListener("focus", atualizarAoVoltar);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", atualizarAoVoltar);
    };
  }, [carregar]);

  const hoje = new Date().toISOString().slice(0, 10);
  const agendados = atendimentos.filter((atendimento) => atendimento.status === "Agendado").length;
  const realizados = atendimentos.filter((atendimento) => atendimento.status === "Realizado").length;
  const doDia = atendimentos.filter((atendimento) => atendimento.data_atendimento === hoje && atendimento.status === "Agendado").length;

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase();
    return atendimentos.filter((atendimento) => {
      const pessoa = atendimento.membros?.nome || atendimento.nome_visitante || "";
      const texto = `${pessoa} ${atendimento.pastor_responsavel || ""} ${atendimento.tipo || ""}`.toLocaleLowerCase();
      const correspondeBusca = !termo || texto.includes(termo);
      const correspondeStatus = filtroStatus === "todos"
        || (filtroStatus === "aguardando" ? aguardandoConfirmacao(atendimento) : atendimento.status === filtroStatus);
      return correspondeBusca && correspondeStatus;
    });
  }, [atendimentos, busca, filtroStatus]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 pb-10">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <Link href="/gabinete" aria-label="Voltar ao gabinete" className="text-gray-400 transition-colors hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-white"><Calendar className="h-5 w-5 text-ohel-blue" /> Atendimentos Pastorais</h1>
            <p className="mt-0.5 text-xs text-gray-400">Gerencie os aconselhamentos, orações e visitas pastorais.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void carregar(true)} disabled={loading || atualizando} className="inline-flex items-center gap-2 rounded-md border border-gray-700 px-3 py-2 text-xs font-medium text-gray-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${atualizando ? "animate-spin" : ""}`} /> Atualizar
          </button>
          {podeCriar && <Link href="/gabinete/atendimentos/novo" className="inline-flex items-center gap-2 rounded-md bg-ohel-blue px-5 py-2 text-xs font-medium text-white shadow-[0_0_15px_rgba(0,123,255,0.2)] transition-colors hover:bg-blue-600"><Plus className="h-3.5 w-3.5" /> Novo Atendimento</Link>}
        </div>
      </div>

      {erro && <div role="alert" className="flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between"><span>{erro}</span><button type="button" onClick={() => setTentativa((valor) => valor + 1)} className="shrink-0 rounded-md border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-500/20">Tentar novamente</button></div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="flex flex-col justify-between border-l-4 border-l-yellow-500 bg-ohel-surface p-4">
          <div className="mb-2 flex items-start justify-between"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Agendados</p><Clock className="h-4 w-4 text-yellow-500" /></div>
          <h2 className="text-2xl font-bold text-yellow-500">{loading || erro ? "—" : agendados}</h2>
        </Card>
        <Card className="flex flex-col justify-between border-l-4 border-l-green-500 bg-ohel-surface p-4">
          <div className="mb-2 flex items-start justify-between"><p className="text-[10px] font-bold uppercase tracking-wider text-green-400">Realizados</p><CheckCircle2 className="h-4 w-4 text-green-500" /></div>
          <h2 className="text-2xl font-bold text-green-500">{loading || erro ? "—" : realizados}</h2>
        </Card>
        <Card className="flex flex-col justify-between border-l-4 border-l-ohel-blue bg-ohel-surface p-4">
          <div className="mb-2 flex items-start justify-between"><p className="text-[10px] font-bold uppercase tracking-wider text-ohel-blue">Atendimentos Hoje</p><Calendar className="h-4 w-4 text-ohel-blue" /></div>
          <h2 className="text-2xl font-bold text-white">{loading || erro ? "—" : doDia}</h2>
        </Card>
      </div>

      <Card className="flex flex-col items-center gap-3 border-gray-800 bg-ohel-surface/50 p-3 lg:flex-row">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
          <input type="search" aria-label="Buscar atendimentos" placeholder="Buscar por pessoa, pastor ou tipo..." value={busca} onChange={(event) => setBusca(event.currentTarget.value)} className="w-full rounded-md border border-gray-700 bg-ohel-bg py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-ohel-blue" />
        </div>
        <select aria-label="Filtrar por status" value={filtroStatus} onChange={(event) => setFiltroStatus(event.currentTarget.value)} className="w-full rounded-md border border-gray-700 bg-ohel-bg px-3 py-2 text-xs text-white outline-none lg:w-52">
          <option value="todos">Todos os Status</option>
          <option value="aguardando">Aguardando confirmação</option>
          <option value="Agendado">Agendados</option>
          <option value="Realizado">Realizados</option>
          <option value="Cancelado">Cancelados</option>
        </select>
      </Card>

      <Card className="overflow-hidden border-gray-800 p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-gray-800 bg-[#05080f] text-[9px] uppercase tracking-wider text-gray-400"><tr><th className="p-3 font-medium">Data / Hora</th><th className="p-3 font-medium">Pessoa Atendida</th><th className="p-3 font-medium">Pastor</th><th className="p-3 font-medium">Tipo</th><th className="p-3 font-medium">Status</th><th className="p-3 text-center font-medium">Ações</th></tr></thead>
            <tbody className="divide-y divide-gray-800/30">
              {loading ? <tr><td colSpan={6} className="p-8 text-center text-gray-400"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando atendimentos...</span></td></tr> : erro ? <tr><td colSpan={6} className="p-8 text-center text-gray-500">A lista não está disponível até que o carregamento seja concluído.</td></tr> : filtrados.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhum atendimento encontrado.</td></tr> : filtrados.map((atendimento) => {
                const pessoa = atendimento.membros?.nome || atendimento.nome_visitante || "Não informado";
                return <tr key={atendimento.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="p-3"><p className="font-bold text-white">{formatarData(atendimento.data_atendimento)}</p><p className="text-[10px] text-gray-500">{atendimento.hora_atendimento || "Horário não definido"}</p></td>
                  <td className="flex items-center gap-2 p-3 font-medium text-white"><User className="h-3.5 w-3.5 text-ohel-blue" /> {pessoa}</td>
                  <td className="p-3 text-gray-300">{atendimento.pastor_responsavel || "Não informado"}</td>
                  <td className="p-3 text-gray-400">{atendimento.tipo || "Não informado"}</td>
                  <td className="p-3"><span className={`inline-flex rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${classeStatus(atendimento)}`}>{rotuloAtendimento(atendimento)}</span></td>
                  <td className="p-3 text-center">{podeEditar ? <Link href={`/gabinete/atendimentos/editar/${atendimento.id}`} className="font-medium text-[11px] text-ohel-blue hover:text-blue-400">Ver / Editar</Link> : <span className="text-[11px] text-gray-600">Somente leitura</span>}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {atualizando && <p role="status" className="flex items-center justify-end gap-2 text-[10px] text-gray-500"><Loader2 className="h-3 w-3 animate-spin" /> Atualizando dados...</p>}
    </div>
  );
}
