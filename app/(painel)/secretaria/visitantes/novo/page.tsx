"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, UserPlus } from "lucide-react";
import Link from "next/link";

export default function NovoVisitantePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<{id: string, nome: string}[]>([]);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    nome: "", 
    telefone: "", 
    data_visita: new Date().toISOString().split('T')[0], 
    congregacao_id: "",
    observacao: "" // <-- NOVO CAMPO AQUI
  });

  useEffect(() => {
    const initPage = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) setIgrejaId(user.igreja_id);
      }
      const { data: congs } = await supabase.from('congregacoes').select('id, nome').order('nome');
      if (congs) setCongregacoes(congs);
    };
    initPage();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) return setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada." });
    
    setLoading(true);
    try {
      const { error } = await supabase.from("visitantes").insert([{
        igreja_id: igrejaId,
        nome: formData.nome,
        telefone: formData.telefone,
        data_visita: formData.data_visita || null,
        congregacao_id: formData.congregacao_id || null,
        observacao: formData.observacao // <-- INSERINDO A OBSERVAÇÃO
      }]);

      if (error) throw error;
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Visitante cadastrado com sucesso!" });
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro ao Cadastrar", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModal({ ...modal, isOpen: false });
    if (modal.type === "success") router.push("/secretaria/visitantes");
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={handleCloseModal} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/secretaria/visitantes" className="text-gray-400 hover:text-white transition-colors mt-1">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Novo Visitante</h1>
            <p className="text-gray-400 text-sm mt-1">Registre a visita de uma nova pessoa.</p>
          </div>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={loading} className="w-full md:w-auto px-8 shrink-0">
          <Save className="w-4 h-4 mr-2" />
          {loading ? "Salvando..." : "Salvar Visitante"}
        </Button>
      </div>

      <Card className="p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-3 mb-2">
            <UserPlus className="w-5 h-5 text-ohel-blue" />
            <h2 className="text-lg font-semibold text-white">Dados da Visita</h2>
          </div>

          <Input label="Nome Completo *" name="nome" placeholder="Ex: João Silva" value={formData.nome} onChange={handleChange} required />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input label="Telefone / WhatsApp" name="telefone" placeholder="(00) 00000-0000" value={formData.telefone} onChange={handleChange} />
            <Input label="Data da Visita" type="date" name="data_visita" value={formData.data_visita} onChange={handleChange} />
            
            <div className="md:col-span-2 flex flex-col gap-2">
              <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Congregação Visitada</label>
              <select name="congregacao_id" value={formData.congregacao_id} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                <option value="">Selecione (opcional)</option>
                {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>

          {/* NOVO CAMPO DE OBSERVAÇÃO */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Observações</label>
            <textarea 
              name="observacao" 
              placeholder="Ex: Veio a convite do irmão João, mora no bairro X, deseja fazer um estudo bíblico..." 
              value={formData.observacao} 
              onChange={handleChange}
              className="input-ohel w-full px-4 py-3 rounded-lg text-sm min-h-[100px] resize-y"
            />
          </div>

        </form>
      </Card>
    </div>
  );
}