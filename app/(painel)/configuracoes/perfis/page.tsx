"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Shield, Plus, Trash2, Edit, Check, X, ShieldAlert } from "lucide-react";

// Lista de Módulos do Sistema para marcar as permissões
const MODULOS = [
  { id: "dashboard", nome: "Dashboard" },
  { id: "membros", nome: "Membros" },
  { id: "congregacoes", nome: "Congregações" },
  { id: "congregados", nome: "Congregados" },
  { id: "visitantes", nome: "Visitantes" },
  { id: "eventos", nome: "Eventos" },
  { id: "financeiro", nome: "Financeiro" },
  { id: "mural", nome: "Mural de Comunicações" },
  { id: "monitor-midia", nome: "Monitor de Mídia (Acesso)" },
  { id: "monitor-louvores", nome: "Monitor: Adicionar/Editar Louvores" },
  { id: "monitor-oracoes", nome: "Monitor: Aprovar Orações" },
  { id: "escalas", nome: "Escalas" },
  { id: "configuracoes", nome: "Configurações" },
];

const ACOES = [
  { id: "ler", nome: "Ver" },
  { id: "criar", nome: "Criar" },
  { id: "editar", nome: "Editar" },
  { id: "excluir", nome: "Excluir" },
];

interface Permissao {
  modulo: string;
  acao: string;
}

interface Perfil {
  id: string;
  nome: string;
  descricao: string;
  permissoes: Permissao[];
}

export default function PerfisPage() {
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerfil, setEditingPerfil] = useState<Perfil | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [modalFeedback, setModalFeedback] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });
  const [perfilToDelete, setPerfilToDelete] = useState<string | null>(null);

  // Estados do Formulário
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Permissao[]>([]);

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) {
          setIgrejaId(user.igreja_id);
          
          // Busca Perfis e suas permissões
          const { data: perfisData } = await supabase
            .from('perfis')
            .select('*, perfis_permissoes(modulo, acao)')
            .eq('igreja_id', user.igreja_id)
            .order('nome');

          if (perfisData) {
            const formatados = perfisData.map(p => ({
              id: p.id,
              nome: p.nome,
              descricao: p.descricao,
              permissoes: p.perfis_permissoes || []
            }));
            setPerfis(formatados);
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openNewModal = () => {
    setEditingPerfil(null);
    setNome("");
    setDescricao("");
    setSelectedPerms([]);
    setIsModalOpen(true);
  };

  const openEditModal = (perfil: Perfil) => {
    setEditingPerfil(perfil);
    setNome(perfil.nome);
    setDescricao(perfil.descricao || "");
    setSelectedPerms(perfil.permissoes);
    setIsModalOpen(true);
  };

  const togglePermission = (modulo: string, acao: string) => {
    const exists = selectedPerms.find(p => p.modulo === modulo && p.acao === acao);
    if (exists) {
      setSelectedPerms(selectedPerms.filter(p => !(p.modulo === modulo && p.acao === acao)));
    } else {
      setSelectedPerms([...selectedPerms, { modulo, acao }]);
    }
  };

  const isPermSelected = (modulo: string, acao: string) => {
    return selectedPerms.some(p => p.modulo === modulo && p.acao === acao);
  };

  const handleSave = async () => {
    if (!nome || !igrejaId) return setModalFeedback({ isOpen: true, type: "error", title: "Atenção", message: "O nome do perfil é obrigatório." });
    
    setSaving(true);
    try {
      let perfilId = editingPerfil?.id;

      // 1. Salva ou Atualiza o Perfil
      if (editingPerfil) {
        await supabase.from('perfis').update({ nome, descricao }).eq('id', perfilId);
      } else {
        const { data } = await supabase.from('perfis').insert([{ igreja_id: igrejaId, nome, descricao }]).select().single();
        perfilId = data?.id;
      }

      if (!perfilId) throw new Error("Erro ao obter o ID do perfil.");

      // 2. Limpa as permissões antigas e insere as novas
      await supabase.from('perfis_permissoes').delete().eq('perfil_id', perfilId);
      
      if (selectedPerms.length > 0) {
        const permsToInsert = selectedPerms.map(p => ({
          perfil_id: perfilId,
          modulo: p.modulo,
          acao: p.acao
        }));
        await supabase.from('perfis_permissoes').insert(permsToInsert);
      }

      setModalFeedback({ isOpen: true, type: "success", title: "Sucesso", message: "Perfil salvo com sucesso!" });
      setIsModalOpen(false);
      fetchDados();
    } catch (error: any) {
      setModalFeedback({ isOpen: true, type: "error", title: "Erro", message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePerfil = async () => {
    if (!perfilToDelete) return;
    try {
      await supabase.from('perfis').delete().eq('id', perfilToDelete);
      setPerfis(perfis.filter(p => p.id !== perfilToDelete));
      setPerfilToDelete(null);
      setModalFeedback({ isOpen: true, type: "success", title: "Excluído", message: "Perfil removido." });
    } catch (error) {
      setModalFeedback({ isOpen: true, type: "error", title: "Erro", message: "Não foi possível excluir o perfil." });
    }
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modalFeedback.isOpen} onClose={() => setModalFeedback({ ...modalFeedback, isOpen: false })} type={modalFeedback.type} title={modalFeedback.title} message={modalFeedback.message} />

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/configuracoes" className="text-gray-400 hover:text-white transition-colors mt-1">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Shield className="w-6 h-6 text-ohel-blue" /> Perfis e Permissões
            </h1>
            <p className="text-gray-400 text-sm mt-1">Crie grupos de acesso e defina o que cada um pode fazer no sistema.</p>
          </div>
        </div>
        <Button variant="primary" onClick={openNewModal} className="w-full md:w-auto px-6">
          <Plus className="w-4 h-4 mr-2" /> Novo Perfil
        </Button>
      </div>

      {/* Lista de Perfis */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">Carregando perfis...</div>
      ) : perfis.length === 0 ? (
        <div className="text-center p-10 text-gray-400 bg-ohel-surface/30 rounded-xl border border-gray-800">
          Nenhum perfil cadastrado ainda. Clique em "Novo Perfil" para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {perfis.map(p => (
            <Card key={p.id} className="p-5 border-gray-800 bg-ohel-surface flex flex-col group hover:border-ohel-blue/50 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div className="w-10 h-10 rounded-lg bg-ohel-blue/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-ohel-blue" />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(p)} className="p-1.5 text-gray-400 hover:text-ohel-blue bg-ohel-bg rounded transition-colors"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => setPerfilToDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 bg-ohel-bg rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{p.nome}</h3>
              <p className="text-xs text-gray-400 mb-4 line-clamp-2">{p.descricao || "Sem descrição"}</p>
              
              <div className="mt-auto pt-3 border-t border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Permissões: {p.permissoes.length}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL DE CRIAR / EDITAR PERFIL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl w-full max-w-4xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-gray-800 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-ohel-blue" /> {editingPerfil ? "Editar Perfil" : "Novo Perfil"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                <Input label="Nome do Perfil *" placeholder="Ex: Secretária, Líder de Louvor..." value={nome} onChange={(e) => setNome(e.target.value)} />
                <Input label="Descrição (Opcional)" placeholder="Para que serve este perfil?" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
              </div>

              <div className="border border-gray-800 rounded-xl overflow-hidden">
                <div className="grid grid-cols-6 bg-ohel-bg border-b border-gray-800 p-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <div className="col-span-2">Módulo</div>
                  {ACOES.map(a => <div key={a.id} className="text-center">{a.nome}</div>)}
                </div>
                
                <div className="flex flex-col">
                  {MODULOS.map((mod, index) => (
                    <div key={mod.id} className={`grid grid-cols-6 p-3 items-center ${index % 2 === 0 ? 'bg-ohel-surface/30' : 'bg-transparent'} border-b border-gray-800/50 last:border-0`}>
                      <div className="col-span-2 text-sm font-medium text-white">{mod.nome}</div>
                      {ACOES.map(a => (
                        <div key={a.id} className="flex justify-center">
                          <button 
                            type="button"
                            onClick={() => togglePermission(mod.id, a.id)}
                            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                              isPermSelected(mod.id, a.id) 
                                ? "bg-ohel-blue text-white border-ohel-blue" 
                                : "bg-ohel-bg border border-gray-700 text-transparent hover:border-gray-500"
                            }`}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 flex justify-end gap-3 shrink-0 bg-ohel-surface/50">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Perfil"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EXCLUSÃO */}
      {perfilToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center"><ShieldAlert className="w-5 h-5 text-red-500" /></div>
              <h3 className="text-lg font-bold text-white">Excluir Perfil</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">Tem certeza que deseja excluir este perfil? Os usuários vinculados a ele perderão o acesso.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setPerfilToDelete(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
              <button onClick={handleDeletePerfil} className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md text-sm">Sim, excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}