"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Search, Plus, Edit, Trash2, Church, AlertTriangle } from "lucide-react";

interface Congregacao {
  id: string;
  nome: string;
  tipo: string;
  endereco: string;
}

export default function CongregacoesPage() {
  const router = useRouter();
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  
  // Estado para controlar o Modal de Exclusão
  const [congregacaoToDelete, setCongregacaoToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchCongregacoes();
  }, []);

  const fetchCongregacoes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("congregacoes")
        .select("*")
        .order("nome", { ascending: true });

      if (error) throw error;
      setCongregacoes(data || []);
    } catch (error) {
      console.error("Erro ao buscar congregações:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!congregacaoToDelete) return;
    setIsDeleting(true);
    
    try {
      const { error } = await supabase
        .from("congregacoes")
        .delete()
        .eq("id", congregacaoToDelete);

      if (error) throw error;
      
      // Atualiza a lista na tela
      setCongregacoes(congregacoes.filter((c) => c.id !== congregacaoToDelete));
      setCongregacaoToDelete(null); // Fecha o modal
    } catch (error: any) {
      alert("Erro ao excluir: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const congregacoesFiltradas = congregacoes.filter((c) =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto relative">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Congregações</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie a matriz e as congregações locais.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link 
            href="/secretaria/congregacoes/nova"
            className="bg-ohel-blue hover:bg-blue-600 text-white font-medium py-2.5 px-6 rounded-md transition-all duration-300 flex items-center justify-center gap-2 text-sm shadow-[0_0_15px_rgba(0,123,255,0.2)]"
          >
            <Plus className="w-4 h-4" /> Nova Congregação
          </Link>
        </div>
      </div>

      {/* Barra de Filtros */}
      <Card className="p-4 flex items-center bg-ohel-surface/50">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
          <input 
            type="text" 
            placeholder="Pesquisar por nome..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-ohel-bg border border-gray-700 text-sm text-white rounded-md pl-9 pr-4 py-2.5 focus:border-ohel-blue outline-none transition-colors"
          />
        </div>
      </Card>

      {/* Tabela */}
      <Card className="overflow-hidden p-0 border-gray-800/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-ohel-surface/80 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400">
                <th className="p-4 font-medium w-24">Ações</th>
                <th className="p-4 font-medium">Nome</th>
                <th className="p-4 font-medium">Tipo</th>
                <th className="p-4 font-medium">Endereço</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-400">Carregando congregações...</td>
                </tr>
              ) : congregacoesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-400">Nenhuma congregação cadastrada.</td>
                </tr>
              ) : (
                congregacoesFiltradas.map((cong) => (
                  <tr key={cong.id} className="hover:bg-white/[0.02] transition-colors group">
                    
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {/* BOTÃO EDITAR (Vai para a página de edição) */}
                        <button 
                          onClick={() => router.push(`/secretaria/congregacoes/editar/${cong.id}`)}
                          className="text-gray-500 hover:text-ohel-blue transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        
                        {/* BOTÃO EXCLUIR (Abre o modal) */}
                        <button 
                          onClick={() => setCongregacaoToDelete(cong.id)}
                          className="text-gray-500 hover:text-red-500 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                    <td className="p-4 text-white font-medium">
                      <div className="flex items-center gap-2">
                        <Church className="w-4 h-4 text-ohel-blue" /> {cong.nome}
                      </div>
                    </td>

                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-gray-600/30 bg-gray-500/10 text-gray-300">
                        {cong.tipo}
                      </span>
                    </td>
                    
                    <td className="p-4 text-gray-300">{cong.endereco || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL DE EXCLUSÃO (Fica invisível até clicar na lixeira) */}
      {congregacaoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-white">Excluir Congregação</h3>
            </div>
            
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Tem certeza que deseja excluir esta congregação? Todos os dados vinculados a ela podem ser afetados. Esta ação não pode ser desfeita.
            </p>
            
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setCongregacaoToDelete(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button 
                onClick={handleDelete}
                className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors flex items-center gap-2"
                disabled={isDeleting}
              >
                {isDeleting ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}