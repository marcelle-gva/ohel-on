"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, CalendarDays, Plus, Trash2, User } from "lucide-react";
import Link from "next/link";

export default function NovaEscalaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [membros, setMembros] = useState<{id: string, nome: string}[]>([]);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    titulo_evento: "", data_culto: "", horario: "19:30", observacoes: ""
  });

  // Estados das Funções
  const [funcoes, setFuncoes] = useState<{ funcao: string, membro: string }[]>([]);
  const [novaFuncao, setNovaFuncao] = useState({ funcao: "Pregador", membro: "" });

  const listaFuncoes = [
    "Pregador", "Dirigente", "Louvor", "Ministro", "Som", "Projeção", 
    "Diaconia", "Recepção", "Obreiro", "Mídia", "Fotografia", "Transmissão"
  ];

  useEffect(() => {
    const initPage = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) {
          setIgrejaId(user.igreja_id);
          const { data: membs, error } = await supabase.from('membros')
            .select('id, nome')
            .eq('igreja_id', user.igreja_id)
            .order('nome');
          if (error) {
            setModal({ isOpen: true, type: "error", title: "Erro ao carregar membros", message: error.message });
          } else {
            setMembros(membs || []);
          }
        } else {
          setModal({ isOpen: true, type: "error", title: "Erro", message: "Não foi possível identificar a igreja do usuário." });
        }
      } else {
        setModal({ isOpen: true, type: "error", title: "Sessão expirada", message: "Entre novamente para criar uma escala." });
      }
    };
    initPage();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addFuncao = () => {
    if (!novaFuncao.membro) return;
    setFuncoes([...funcoes, novaFuncao]);
    setNovaFuncao({ funcao: "Pregador", membro: "" }); // Reseta
  };

  const removeFuncao = (index: number) => {
    setFuncoes(funcoes.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) return setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada." });
    
    setLoading(true);
    try {
      const { error } = await supabase.from("escalas").insert([{
        igreja_id: igrejaId,
        titulo_evento: formData.titulo_evento,
        data_culto: formData.data_culto,
        horario: formData.horario,
        observacoes: formData.observacoes,
        funcoes: funcoes
      }]);

      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Escala criada com sucesso!" });
      setTimeout(() => router.push("/secretaria/escalas"), 1500);
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Link href="/secretaria/escalas" className="text-gray-400 hover:text-white transition-colors mt-0.5"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Nova Escala</h1>
            <p className="text-gray-400 text-xs mt-0.5">Monte a equipe de trabalho para o culto.</p>
          </div>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={loading} className="w-auto px-6 py-2 text-xs">
          <Save className="w-3.5 h-3.5 mr-1.5" /> {loading ? "Salvando..." : "Salvar Escala"}
        </Button>
      </div>

      <Card className="p-6 flex flex-col gap-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          {/* INFORMAÇÕES DO EVENTO */}
          <div>
            <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-3 flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5" /> Informações do Culto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <Input label="Título do Evento *" name="titulo_evento" placeholder="Ex: Culto de Celebração" value={formData.titulo_evento} onChange={handleChange} required className="py-2 text-xs" />
              </div>
              <Input label="Data *" type="date" name="data_culto" value={formData.data_culto} onChange={handleChange} required className="py-2 text-xs" />
              <Input label="Horário" type="time" name="horario" value={formData.horario} onChange={handleChange} className="py-2 text-xs" />
            </div>
          </div>

          {/* MONTAGEM DA EQUIPE */}
          <div className="border-t border-gray-800 pt-5">
            <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-3 flex items-center gap-2">
              <User className="w-3.5 h-3.5" /> Equipe de Trabalho
            </h3>
            
            <div className="bg-ohel-bg border border-gray-800 p-4 rounded-lg">
              <div className="flex flex-col md:flex-row gap-2 items-end mb-4">
                
                <div className="w-full md:w-1/3 flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Função</label>
                  <select value={novaFuncao.funcao} onChange={e => setNovaFuncao({...novaFuncao, funcao: e.target.value})} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                    {listaFuncoes.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div className="flex-1 w-full flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Membro Escalado</label>
                  <select value={novaFuncao.membro} onChange={e => setNovaFuncao({...novaFuncao, membro: e.target.value})} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                    <option value="">Selecione um membro...</option>
                    {membros.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                  </select>
                </div>

                <Button type="button" variant="secondary" onClick={addFuncao} className="px-4 py-2 text-xs h-[34px] w-full md:w-auto">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
                </Button>
              </div>

              {/* LISTA DE FUNÇÕES ADICIONADAS */}
              {funcoes.length > 0 ? (
                <div className="flex flex-col gap-2 mt-2">
                  {funcoes.map((f, index) => (
                    <div key={index} className="flex items-center justify-between bg-ohel-surface border border-gray-800 p-2.5 rounded text-xs">
                      <div className="flex items-center gap-2">
                        <span className="bg-ohel-blue/10 text-ohel-blue px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{f.funcao}</span>
                        <span className="text-white font-medium">{f.membro}</span>
                      </div>
                      <button type="button" onClick={() => removeFuncao(index)} className="text-red-500 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-500 italic mt-1">Nenhum membro escalado ainda.</p>
              )}
            </div>
          </div>

          {/* OBSERVAÇÕES */}
          <div className="border-t border-gray-800 pt-4">
            <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider mb-1.5 block">Observações (Opcional)</label>
            <textarea name="observacoes" value={formData.observacoes} onChange={handleChange} placeholder="Ex: Ensaio às 18h, culto de Santa Ceia..." className="input-ohel w-full px-3 py-2 rounded-md text-xs min-h-[80px] resize-y" />
          </div>

        </form>
      </Card>
    </div>
  );
}