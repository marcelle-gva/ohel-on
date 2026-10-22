"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Search, Plus, Edit, Trash2, AlertTriangle, User } from "lucide-react";
import Image from "next/image";

interface Congregado {
  id: string; nome: string; telefone: string; status: string;
  data_nascimento: string | null; congregacao_id: string | null;
  congregacoes: { nome: string } | null;
  foto_url: string | null; // <-- Adicionado o campo da foto
}
interface Congregacao { id: string; nome: string; }

export default function CongregadosPage() {
  const router = useRouter();
  const [congregados, setCongregados] = useState<Congregado[]>([]);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [busca, setBusca] = useState("");
  const [filtroCongregacao, setFiltroCongregacao] = useState("todas");

  const [congregadoToDelete, setCongregadoToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    try {
      setLoading(true);
      const { data: dataCong } = await supabase.from("congregacoes").select("id, nome");
      if (dataCong) setCongregacoes(dataCong);

      const { data: dataCongregados, error } = await supabase
        .from("congregados")
        .select(`*, congregacoes (nome)`)
        .order("nome");
        
      if (error) throw error;
      setCongregados(dataCongregados || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!congregadoToDelete) return;
    setIsDeleting(true);
    try {
      await supabase.from("congregados").delete().eq("id", congregadoToDelete);
      setCongregados(congregados.filter((c) => c.id !== congregadoToDelete));
      setCongregadoToDelete(null);
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Função para calcular idade
  const calcularIdade = (dataNascimento: string | null) => {
    if (!dataNascimento) return "-";
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mes = hoje.getMonth() - nascimento.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return `${idade} anos`;
  };

  const congregadosFiltrados = congregados.filter((c) => {
    const matchBusca = c.nome.toLowerCase().includes(busca.toLowerCase()) || (c.telefone && c.telefone.includes(busca));
    const matchCongregacao = filtroCongregacao === "todas" || c.congregacao_id === filtroCongregacao;
    return matchBusca && matchCongregacao;
  });

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto relative">
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Gestão de Congregados</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie as pessoas que frequentam a igreja.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/secretaria/congregados/novo" className="bg-ohel-blue hover:bg-blue-600 text-white font-medium py-2.5 px-6 rounded-md transition-all shadow-[0_0_15px_rgba(0,123,255,0.2)] flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Novo Congregado
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
                <th className="p-4 font-medium">Foto</th>
                <th className="p-4 font-medium">Nome</th>
                <th className="p-4 font-medium">Idade</th>
                <th className="p-4 font-medium">Telefone</th>
                <th className="p-4 font-medium">Congregação</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">Carregando congregados...</td></tr>
              ) : congregadosFiltrados.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">Nenhum congregado encontrado.</td></tr>
              ) : (
                congregadosFiltrados.map((cong) => (
                  <tr key={cong.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => router.push(`/secretaria/congregados/editar/${cong.id}`)} className="text-gray-500 hover:text-ohel-blue transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => setCongregadoToDelete(cong.id)} className="text-gray-500 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                    
                    {/* COLUNA DA FOTO ADICIONADA AQUI */}
                    <td className="p-4">
                      <div className="w-8 h-8 rounded-full bg-ohel-surface border border-gray-700 flex items-center justify-center overflow-hidden">
                        {cong.foto_url ? (
                          <Image src={cong.foto_url} alt={cong.nome} width={32} height={32} className="object-cover w-full h-full" />
                        ) : (
                          <User className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                    </td>

                    <td className="p-4 text-white font-medium">{cong.nome}</td>
                    <td className="p-4 text-gray-300 text-sm">{calcularIdade(cong.data_nascimento)}</td>
                    <td className="p-4 text-gray-300">{cong.telefone || "-"}</td>
                    <td className="p-4 text-gray-300 text-sm">{cong.congregacoes?.nome || "-"}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                        ${cong.status === "Ativo" ? "bg-green-500/10 text-green-400 border-green-500/20" : 
                          cong.status === "Em Discipulado" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                          "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                        {cong.status}
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
      {congregadoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-white">Excluir Congregado</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">Tem certeza que deseja excluir este congregado? Esta ação não pode ser desfeita.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setCongregadoToDelete(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white" disabled={isDeleting}>Cancelar</button>
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