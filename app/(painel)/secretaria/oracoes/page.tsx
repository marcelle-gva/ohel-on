"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  criarSequenciadorConsultas,
  excluirOracao,
  isIgrejaValida,
  listarOracoes,
  obterIgrejaDaSessao,
  type PedidoOracao,
} from "@/lib/oracoes-client";
import { Card } from "@/components/ui/Card";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  HeartHandshake,
  EyeOff,
  Eye,
  CheckCircle,
  XCircle,
} from "lucide-react";

function mensagemDoErro(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export default function OracoesPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<PedidoOracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const [pedidoToDelete, setPedidoToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const igrejaRef = useRef<string | null>(null);
  const sequenciadorRef = useRef(criarSequenciadorConsultas());
  const montadoRef = useRef(false);
  const deletingRef = useRef<string | null>(null);
  const statusUpdatingRef = useRef<string | null>(null);

  useEffect(() => {
    let ativo = true;
    const sequenciador = sequenciadorRef.current;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let interval: number | null = null;
    let refreshTimeout: number | null = null;
    montadoRef.current = true;

    const limparRealtime = () => {
      if (interval !== null) {
        window.clearInterval(interval);
        interval = null;
      }
      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };

    const limparSessao = () => {
      igrejaRef.current = null;
      sequenciadorRef.current.invalidar();
      limparRealtime();
      setPedidos([]);
      setLoading(false);
      setLoadError("Sessão encerrada. Entre novamente para carregar os pedidos.");
      setPedidoToDelete(null);
      setDeleteError(null);
      setIsDeleting(false);
      setStatusUpdatingId(null);
      setStatusError(null);
      deletingRef.current = null;
      statusUpdatingRef.current = null;
    };

    const carregarPedidos = async (igrejaId: string, mostrarLoading = false) => {
      if (!isIgrejaValida(igrejaId) || igrejaRef.current !== igrejaId) return;

      const token = sequenciadorRef.current.proxima();
      if (mostrarLoading) setLoading(true);
      try {
        const data = await listarOracoes(supabase, igrejaId);
        if (!ativo || !sequenciadorRef.current.vigente(token) || igrejaRef.current !== igrejaId) return;
        setPedidos(data);
        setLoadError(null);
      } catch (error) {
        if (!ativo || !sequenciadorRef.current.vigente(token) || igrejaRef.current !== igrejaId) return;
        setLoadError(mensagemDoErro(error, "Não foi possível consultar os pedidos de oração."));
      } finally {
        if (ativo && sequenciadorRef.current.vigente(token) && igrejaRef.current === igrejaId) {
          setLoading(false);
        }
      }
    };

    const agendarAtualizacao = () => {
      const igrejaId = igrejaRef.current;
      if (!ativo || !igrejaId || document.hidden) return;
      if (refreshTimeout !== null) window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(() => {
        refreshTimeout = null;
        if (igrejaRef.current) void carregarPedidos(igrejaRef.current);
      }, 200);
    };

    const atualizarSeVisivel = () => {
      if (igrejaRef.current && !document.hidden) void carregarPedidos(igrejaRef.current);
    };

    const iniciar = async () => {
      const token = sequenciadorRef.current.proxima();
      igrejaRef.current = null;
      limparRealtime();
      setPedidos([]);
      setLoadError(null);
      setLoading(true);

      try {
        const igrejaId = await obterIgrejaDaSessao(supabase);
        if (!ativo || !sequenciadorRef.current.vigente(token)) return;
        if (!igrejaId) {
          setLoading(false);
          setLoadError("Igreja não identificada para a sessão atual.");
          return;
        }

        igrejaRef.current = igrejaId;
        channel = supabase
          .channel(`secretaria-oracoes-${igrejaId}-${Date.now()}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "pedidos_oracao",
              filter: `igreja_id=eq.${igrejaId}`,
            },
            agendarAtualizacao,
          )
          .subscribe();
        interval = window.setInterval(atualizarSeVisivel, 30000);
        document.addEventListener("visibilitychange", atualizarSeVisivel);
        await carregarPedidos(igrejaId, true);
      } catch (error) {
        if (!ativo || !sequenciadorRef.current.vigente(token)) return;
        setLoading(false);
        setLoadError(mensagemDoErro(error, "Não foi possível carregar os pedidos de oração."));
      }
    };

    const { data: authState } = supabase.auth.onAuthStateChange((event, session) => {
      if (!ativo) return;
      if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && !session)) {
        limparSessao();
      } else if (event === "SIGNED_IN" && session) {
        void iniciar();
      }
    });

    void iniciar();

    return () => {
      ativo = false;
      montadoRef.current = false;
      sequenciador.invalidar();
      limparRealtime();
      document.removeEventListener("visibilitychange", atualizarSeVisivel);
      authState.subscription.unsubscribe();
    };
  }, []);

  const handleDelete = async () => {
    const id = pedidoToDelete;
    const igrejaInicial = igrejaRef.current;
    if (!id || !igrejaInicial || isDeleting || deletingRef.current) return;

    deletingRef.current = id;
    setIsDeleting(true);
    setDeleteError(null);
    // Cancela respostas de consultas antigas; a lista só muda após uma releitura confirmada.
    sequenciadorRef.current.invalidar();

    try {
      const igrejaAtual = await obterIgrejaDaSessao(supabase);
      if (!montadoRef.current || igrejaAtual !== igrejaInicial || igrejaRef.current !== igrejaInicial) {
        throw new Error("A sessão ou a igreja mudou. Recarregue a página e tente novamente.");
      }

      const resultado = await excluirOracao(supabase, igrejaAtual, id);
      if (!resultado.confirmado) {
        setDeleteError("O pedido não foi excluído. Ele pode não existir mais ou sua permissão pode ter mudado.");
        return;
      }

      if (!montadoRef.current || igrejaRef.current !== igrejaAtual) return;
      setPedidoToDelete(null);
      setDeleteError(null);
      // Exclusão confirmada: nunca reapresentar a linha por falha no refresh.
      const token = sequenciadorRef.current.proxima();
      setPedidos((atuais) => atuais.filter((pedido) => pedido.id !== id));
      try {
        const dadosAtuais = await listarOracoes(supabase, igrejaAtual);
        if (montadoRef.current && sequenciadorRef.current.vigente(token) && igrejaRef.current === igrejaAtual) {
          setPedidos(dadosAtuais);
          setLoadError(null);
        }
      } catch (error) {
        if (montadoRef.current && sequenciadorRef.current.vigente(token)) {
          setLoadError(mensagemDoErro(error, "Pedido excluído, mas não foi possível atualizar a lista."));
        }
      }
    } catch (error) {
      if (montadoRef.current && igrejaRef.current === igrejaInicial) {
        setDeleteError(mensagemDoErro(error, "Não foi possível excluir o pedido."));
      }
    } finally {
      deletingRef.current = null;
      if (montadoRef.current) setIsDeleting(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const igrejaInicial = igrejaRef.current;
    if (!igrejaInicial || statusUpdatingRef.current) return;

    statusUpdatingRef.current = id;
    setStatusUpdatingId(id);
    setStatusError(null);
    sequenciadorRef.current.invalidar();

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Sessão expirada. Entre novamente para alterar o status.");
      }
      const igrejaAtual = await obterIgrejaDaSessao(supabase);
      if (!igrejaAtual || igrejaAtual !== igrejaInicial || igrejaRef.current !== igrejaInicial) {
        throw new Error("A sessão ou a igreja mudou. Recarregue a página e tente novamente.");
      }

      const response = await fetch("/api/oracoes/status", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, status }),
      });
      const result = (await response.json()) as { error?: string; pedido?: { id: string } };
      if (!response.ok || !result.pedido) throw new Error(result.error || "Não foi possível alterar o status do pedido.");

      if (montadoRef.current && igrejaRef.current === igrejaAtual) {
        const token = sequenciadorRef.current.proxima();
        try {
          const dadosAtuais = await listarOracoes(supabase, igrejaAtual);
          if (sequenciadorRef.current.vigente(token) && igrejaRef.current === igrejaAtual) {
            setPedidos(dadosAtuais);
            setLoadError(null);
          }
        } catch (error) {
          setLoadError(mensagemDoErro(error, "Status alterado, mas não foi possível atualizar a lista."));
        }
      }
    } catch (error) {
      if (montadoRef.current && igrejaRef.current === igrejaInicial) {
        setStatusError(mensagemDoErro(error, "Não foi possível alterar o status do pedido."));
      }
    } finally {
      statusUpdatingRef.current = null;
      if (montadoRef.current) setStatusUpdatingId(null);
    }
  };

  const formatarData = (data: string) => new Date(data).toLocaleDateString("pt-BR", { timeZone: "UTC" });

  const pedidosFiltrados = pedidos.filter((pedido) => {
    const nome = pedido.nome_solicitante || "";
    const descricao = pedido.descricao || "";
    const matchBusca = `${nome} ${descricao}`.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === "todos" || pedido.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto relative">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Pedidos de Oração</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie os pedidos de oração da igreja.</p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/secretaria/oracoes/novo" className="bg-ohel-blue hover:bg-blue-600 text-white font-medium py-2.5 px-6 rounded-md transition-all shadow-[0_0_15px_rgba(0,123,255,0.2)] flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Novo Pedido
          </Link>
        </div>
      </div>

      <Card className="p-4 flex flex-col lg:flex-row gap-4 items-center bg-ohel-surface/50">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
          <input type="text" aria-label="Buscar pedidos" placeholder="Buscar por pessoa ou texto..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full bg-ohel-bg border border-gray-700 text-sm text-white rounded-md pl-9 pr-4 py-2.5 focus:border-ohel-blue outline-none" />
        </div>
        <select aria-label="Filtrar por status" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="bg-ohel-bg border border-gray-700 text-sm text-white rounded-md px-4 py-2.5 outline-none w-full lg:w-48">
          <option value="todos">Todos os Status</option>
          <option value="Pendente">Pendentes</option>
          <option value="Em Oração">Em Oração</option>
          <option value="Rejeitado">Rejeitados</option>
          <option value="Atendido">Atendidos</option>
        </select>
      </Card>

      {loadError && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{loadError}</div>}
      {statusError && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{statusError}</div>}

      <Card className="overflow-hidden p-0 border-gray-800/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-ohel-surface/80 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400">
                <th className="p-4 font-medium">Ações</th>
                <th className="p-4 font-medium">Pessoa</th>
                <th className="p-4 font-medium">Pedido</th>
                <th className="p-4 font-medium">Visibilidade</th>
                <th className="p-4 font-medium">Data</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Carregando pedidos...</td></tr>
              ) : loadError && pedidos.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-red-300">Não foi possível consultar os pedidos.</td></tr>
              ) : pedidosFiltrados.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhum pedido de oração encontrado.</td></tr>
              ) : (
                pedidosFiltrados.map((pedido) => (
                  <tr key={pedido.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <button type="button" aria-label={`Editar pedido de ${pedido.nome_solicitante || "solicitante"}`} onClick={() => router.push(`/secretaria/oracoes/editar/${pedido.id}`)} className="text-gray-500 hover:text-ohel-blue transition-colors"><Edit className="w-4 h-4" /></button>
                        {pedido.status === "Pendente" && (
                          <>
                            <button type="button" aria-label="Colocar pedido em oração" onClick={() => void handleStatusChange(pedido.id, "Em Oração")} disabled={statusUpdatingId === pedido.id || Boolean(statusUpdatingId)} className="text-gray-500 hover:text-green-400 disabled:opacity-50 transition-colors" title="Colocar em oração"><CheckCircle className="w-4 h-4" /></button>
                            <button type="button" aria-label="Rejeitar pedido" onClick={() => void handleStatusChange(pedido.id, "Rejeitado")} disabled={statusUpdatingId === pedido.id || Boolean(statusUpdatingId)} className="text-gray-500 hover:text-red-400 disabled:opacity-50 transition-colors" title="Rejeitar"><XCircle className="w-4 h-4" /></button>
                          </>
                        )}
                        <button type="button" aria-label={`Excluir pedido de ${pedido.nome_solicitante || "solicitante"}`} onClick={() => { setPedidoToDelete(pedido.id); setDeleteError(null); }} className="text-gray-500 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                    <td className="p-4 text-white font-medium flex items-center gap-2"><HeartHandshake className="w-4 h-4 text-red-500" /> {pedido.nome_solicitante || "Anônimo"}</td>
                    <td className="p-4 text-gray-300 text-sm truncate max-w-[300px]" title={pedido.descricao || ""}>{pedido.descricao || "—"}</td>
                    <td className="p-4">
                      {pedido.visibilidade === "Público" ? (
                        <span className="flex items-center gap-1 text-green-400 text-xs"><Eye className="w-3 h-3" /> Público</span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-400 text-xs"><EyeOff className="w-3 h-3" /> Privado</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-400 text-sm">{formatarData(pedido.created_at)}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${pedido.status === "Pendente" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : pedido.status === "Em Oração" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : pedido.status === "Rejeitado" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20"}`}>
                        {pedido.status || "Sem status"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {pedidoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="excluir-oracao-titulo" aria-describedby="excluir-oracao-descricao" className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
              <h3 id="excluir-oracao-titulo" className="text-lg font-bold text-white">Excluir Pedido</h3>
            </div>
            <p id="excluir-oracao-descricao" className="text-gray-400 text-sm mb-4 leading-relaxed">Tem certeza que deseja excluir este pedido de oração? Esta ação não pode ser desfeita.</p>
            {deleteError && <div role="alert" aria-live="assertive" className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{deleteError}</div>}
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => { if (!isDeleting) { setPedidoToDelete(null); setDeleteError(null); } }} className="px-4 py-2 text-sm text-gray-400 hover:text-white" disabled={isDeleting}>Cancelar</button>
              <button type="button" onClick={() => void handleDelete()} className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md text-sm flex items-center gap-2 disabled:opacity-50" disabled={isDeleting} aria-busy={isDeleting}>
                {isDeleting ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
