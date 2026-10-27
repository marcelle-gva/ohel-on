"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Search, Plus, Edit, Trash2, AlertTriangle, FileText, ArrowLeft, Eye, X } from "lucide-react";
import { buildLetterHtml, sanitizeLetterHtml } from "@/lib/cartas";

type LetterModel = Record<string, unknown> & {
  id: string;
  nome: string;
  conteudo?: string | null;
  tipo_cabecalho?: string | null;
  tipo_rodape?: string | null;
};

export default function ModelosCartasPage() {
  const router = useRouter();
  const [modelos, setModelos] = useState<LetterModel[]>([]);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [loadError, setLoadError] = useState("");
  const [modeloPreview, setModeloPreview] = useState<LetterModel | null>(null);
  const [modeloToDelete, setModeloToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchModelos = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error("Sua sessão expirou. Entre novamente.");
      const { data: user, error: userError } = await supabase.from("usuarios").select("igreja_id").eq("id", session.user.id).maybeSingle();
      if (userError) throw userError;
      if (!user?.igreja_id) throw new Error("Não foi possível identificar a igreja do usuário.");
      setIgrejaId(user.igreja_id);
      const { data, error } = await supabase.from("modelos_cartas").select("*").eq("igreja_id", user.igreja_id).order("created_at");
      if (error) throw error;
      setModelos((data || []) as LetterModel[]);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os modelos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchModelos(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchModelos]);

  const handleDelete = async () => {
    if (!modeloToDelete) return;
    if (!igrejaId) {
      setLoadError("Igreja não identificada; o modelo não foi excluído.");
      return;
    }
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("modelos_cartas").delete().eq("igreja_id", igrejaId).eq("id", modeloToDelete);
      if (error) throw error;
      setModelos(modelos.filter((m) => m.id !== modeloToDelete));
      setModeloToDelete(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível excluir o modelo.");
    } finally {
      setIsDeleting(false);
    }
  };

  const modelosFiltrados = modelos.filter((m) => m.nome.toLowerCase().includes(busca.toLowerCase()));
  const previewHtml = modeloPreview ? buildLetterHtml(
    modeloPreview,
    { nome: "Maria Exemplo", cpf: "000.000.000-00", cargo: "Membro", congregacoes: { nome: "Sede" } },
    { nome: "Igreja Exemplo", email: "contato@igreja.com", telefone: "(00) 0000-0000" },
    "2025-01-15",
    { mostrarCabecalho: true, mostrarRodape: true, incluirAssinatura: false, assinaturas: [] },
    sanitizeLetterHtml(modeloPreview.conteudo || ""),
  ) : "";

  return (
    <div className="flex flex-col gap-5 w-full max-w-6xl mx-auto pb-10">
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/secretaria/cartas" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-ohel-blue" /> Modelos de Cartas Padrão
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Cadastre e personalize os modelos de documentos oficiais da igreja.</p>
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
          <Link href="/secretaria/cartas/modelos/novo" className="bg-ohel-blue hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md text-xs flex items-center gap-2 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Nova Carta
          </Link>
        </div>
      </div>

      {loadError && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">{loadError}</p>}

      <Card className="p-0 overflow-hidden border-gray-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-ohel-surface border-b border-gray-800 text-[10px] uppercase tracking-wider text-gray-400">
            <tr>
              <th className="p-4 font-medium">ID</th>
              <th className="p-4 font-medium">Descrição do Modelo</th>
              <th className="p-4 font-medium">Tipo Cabeçalho</th>
              <th className="p-4 font-medium">Tipo Rodapé</th>
              <th className="p-4 font-medium text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Carregando modelos...</td></tr>
            ) : modelosFiltrados.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nenhum modelo cadastrado.</td></tr>
            ) : (
              modelosFiltrados.map((modelo, index) => (
                <tr key={modelo.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="p-4 text-gray-500">#{index + 1}</td>
                  <td className="p-4 text-white font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4 text-ohel-blue" /> {modelo.nome}
                  </td>
                  <td className="p-4">
                    <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px]">{modelo.tipo_cabecalho === "custom" ? "Personalizado" : "Padrão Sistema"}</span>
                  </td>
                  <td className="p-4">
                    <span className="bg-gray-500/10 text-gray-400 border border-gray-500/20 px-2 py-0.5 rounded text-[10px]">{modelo.tipo_rodape === "custom" ? "Personalizado" : "Padrão Sistema"}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => setModeloPreview(modelo)} className="text-gray-500 hover:text-white transition-colors" title="Visualizar"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => router.push(`/secretaria/cartas/modelos/editar/${modelo.id}`)} className="text-gray-500 hover:text-ohel-blue transition-colors" title="Editar"><Edit className="w-4 h-4" /></button>
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
            <p className="text-gray-400 text-xs mb-5">Tem certeza que deseja excluir este modelo de carta?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModeloToDelete(null)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancelar</button>
              <button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white font-medium py-1.5 px-3 rounded text-xs" disabled={isDeleting}>
                {isDeleting ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
      {modeloPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Pré-visualização do modelo">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-ohel-surface">
            <div className="flex items-center justify-between border-b border-gray-700 px-5 py-3">
              <h2 className="text-sm font-bold text-white">{modeloPreview.nome}</h2>
              <button type="button" onClick={() => setModeloPreview(null)} aria-label="Fechar pré-visualização" className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-auto bg-gray-200 p-6">
              <div className="mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white p-12 shadow-lg" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}