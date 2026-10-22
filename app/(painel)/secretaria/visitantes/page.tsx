"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Search, Plus, Edit, Trash2, AlertTriangle, User } from "lucide-react";

interface Visitante {
  id: string; nome: string; telefone: string; data_visita: string;
  congregacao_id: string | null; congregacoes: { nome: string } | null;
}
interface Congregacao { id: string; nome: string; }

export default function VisitantesPage() {
  const router = useRouter();
  const [visitantes, setVisitantes] = useState<Visitante[]>([]);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [busca, setBusca] = useState("");
  const [filtroCongregacao, setFiltroCongregacao] = useState("todas");

  const [visitanteToDelete, setVisitanteToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    try {
      setLoading(true);
      const { data: dataCong } = await supabase.from("congregacoes").select("id, nome");
      if (dataCong) setCongregacoes(dataCong);

      const { data: dataVisitantes, error } = await supabase
        .from("visitantes")
        .select(`*, congregacoes (nome)`)
        .order("data_visita", { ascending: false }); // Mais recentes primeiro
        
      if (error) throw error;
      setVisitantes(dataVisitantes || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!visitanteToDelete) return;
    setIsDeleting(true);
    try {
      await supabase.from("visitantes").delete().eq("id", visitanteToDelete);
      setVisitantes(visitantes.filter((v) => v.id !== visitanteToDelete));
      setVisitanteToDelete(null);
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatarData = (data: string | null) => {
    if (!data) return "-";
    return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  const visitantesFiltrados = visitantes.filter((v) => {
    const matchBusca = v.nome.toLowerCase().includes(busca.toLowerCase()) || (v.telefone && v.telefone.includes(busca));
    const matchCongregacao = filtroCongregacao === "todas" || v.congregacao_id === filtroCongregacao;
    return matchBusca && matchCongregacao;
  });

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto relative">
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Gestão de Visitantes</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie as pessoas que visitaram a igreja.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/secretaria/visitantes/novo" className="bg-ohel-blue hover:bg-blue-600 text-white font-medium py-2.5 px-6 rounded-md transition-all shadow-[0_0_15px_rgba(0,123,255,0.2)] flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Novo Visitante
          </Link>
        </div>
      </div>

      <Card className="p-4 flex flex-col lg:flex-row gap-4 items-center bg-ohel-surface/50">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
          <input type="text" placeholder="Pesquisar por nome ou telefone..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full bg-ohel-bg border border-gray-700 text-sm text-white rounded-md pl-9 pr-4 py-2.5 focus:border-ohel-blue outline-none" />
        </div>
        <select value={filtroCongregacao} onChange={(e) => setFiltroCongregacao(e.target.value)} className="bg-ohel-bg border border-gray-700 text-sm text-white rounded-md px-4 py-2.5 outline-none w-full lg:w-64">
          <option value="todas">Todas as Congregações</option>
          {congregacoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Card>

      <Card className="overflow-hidden p-0 border-gray-800/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-ohel-surface/80 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400">
                <th className="p-4 font-medium">Ações</th>
                <th className="p-4 font-medium">Nome</th>
                <th className="p-4 font-medium">Telefone</th>
                <th className="p-4 font-medium">Data da Visita</th>
                <th className="p-4 font-medium">Congregação Visitada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Carregando visitantes...</td></tr>
              ) : visitantesFiltrados.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nenhum visitante encontrado.</td></tr>
              ) : (
                visitantesFiltrados.map((vis) => (
                  <tr key={vis.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => router.push(`/secretaria/visitantes/editar/${vis.id}`)} className="text-gray-500 hover:text-ohel-blue transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => setVisitanteToDelete(vis.id)} className="text-gray-500 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                    <td className="p-4 text-white font-medium flex items-center gap-2">
                      <User className="w-4 h-4 text-ohel-blue" /> {vis.nome}
                    </td>
                    <td className="p-4 text-gray-300">{vis.telefone || "-"}</td>
                    <td className="p-4 text-gray-300 text-sm">{formatarData(vis.data_visita)}</td>
                    <td className="p-4 text-gray-300 text-sm">{vis.congregacoes?.nome || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL DE EXCLUSÃO */}
      {visitanteToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-white">Excluir Visitante</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">Tem certeza que deseja excluir este visitante? Esta ação não pode ser desfeita.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setVisitanteToDelete(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white" disabled={isDeleting}>Cancelar</button>
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