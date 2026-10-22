"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, User, Calendar, Lock, FileText, Users } from "lucide-react";
import Link from "next/link";

export default function NovoAtendimentoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  
  // Listas de Dados
  const [pastores, setPastores] = useState<any[]>([]);
  const [membros, setMembros] = useState<any[]>([]);
  const [visitantes, setVisitantes] = useState<any[]>([]);
  
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  // Controle de Interface: Membro ou Visitante?
  const [tipoPessoa, setTipoPessoa] = useState<"Membro" | "Visitante">("Membro");

  const [formData, setFormData] = useState({
    membro_id: "",
    nome_visitante: "",
    pastor_responsavel: "",
    data_atendimento: new Date().toISOString().split('T')[0],
    hora_atendimento: "14:00",
    tipo: "Aconselhamento",
    motivo: "",
    observacoes: "",
    status: "Agendado"
  });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id, nome').eq('id', session.user.id).maybeSingle();
        
        if (user) {
          setIgrejaId(user.igreja_id);
          
          const [membrosRes, visitantesRes] = await Promise.all([
            supabase.from('membros').select('id, nome, cargo').eq('igreja_id', user.igreja_id).order('nome'),
            supabase.from('visitantes').select('id, nome, telefone').eq('igreja_id', user.igreja_id).order('nome')
          ]);
          
          if (membrosRes.data) {
            setMembros(membrosRes.data);
            
            // FILTRO ATUALIZADO CONFORME SUA SOLICITAÇÃO
            const listaPastores = membrosRes.data.filter(m => {
              const cargo = m.cargo?.toLowerCase() || "";
              return cargo.includes('pastor') || 
                     cargo.includes('pastora') || 
                     cargo.includes('missionária') || 
                     cargo.includes('missionaria') || 
                     cargo.includes('evangelista');
            });
            setPastores(listaPastores);
            
            // Se o próprio usuário logado for um pastor, já o seleciona automaticamente
            const usuarioEhPastor = listaPastores.find(p => p.nome === user.nome);
            if (usuarioEhPastor) {
              setFormData(prev => ({ ...prev, pastor_responsavel: usuarioEhPastor.nome }));
            }
          }
          
          if (visitantesRes.data) {
            setVisitantes(visitantesRes.data);
          }
        }
      }
    };
    init();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) return setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada." });
    
    if (tipoPessoa === "Membro" && !formData.membro_id) {
      return setModal({ isOpen: true, type: "error", title: "Atenção", message: "Selecione o membro que será atendido." });
    }
    if (tipoPessoa === "Visitante" && !formData.nome_visitante) {
      return setModal({ isOpen: true, type: "error", title: "Atenção", message: "Informe o nome do visitante." });
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.from("atendimentos_pastorais").insert([{
        igreja_id: igrejaId,
        membro_id: tipoPessoa === "Membro" ? formData.membro_id : null,
        nome_visitante: tipoPessoa === "Visitante" ? formData.nome_visitante : null,
        pastor_responsavel: formData.pastor_responsavel,
        data_atendimento: formData.data_atendimento,
        hora_atendimento: formData.hora_atendimento,
        tipo: formData.tipo,
        motivo: formData.motivo,
        observacoes: formData.observacoes,
        status: formData.status
      }]);

      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Atendimento registrado com sucesso!" });
      setTimeout(() => router.push("/gabinete/atendimentos"), 1500);

    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro ao registrar", message: error.message });
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Link href="/gabinete/atendimentos" className="text-gray-400 hover:text-white transition-colors mt-0.5"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Novo Atendimento</h1>
            <p className="text-gray-400 text-xs mt-0.5">Agende ou registre um aconselhamento pastoral.</p>
          </div>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={loading} className="w-auto px-6 py-2 text-xs">
          <Save className="w-3.5 h-3.5 mr-1.5" /> {loading ? "Salvando..." : "Salvar Atendimento"}
        </Button>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          {/* DADOS DO ATENDIMENTO */}
          <div>
            <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-3 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> Informações do Atendimento
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              
              {/* SELECT DE PASTORES FILTRADO */}
              <div className="md:col-span-2 flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-ohel-silver uppercase">Pastor / Responsável *</label>
                <select name="pastor_responsavel" value={formData.pastor_responsavel} onChange={handleChange} required className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                  <option value="">Selecione o Pastor...</option>
                  {pastores.map(p => <option key={p.id} value={p.nome}>{p.nome} ({p.cargo})</option>)}
                  {/* Fallback caso o nome esteja no formData mas não esteja na lista */}
                  {formData.pastor_responsavel && !pastores.find(p => p.nome === formData.pastor_responsavel) && (
                     <option value={formData.pastor_responsavel}>{formData.pastor_responsavel}</option>
                  )}
                </select>
              </div>

              <Input label="Data *" type="date" name="data_atendimento" value={formData.data_atendimento} onChange={handleChange} required className="py-2 text-xs" />
              <Input label="Hora" type="time" name="hora_atendimento" value={formData.hora_atendimento} onChange={handleChange} className="py-2 text-xs" />
              
              <div className="md:col-span-2 flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-ohel-silver uppercase">Tipo de Atendimento *</label>
                <select name="tipo" value={formData.tipo} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                  <option value="Aconselhamento">Aconselhamento</option>
                  <option value="Oração">Oração / Intercessão</option>
                  <option value="Visita">Visita Domiciliar</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div className="md:col-span-2 flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-ohel-silver uppercase">Status *</label>
                <select name="status" value={formData.status} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                  <option value="Agendado">Agendado</option>
                  <option value="Realizado">Realizado</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>
            </div>
          </div>

          {/* PESSOA ATENDIDA */}
          <div className="border-t border-gray-800 pt-5">
            <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-3 flex items-center gap-2">
              <User className="w-3.5 h-3.5" /> Pessoa Atendida
            </h3>
            
            {/* Toggle Membro / Visitante */}
            <div className="flex gap-2 mb-4 bg-ohel-bg p-1.5 rounded-lg border border-gray-800 w-full md:w-fit">
              <button 
                type="button" 
                onClick={() => { setTipoPessoa("Membro"); setFormData({...formData, nome_visitante: ""}); }}
                className={`px-6 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-2 ${tipoPessoa === "Membro" ? "bg-ohel-blue text-white" : "text-gray-400 hover:text-white"}`}
              >
                <Users className="w-3.5 h-3.5" /> Membro
              </button>
              <button 
                type="button" 
                onClick={() => { setTipoPessoa("Visitante"); setFormData({...formData, membro_id: ""}); }}
                className={`px-6 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-2 ${tipoPessoa === "Visitante" ? "bg-purple-500 text-white" : "text-gray-400 hover:text-white"}`}
              >
                <User className="w-3.5 h-3.5" /> Visitante
              </button>
            </div>

            {/* Select de Membros */}
            {tipoPessoa === "Membro" && (
              <div className="flex flex-col gap-1.5 animate-in fade-in">
                <label className="text-[10px] font-semibold text-ohel-silver uppercase">Selecione o Membro *</label>
                <select name="membro_id" value={formData.membro_id} onChange={handleChange} required={tipoPessoa === "Membro"} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                  <option value="">Selecione um membro...</option>
                  {membros.map(m => <option key={m.id} value={m.id}>{m.nome} {m.cargo ? `(${m.cargo})` : ''}</option>)}
                </select>
              </div>
            )}

            {/* Select de Visitantes ou Digitar Nome */}
            {tipoPessoa === "Visitante" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-ohel-silver uppercase">Buscar Visitante Cadastrado</label>
                  <select 
                    onChange={(e) => setFormData({...formData, nome_visitante: e.target.value})} 
                    className="input-ohel w-full px-3 py-2 rounded-md text-xs"
                  >
                    <option value="">Selecione um visitante...</option>
                    {visitantes.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
                  </select>
                </div>
                <div>
                   <Input 
                    label="Ou digite um nome novo *" 
                    name="nome_visitante" 
                    placeholder="Ex: Maria (visitante)" 
                    value={formData.nome_visitante} 
                    onChange={handleChange} 
                    required={tipoPessoa === "Visitante"} 
                    className="py-2 text-xs" 
                  />
                </div>
              </div>
            )}
          </div>

          {/* DETALHES E OBSERVAÇÕES */}
          <div className="border-t border-gray-800 pt-5">
            <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> Detalhes do Atendimento
            </h3>
            
            <div className="flex flex-col gap-3">
              <Input label="Motivo / Assunto Principal" name="motivo" placeholder="Ex: Problemas familiares, orientação financeira..." value={formData.motivo} onChange={handleChange} className="py-2 text-xs" />
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-ohel-silver uppercase flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-red-400" /> Observações Sigilosas (Apenas Liderança)
                </label>
                <textarea 
                  name="observacoes" 
                  value={formData.observacoes} 
                  onChange={handleChange}
                  placeholder="Registre aqui os detalhes da conversa, orações realizadas e encaminhamentos..."
                  className="input-ohel w-full px-3 py-2 rounded-md text-xs min-h-[120px] resize-y"
                />
                <p className="text-[10px] text-gray-500 italic">Essas informações não são exibidas publicamente.</p>
              </div>
            </div>
          </div>

        </form>
      </Card>
    </div>
  );
}