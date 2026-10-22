"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Search, Plus, Edit, Trash2, AlertTriangle, Award, ArrowLeft } from "lucide-react";

export default function ModelosCertificadosPage() {
  const router = useRouter();
  const [modelos, setModelos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [modeloToDelete, setModeloToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchModelos();
  }, []);

  const fetchModelos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("modelos_certificados").select("*").order("created_at");
      if (error) throw error;
      setModelos(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!modeloToDelete) return;
    setIsDeleting(true);
    try {
      await supabase.from("modelos_certificados").delete().eq("id", modeloToDelete);
      setModelos(modelos.filter((m) => m.id !== modeloToDelete));
      setModeloToDelete(null);
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const modelosFiltrados = modelos.filter((m) => m.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="flex flex-col gap-5 w-full max-w-6xl mx-auto pb-10">
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/secretaria/certificados" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Award className="w-5 h-5 text-ohel-blue" /> Modelos de Certificados
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Cadastre e personalize os modelos de certificados da igreja.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar modelo..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-ohel-bg border border-gray-700 text-xs text-white rounded-md pl-9 pr-3 py-2 focus:border-ohel-blue outline-none"
            />
          </div>
          <Link href="/secretaria/certificados/modelos/novo" className="bg-ohel-blue hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md text-xs flex items-center gap-2 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Novo Modelo
          </Link>
        </div>
      </div>

      <Card className="p-0 overflow-hidden border-gray-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-ohel-surface border-b border-gray-800 text-[10px] uppercase tracking-wider text-gray-400">
            <tr>
              <th className="p-4 font-medium">ID</th>
              <th className="p-4 font-medium">Descrição do Modelo</th>
              <th className="p-4 font-medium text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loading ? (
              <tr><td colSpan={3} className="p-8 text-center text-gray-400">Carregando modelos...</td></tr>
            ) : modelosFiltrados.length === 0 ? (
              <tr><td colSpan={3} className="p-8 text-center text-gray-400">Nenhum modelo cadastrado.</td></tr>
            ) : (
              modelosFiltrados.map((modelo, index) => (
                <tr key={modelo.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="p-4 text-gray-500">#{index + 1}</td>
                  <td className="p-4 text-white font-medium flex items-center gap-2">
                    <Award className="w-4 h-4 text-ohel-blue" /> {modelo.nome}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => router.push(`/secretaria/certificados/modelos/editar/${modelo.id}`)} className="text-gray-500 hover:text-ohel-blue transition-colors" title="Editar"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => setModeloToDelete(modelo.id)} className="text-gray-500 hover:text-red-500 transition-colors" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* MODAL DE EXCLUSÃO */}
      {modeloToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-red-500" /></div>
              <h3 className="text-sm font-bold text-white">Excluir Modelo</h3>
            </div>
            <p className="text-gray-400 text-xs mb-5">Tem certeza que deseja excluir este modelo de certificado?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModeloToDelete(null)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancelar</button>
              <button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white font-medium py-1.5 px-3 rounded text-xs" disabled={isDeleting}>
                {isDeleting ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}