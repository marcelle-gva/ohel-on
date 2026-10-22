"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Users, Plus, Search, Trash2, AlertTriangle, GraduationCap, X } from "lucide-react";

export default function MatriculasPage() {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [membros, setMembros] = useState<any[]>([]);
  const [matriculas, setMatriculas] = useState<any[]>([]);
  
  const [selectedClasseId, setSelectedClasseId] = useState<string>("");
  
  // Controle do Modal e Feedback
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMembroId, setSelectedMembroId] = useState("");
  const [buscaMembro, setBuscaMembro] = useState("");
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });
  
  const [matriculaToDelete, setMatriculaToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedClasseId) {
      fetchMatriculas(selectedClasseId);
    }
  }, [selectedClasseId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [classesRes, membrosRes] = await Promise.all([
        supabase.from('ebd_classes').select('*').eq('status', 'Ativa').order('nome'),
        supabase.from('membros').select('id, nome, cargo').eq('status', 'Ativo').order('nome')
      ]);

      if (classesRes.data) {
        setClasses(classesRes.data);
        if (classesRes.data.length > 0 && !selectedClasseId) {
          setSelectedClasseId(classesRes.data[0].id);
        }
      }
      if (membrosRes.data) setMembros(membrosRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatriculas = async (classeId: string) => {
    const { data } = await supabase
      .from('ebd_matriculas')
      .select('*, membros(nome, cargo)')
      .eq('classe_id', classeId)
      .eq('status', 'Ativo')
      .order('created_at');
    
    if (data) setMatriculas(data);
  };

  const handleMatricular = async () => {
    if (!selectedMembroId) return;
    
    // Verifica se o membro já está matriculado nesta classe
    const jaMatriculado = matriculas.some(m => m.membro_id === selectedMembroId);
    if (jaMatriculado) {
      setModal({ isOpen: true, type: "error", title: "Atenção", message: "Este membro já está matriculado nesta classe." });
      return;
    }

    try {
      const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', (await supabase.auth.getSession()).data.session?.user.id).maybeSingle();
      
      const { error } = await supabase.from('ebd_matriculas').insert([{
        igreja_id: user?.igreja_id,
        classe_id: selectedClasseId,
        membro_id: selectedMembroId,
        status: 'Ativo'
      }]);

      if (error) throw error;

      setIsModalOpen(false);
      setSelectedMembroId("");
      setBuscaMembro("");
      fetchMatriculas(selectedClasseId);
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Aluno matriculado!" });
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
    }
  };

  const handleDesmatricular = async () => {
    if (!matriculaToDelete) return;
    try {
      const { error } = await supabase.from('ebd_matriculas').delete().eq('id', matriculaToDelete);
      if (error) throw error;
      
      setMatriculas(matriculas.filter(m => m.id !== matriculaToDelete));
      setMatriculaToDelete(null);
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Não foi possível remover o aluno." });
    }
  };

  const membrosFiltrados = membros.filter(m => 
    m.nome.toLowerCase().includes(buscaMembro.toLowerCase())
  );

  const classeAtual = classes.find(c => c.id === selectedClasseId);

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando dados da EBD...</div>;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-5 pb-10 relative">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/ensino" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-ohel-blue" /> Matrículas de Alunos
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Vincule os membros às turmas da Escola Bíblica.</p>
          </div>
        </div>
      </div>

      <Card className="p-4 flex flex-col md:flex-row gap-4 items-center bg-ohel-surface border-gray-800">
        <div className="flex-1 w-full">
          <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider mb-1.5 block">Selecione a Classe para Gerenciar</label>
          <select 
            value={selectedClasseId} 
            onChange={(e) => setSelectedClasseId(e.target.value)}
            className="input-ohel w-full px-3 py-2.5 rounded-md text-sm font-medium"
          >
            {classes.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.faixa_etaria})</option>)}
          </select>
        </div>
        
        {selectedClasseId && (
          <Button onClick={() => setIsModalOpen(true)} className="w-full md:w-auto px-6 py-2.5 text-xs bg-ohel-blue hover:bg-blue-600 text-white md:mt-5">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Matricular Aluno
          </Button>
        )}
      </Card>

      {classes.length === 0 ? (
        <Card className="p-10 text-center text-gray-400 text-sm">Nenhuma classe ativa cadastrada. Crie uma classe primeiro.</Card>
      ) : (
        <Card className="p-0 overflow-hidden border-gray-800">
          <div className="bg-ohel-surface/80 p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-ohel-blue" /> Alunos da {classeAtual?.nome}
            </h3>
            <span className="bg-ohel-blue/10 text-ohel-blue text-[10px] font-bold px-2 py-1 rounded border border-ohel-blue/20">{matriculas.length} alunos</span>
          </div>
          
          <table className="w-full text-left text-xs">
            <thead className="bg-[#05080f] border-b border-gray-800 text-[9px] uppercase tracking-wider text-gray-400">
              <tr>
                <th className="p-4 font-medium">Nome do Aluno</th>
                <th className="p-4 font-medium">Cargo na Igreja</th>
                <th className="p-4 font-medium text-center">Status</th>
                <th className="p-4 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {matriculas.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-500 italic">Nenhum aluno matriculado nesta classe ainda.</td></tr>
              ) : (
                matriculas.map((mat) => (
                  <tr key={mat.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 text-white font-medium flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-ohel-blue/10 flex items-center justify-center text-[10px] text-ohel-blue">{(mat.membros?.nome || "?").charAt(0)}</div>
                      {mat.membros?.nome}
                    </td>
                    <td className="p-4 text-gray-400">{mat.membros?.cargo || "-"}</td>
                    <td className="p-4 text-center">
                      <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                        {mat.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button onClick={() => setMatriculaToDelete(mat.id)} className="text-red-500 hover:text-red-400 bg-red-500/10 p-1.5 rounded transition-colors" title="Remover Matrícula">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* MODAL DE MATRÍCULA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5 border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white">Matricular Aluno na {classeAtual?.nome}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Buscar membro por nome..." 
                  value={buscaMembro}
                  onChange={(e) => setBuscaMembro(e.target.value)}
                  className="w-full bg-ohel-bg border border-gray-700 text-xs text-white rounded-md pl-9 pr-3 py-2 outline-none focus:border-ohel-blue"
                />
              </div>

              <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                {membrosFiltrados.map(m => (
                  <button 
                    key={m.id} 
                    onClick={() => setSelectedMembroId(m.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors ${selectedMembroId === m.id ? 'bg-ohel-blue/10 border-ohel-blue' : 'bg-ohel-bg border-gray-800 hover:border-gray-600'}`}
                  >
                    <p className="text-xs font-bold text-white">{m.nome}</p>
                    {selectedMembroId === m.id && <div className="w-2 h-2 rounded-full bg-ohel-blue"></div>}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white">Cancelar</button>
                <Button onClick={handleMatricular} disabled={!selectedMembroId} className="w-auto px-5 py-2 text-xs bg-ohel-blue text-white">Confirmar Matrícula</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EXCLUSÃO */}
      {matriculaToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-red-500" /></div>
              <h3 className="text-sm font-bold text-white">Remover Aluno</h3>
            </div>
            <p className="text-gray-400 text-xs mb-5">Deseja remover a matrícula deste aluno? Ele sairá da lista de chamada desta classe.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setMatriculaToDelete(null)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancelar</button>
              <button onClick={handleDesmatricular} className="bg-red-500 hover:bg-red-600 text-white font-medium py-1.5 px-3 rounded text-xs">
                Sim, remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}