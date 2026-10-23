"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Shield, Plus, Trash2, Edit, Check, X, Users } from "lucide-react";

const MODULOS = [
  { id: "dashboard", nome: "Dashboard" },
  { id: "membros", nome: "Secretaria: Membros" },
  { id: "congregacoes", nome: "Secretaria: Congregações" },
  { id: "congregados", nome: "Secretaria: Congregados" },
  { id: "visitantes", nome: "Secretaria: Visitantes" },
  { id: "oracoes", nome: "Secretaria: Orações" },
  { id: "reunioes", nome: "Secretaria: Reuniões" },
  { id: "visitas", nome: "Secretaria: Visitas" },
  { id: "fichas", nome: "Secretaria: Fichas" },
  { id: "cartas", nome: "Secretaria: Cartas" },
  { id: "certificados", nome: "Secretaria: Certificados" },
  { id: "credenciais", nome: "Secretaria: Credenciais" },
  { id: "eventos", nome: "Eventos" },
  { id: "financeiro", nome: "Financeiro" },
  { id: "patrimonio", nome: "Patrimônio" },
  { id: "gabinete", nome: "Gabinete Pastoral" },
  { id: "ensino", nome: "Ensino (EBD)" },
  { id: "infantil", nome: "Departamento Infantil" },
  { id: "comunicacoes", nome: "Comunicações e WhatsApp" },
  { id: "relatorios", nome: "Gerador de Relatórios" },
  { id: "mural", nome: "Mural de Comunicações" },
  { id: "monitor-midia", nome: "Monitor de Mídia (Acesso)" },
  { id: "monitor-oracoes", nome: "Monitor: Aprovar Orações" },
  { id: "escalas", nome: "Escalas" },
  { id: "configuracoes", nome: "Configurações" },
];

const ACOES = [
  { id: "ler", nome: "Ver" },
  { id: "criar", nome: "Criar" },
  { id: "editar", nome: "Editar" },
  { id: "excluir", nome: "Excluir" },
  { id: "aprovar", nome: "Aprovar" },
];

interface Permissao { modulo: string; acao: string; }
interface UsuarioGrupo {
  id: string;
  nome: string;
  email: string | null;
  grupo_id: string | null;
}
interface Grupo {
  id: string;
  nome: string;
  descricao: string;
  permissoes: Permissao[];
}

export default function GruposPage() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<Grupo | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("permissoes");
  
  const [modalFeedback, setModalFeedback] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });
  const [grupoToDelete, setGrupoToDelete] = useState<string | null>(null);

  // Estados do Formulário
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Permissao[]>([]);
  const [membrosSelecionados, setMembrosSelecionados] = useState<string[]>([]);

  const fetchDados = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) {
          setIgrejaId(user.igreja_id);
          
          const { data: gruposData } = await supabase
            .from('grupos')
            .select('*, grupos_permissoes(modulo, acao)')
            .eq('igreja_id', user.igreja_id)
            .order('nome');

          if (gruposData) {
            setGrupos(gruposData.map(g => ({
              id: g.id, nome: g.nome, descricao: g.descricao, permissoes: g.grupos_permissoes || []
            })));
          }

          const { data: usersData } = await supabase.from('usuarios').select('id, nome, email, grupo_id').eq('igreja_id', user.igreja_id);
          if (usersData) setUsuarios(usersData);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDados();
  }, []);

  const openEditModal = (grupo: Grupo) => {
    setEditingGrupo(grupo);
    setNome(grupo.nome);
    setDescricao(grupo.descricao || "");
    setSelectedPerms(grupo.permissoes);
    
    // Filtra os membros que já estão neste grupo
    const membrosDoGrupo = usuarios.filter(u => u.grupo_id === grupo.id).map(u => u.id);
    setMembrosSelecionados(membrosDoGrupo);
    
    setActiveTab("permissoes");
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingGrupo(null);
    setNome("");
    setDescricao("");
    setSelectedPerms([]);
    setMembrosSelecionados([]);
    setActiveTab("permissoes");
    setIsModalOpen(true);
  };

  const togglePermission = (modulo: string, acao: string) => {
    const exists = selectedPerms.find(p => p.modulo === modulo && p.acao === acao);
    if (exists) setSelectedPerms(selectedPerms.filter(p => !(p.modulo === modulo && p.acao === acao)));
    else setSelectedPerms([...selectedPerms, { modulo, acao }]);
  };

  const toggleMembro = (userId: string) => {
    if (membrosSelecionados.includes(userId)) setMembrosSelecionados(membrosSelecionados.filter(id => id !== userId));
    else setMembrosSelecionados([...membrosSelecionados, userId]);
  };

  const handleSave = async () => {
    if (!nome || !igrejaId) return setModalFeedback({ isOpen: true, type: "error", title: "Atenção", message: "O nome do grupo é obrigatório." });
    
    setSaving(true);
    try {
      let grupoId = editingGrupo?.id;

      if (editingGrupo) {
        const { error } = await supabase.from('grupos').update({ nome, descricao }).eq('id', grupoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('grupos').insert([{ igreja_id: igrejaId, nome, descricao }]).select().single();
        if (error) throw error;
        grupoId = data?.id;
      }

      if (!grupoId) throw new Error("Erro ao obter ID do grupo.");

      // Atualiza Permissões
      const { error: deletePermissionsError } = await supabase.from('grupos_permissoes').delete().eq('grupo_id', grupoId);
      if (deletePermissionsError) throw deletePermissionsError;
      if (selectedPerms.length > 0) {
        const permsToInsert = selectedPerms.map(p => ({ grupo_id: grupoId, modulo: p.modulo, acao: p.acao }));
        const { error: insertPermissionsError } = await supabase.from('grupos_permissoes').insert(permsToInsert);
        if (insertPermissionsError) throw insertPermissionsError;
      }

      const selectedUsers = new Set(membrosSelecionados);
      const usersToUnassign = usuarios.filter(user => user.grupo_id === grupoId && !selectedUsers.has(user.id));
      for (const user of usersToUnassign) {
        const { error } = await supabase.rpc("admin_set_user_group", {
          p_usuario_id: user.id,
          p_grupo_id: null,
        });
        if (error) throw error;
      }
      for (const userId of membrosSelecionados) {
        const { error } = await supabase.rpc("admin_set_user_group", {
          p_usuario_id: userId,
          p_grupo_id: grupoId,
        });
        if (error) throw error;
      }

      setModalFeedback({ isOpen: true, type: "success", title: "Sucesso", message: "Grupo salvo com sucesso!" });
      setIsModalOpen(false);
      fetchDados();
    } catch (error) {
      setModalFeedback({
        isOpen: true,
        type: "error",
        title: "Erro",
        message: error instanceof Error ? error.message : "Não foi possível salvar o grupo.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGrupo = async () => {
    if (!grupoToDelete) return;
    try {
      for (const user of usuarios.filter(user => user.grupo_id === grupoToDelete)) {
        const { error } = await supabase.rpc("admin_set_user_group", {
          p_usuario_id: user.id,
          p_grupo_id: null,
        });
        if (error) throw error;
      }
      const { error } = await supabase.from('grupos').delete().eq('id', grupoToDelete);
      if (error) throw error;
      setGrupos(grupos.filter(p => p.id !== grupoToDelete));
      setGrupoToDelete(null);
    } catch (error) {
      setModalFeedback({ isOpen: true, type: "error", title: "Erro", message: error instanceof Error ? error.message : "Não foi possível excluir." });
    }
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modalFeedback.isOpen} onClose={() => setModalFeedback({ ...modalFeedback, isOpen: false })} type={modalFeedback.type} title={modalFeedback.title} message={modalFeedback.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/configuracoes" className="text-gray-400 hover:text-white transition-colors mt-1">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Shield className="w-6 h-6 text-ohel-blue" /> Grupos e Permissões
            </h1>
            <p className="text-gray-400 text-sm mt-1">Crie grupos, defina permissões e adicione membros.</p>
          </div>
        </div>
        <Button variant="primary" onClick={openNewModal} className="w-full md:w-auto px-6">
          <Plus className="w-4 h-4 mr-2" /> Novo Grupo
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Carregando grupos...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {grupos.map(g => (
            <Card key={g.id} className="p-5 border-gray-800 bg-ohel-surface flex flex-col group hover:border-ohel-blue/50 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div className="w-10 h-10 rounded-lg bg-ohel-blue/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-ohel-blue" />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(g)} className="p-1.5 text-gray-400 hover:text-ohel-blue bg-ohel-bg rounded transition-colors"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => setGrupoToDelete(g.id)} className="p-1.5 text-gray-400 hover:text-red-500 bg-ohel-bg rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{g.nome}</h3>
              <p className="text-xs text-gray-400 mb-4 line-clamp-2">{g.descricao || "Sem descrição"}</p>
              
              <div className="mt-auto pt-3 border-t border-gray-800 flex justify-between items-center text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                <span>Permissões: {g.permissoes.length}</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {usuarios.filter(u => u.grupo_id === g.id).length} Membros</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL: GERENCIAR GRUPO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl w-full max-w-4xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-gray-800 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-ohel-blue" /> {editingGrupo ? "Gerenciar Grupo" : "Novo Grupo"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex border-b border-gray-800 bg-ohel-surface/50 shrink-0">
              <button onClick={() => setActiveTab("permissoes")} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === "permissoes" ? "border-ohel-blue text-ohel-blue" : "border-transparent text-gray-400 hover:text-white"}`}>Permissões</button>
              <button onClick={() => setActiveTab("membros")} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === "membros" ? "border-ohel-blue text-ohel-blue" : "border-transparent text-gray-400 hover:text-white"}`}>Membros do Grupo</button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Nome do Grupo *</label>
                  <input value={nome} onChange={e => setNome(e.target.value)} className="input-ohel w-full px-4 py-3 rounded-lg text-sm" placeholder="Ex: Liderança, Secretária..." />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Descrição (Opcional)</label>
                  <input value={descricao} onChange={e => setDescricao(e.target.value)} className="input-ohel w-full px-4 py-3 rounded-lg text-sm" placeholder="Para que serve este grupo?" />
                </div>
              </div>

              {activeTab === "permissoes" && (
                <div className="border border-gray-800 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-6 bg-ohel-bg border-b border-gray-800 p-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <div className="col-span-1">Módulo</div>
                    {ACOES.map(a => <div key={a.id} className="text-center">{a.nome}</div>)}
                  </div>
                  <div className="flex flex-col">
                    {MODULOS.map((mod, index) => (
                      <div key={mod.id} className={`grid grid-cols-6 p-3 items-center ${index % 2 === 0 ? 'bg-ohel-surface/30' : 'bg-transparent'} border-b border-gray-800/50 last:border-0`}>
                        <div className="col-span-1 text-sm font-medium text-white">{mod.nome}</div>
                        {ACOES.map(a => (
                          <div key={a.id} className="flex justify-center">
                            <button type="button" onClick={() => togglePermission(mod.id, a.id)} className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${selectedPerms.some(p => p.modulo === mod.id && p.acao === a.id) ? "bg-ohel-blue text-white" : "bg-ohel-bg border border-gray-700 text-transparent"}`}>
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "membros" && (
                <div className="bg-ohel-bg border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-4">Marque os usuários que pertencem a este grupo.</p>
                  <div className="flex flex-col gap-2">
                    {usuarios.map(u => (
                      <label key={u.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer border border-gray-800">
                        <input type="checkbox" checked={membrosSelecionados.includes(u.id)} onChange={() => toggleMembro(u.id)} className="w-5 h-5 accent-ohel-blue" />
                        <div>
                          <p className="text-sm font-bold text-white">{u.nome}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-800 flex justify-end gap-3 shrink-0 bg-ohel-surface/50">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Grupo"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EXCLUSÃO */}
      {grupoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-white mb-4">Excluir Grupo</h3>
            <p className="text-gray-400 text-sm mb-6">Tem certeza? Os usuários deste grupo ficarão sem acesso.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setGrupoToDelete(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
              <button onClick={handleDeleteGrupo} className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md text-sm">Sim, excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}