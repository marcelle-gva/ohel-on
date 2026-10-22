"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Search, Plus, Edit, Trash2, AlertTriangle, HeartHandshake, EyeOff, Eye } from "lucide-react";

interface PedidoOracao {
  id: string; nome_solicitante: string; descricao: string; visibilidade: string; status: string; created_at: string;
}

export default function OracoesPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<PedidoOracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const [pedidoToDelete, setPedidoToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchPedidos();
  }, []);

  const fetchPedidos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("pedidos_oracao")
        .select("*")
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      setPedidos(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!pedidoToDelete) return;
    setIsDeleting(true);
    try {
      await supabase.from("pedidos_oracao").delete().eq("id", pedidoToDelete);
      setPedidos(pedidos.filter((p) => p.id !== pedidoToDelete));
      setPedidoToDelete(null);
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  const pedidosFiltrados = pedidos.filter((p) => {
    const matchBusca = p.nome_solicitante.toLowerCase().includes(busca.toLowerCase()) || p.descricao.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === "todos" || p.status === filtroStatus;
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
          <input type="text" placeholder="Buscar por pessoa ou texto..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full bg-ohel-bg border border-gray-700 text-sm text-white rounded-md pl-9 pr-4 py-2.5 focus:border-ohel-blue outline-none" />
        </div>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="bg-ohel-bg border border-gray-700 text-sm text-white rounded-md px-4 py-2.5 outline-none w-full lg:w-48">
          <option value="todos">Todos os Status</option>
          <option value="Pendente">Pendentes</option>
          <option value="Em Oração">Em Oração</option>
          <option value="Atendido">Atendidos</option>
        </select>
      </Card>

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
              ) : pedidosFiltrados.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhum pedido de oração encontrado.</td></tr>
              ) : (
                pedidosFiltrados.map((pedido) => (
                  <tr key={pedido.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => router.push(`/secretaria/oracoes/editar/${pedido.id}`)} className="text-gray-500 hover:text-ohel-blue transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => setPedidoToDelete(pedido.id)} className="text-gray-500 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                    <td className="p-4 text-white font-medium flex items-center gap-2">
                      <HeartHandshake className="w-4 h-4 text-ohel-blue" /> {pedido.nome_solicitante}
                    </td>
                    <td className="p-4 text-gray-300 text-sm truncate max-w-[300px]" title={pedido.descricao}>{pedido.descricao}</td>
                    <td className="p-4">
                      {pedido.visibilidade === 'Público' ? (
                        <span className="flex items-center gap-1 text-green-400 text-xs"><Eye className="w-3 h-3"/> Público</span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-400 text-xs"><EyeOff className="w-3 h-3"/> Privado</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-400 text-sm">{formatarData(pedido.created_at)}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                        ${pedido.status === "Pendente" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : 
                          pedido.status === "Em Oração" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : 
                          "bg-green-500/10 text-green-400 border-green-500/20"}`}>
                        {pedido.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL DE EXCLUSÃO */}
      {pedidoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-white">Excluir Pedido</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">Tem certeza que deseja excluir este pedido de oração? Esta ação não pode ser desfeita.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setPedidoToDelete(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white" disabled={isDeleting}>Cancelar</button>
              <button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md text-sm flex items-center gap-2" disabled={isDeleting}>
                {isDeleting ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}