"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { Search, Plus, Edit, Trash2, AlertTriangle, MessageCircle, QrCode, User, CheckSquare, CheckCircle } from "lucide-react";
import Image from "next/image";
import QRCode from "react-qr-code";

interface Membro {
  id: string; nome: string; telefone: string; cargo: string; status: string;
  codigo_membro: string | null; foto_url: string | null; data_batismo: string | null;
  congregacao_id: string | null; congregacoes: { nome: string } | null;
}
interface Congregacao { id: string; nome: string; }

export default function MembrosPage() {
  const router = useRouter();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [congregacoes, setCongregacoes] = useState<Congregacao[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroCongregacao, setFiltroCongregacao] = useState("todas");

  const [membroToDelete, setMembroToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados para o Modal de QR Code
  const [showQrModal, setShowQrModal] = useState(false);
  const [igrejaId, setIgrejaId] = useState("");
  const [totalPendentes, setTotalPendentes] = useState(0);

  // Estado do Toast (Notificação)
  const [toast, setToast] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) setIgrejaId(user.igreja_id);
      }
      fetchDados();
    };
    init();
  }, []);

  const fetchDados = async () => {
    try {
      setLoading(true);
      const { data: dataCong } = await supabase.from("congregacoes").select("id, nome");
      if (dataCong) setCongregacoes(dataCong);

      const { data: dataMembros, error } = await supabase.from("membros").select(`*, congregacoes (nome)`).order("nome");
      if (error) throw error;
      setMembros(dataMembros || []);

      const { count } = await supabase.from("membros").select("*", { count: "exact", head: true }).eq("status", "Pré-Cadastro");
      setTotalPendentes(count || 0);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!membroToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("membros").delete().eq("id", membroToDelete);
      if (error) throw error;
      setMembros(membros.filter((m) => m.id !== membroToDelete));
      setMembroToDelete(null);
    } catch (error: any) {
      setDeleteFeedback({ isOpen: true, type: "error", title: "Erro ao excluir", message: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyLink = () => {
    const publicUrl = `${window.location.origin}/pre-cadastro?igreja=${igrejaId}`;
    navigator.clipboard.writeText(publicUrl);
    
    // Ativa o Toast
    setToast(true);
    // Esconde o Toast após 3 segundos
    setTimeout(() => setToast(false), 3000);
  };

  const membrosFiltrados = membros.filter((m) => {
    const matchBusca = m.nome.toLowerCase().includes(busca.toLowerCase()) || (m.telefone && m.telefone.includes(busca)) || (m.congregacoes?.nome.toLowerCase().includes(busca.toLowerCase()));
    const matchStatus = filtroStatus === "todos" || m.status === filtroStatus;
    const matchCongregacao = filtroCongregacao === "todas" || m.congregacao_id === filtroCongregacao;
    return matchBusca && matchStatus && matchCongregacao;
  });

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/pre-cadastro?igreja=${igrejaId}` : "";

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto relative">
      <FeedbackModal
        isOpen={deleteFeedback.isOpen}
        onClose={() => setDeleteFeedback({ ...deleteFeedback, isOpen: false })}
        type={deleteFeedback.type}
        title={deleteFeedback.title}
        message={deleteFeedback.message}
      />
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Gestão de Membros</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie a membresia e pré-cadastros.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/secretaria/membros/aprovacao" className="relative bg-ohel-surface border border-gray-700 hover:border-ohel-blue text-white font-medium py-2.5 px-4 rounded-md transition-all flex items-center gap-2 text-sm">
            <CheckSquare className="w-4 h-4" /> Analisar Pré-Cadastro
            {totalPendentes > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {totalPendentes}
              </span>
            )}
          </Link>
          
          <button onClick={() => setShowQrModal(true)} className="bg-ohel-surface border border-gray-700 hover:border-ohel-blue text-white font-medium py-2.5 px-4 rounded-md transition-all flex items-center gap-2 text-sm">
            <QrCode className="w-4 h-4" /> QRCode
          </button>

          <Link href="/secretaria/membros/novo" className="bg-ohel-blue hover:bg-blue-600 text-white font-medium py-2.5 px-6 rounded-md transition-all shadow-[0_0_15px_rgba(0,123,255,0.2)] flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Novo Membro
          </Link>
        </div>
      </div>

      <Card className="p-4 flex flex-col lg:flex-row gap-4 items-center bg-ohel-surface/50">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
          <input type="text" placeholder="Pesquisar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full bg-ohel-bg border border-gray-700 text-sm text-white rounded-md pl-9 pr-4 py-2.5 focus:border-ohel-blue outline-none" />
        </div>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="bg-ohel-bg border border-gray-700 text-sm text-white rounded-md px-4 py-2.5 outline-none w-full lg:w-48">
          <option value="todos">Todos os Status</option>
          <option value="Ativo">Ativos</option>
          <option value="Inativo">Inativos</option>
          <option value="Pré-Cadastro">Pré-Cadastros</option>
        </select>
        <select value={filtroCongregacao} onChange={(e) => setFiltroCongregacao(e.target.value)} className="bg-ohel-bg border border-gray-700 text-sm text-white rounded-md px-4 py-2.5 outline-none w-full lg:w-56">
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
                <th className="p-4 font-medium">Código</th>
                <th className="p-4 font-medium">Nome</th>
                <th className="p-4 font-medium">Telefone</th>
                <th className="p-4 font-medium">Cargo</th>
                <th className="p-4 font-medium">Congregação</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400">Carregando...</td></tr>
              ) : membrosFiltrados.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400">Nenhum membro encontrado.</td></tr>
              ) : (
                membrosFiltrados.map((membro) => (
                  <tr key={membro.id} className="hover:bg-white/[0.02]">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => router.push(`/secretaria/membros/editar/${membro.id}`)} className="text-gray-500 hover:text-ohel-blue"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => setMembroToDelete(membro.id)} className="text-gray-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="w-8 h-8 rounded-full bg-ohel-surface border border-gray-700 flex items-center justify-center overflow-hidden">
                        {membro.foto_url ? <Image src={membro.foto_url} alt={membro.nome} width={32} height={32} className="object-cover w-full h-full" /> : <User className="w-4 h-4 text-gray-500" />}
                      </div>
                    </td>
                    <td className="p-4 text-gray-400 text-sm">{membro.codigo_membro || "-"}</td>
                    <td className="p-4 text-white font-medium">{membro.nome}</td>
                    <td className="p-4 text-gray-300">
                      {membro.telefone ? (
                        <div className="flex items-center gap-2"><span className="text-green-500 text-xs font-bold">WA</span> {membro.telefone}</div>
                      ) : "-"}
                    </td>
                    <td className="p-4 text-gray-300 text-sm">{membro.cargo}</td>
                    <td className="p-4 text-gray-300 text-sm">{membro.congregacoes?.nome || "-"}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                        ${membro.status === "Ativo" ? "bg-green-500/10 text-green-400 border-green-500/20" : 
                          membro.status === "Pré-Cadastro" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : 
                          "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                        {membro.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL DO QR CODE */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-white mb-2">Link de Pré-Cadastro</h3>
            <p className="text-gray-400 text-sm text-center mb-6">Aponte a câmera do celular para o QR Code ou compartilhe o link.</p>
            
            <div className="bg-white p-4 rounded-xl mb-6">
              {publicUrl && <QRCode value={publicUrl} size={200} />}
            </div>
            
            <div className="w-full bg-ohel-bg border border-gray-800 rounded-lg p-3 text-xs text-gray-400 break-all mb-6">
              {publicUrl}
            </div>

            <div className="flex gap-3 w-full">
              <button onClick={() => setShowQrModal(false)} className="flex-1 px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-md transition-colors">Fechar</button>
              
              {/* BOTÃO DE COPIAR COM A NOVA FUNÇÃO */}
              <button onClick={handleCopyLink} className="flex-1 bg-ohel-blue hover:bg-blue-600 text-white font-medium py-2 rounded-md text-sm transition-colors shadow-lg">
                Copiar Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST DE NOTIFICAÇÃO (Link Copiado) */}
      {toast && (
        <div className="fixed bottom-8 right-8 z-[100] flex items-center gap-3 bg-ohel-surface border border-green-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.5)] rounded-xl px-6 py-4 animate-in slide-in-from-bottom-5 duration-300">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <h4 className="text-white font-medium text-sm">Link copiado!</h4>
            <p className="text-gray-400 text-xs mt-0.5">Pronto para ser compartilhado.</p>
          </div>
        </div>
      )}

      {/* MODAL DE EXCLUSÃO */}
      {membroToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-white">Excluir Membro</h3>
            </div>
            
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Tem certeza que deseja excluir este membro? Todo o histórico vinculado a ele será perdido. Esta ação não pode ser desfeita.
            </p>
            
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setMembroToDelete(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors" disabled={isDeleting}>Cancelar</button>
              <button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors flex items-center gap-2" disabled={isDeleting}>
                {isDeleting ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}