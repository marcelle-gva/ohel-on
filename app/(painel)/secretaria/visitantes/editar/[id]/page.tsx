"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, UserPlus } from "lucide-react";
import Link from "next/link";

export default function EditarVisitantePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [congregacoes, setCongregacoes] = useState<{id: string, nome: string}[]>([]);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    nome: "", telefone: "", data_visita: "", congregacao_id: "", observacao: ""
  });

  useEffect(() => {
    const fetchDados = async () => {
      if (!id) return;
      try {
        const { data: congs } = await supabase.from('congregacoes').select('id, nome').order('nome');
        if (congs) setCongregacoes(congs);

        const { data, error } = await supabase.from('visitantes').select('*').eq('id', id).single();
        if (error) throw error;

        if (data) {
          setFormData({
            nome: data.nome || "", 
            telefone: data.telefone || "", 
            data_visita: data.data_visita || "", 
            congregacao_id: data.congregacao_id || "",
            observacao: data.observacao || ""
          });
        }
      } catch (error) {
        setModal({ isOpen: true, type: "error", title: "Erro", message: "Erro ao carregar os dados do visitante." });
      } finally {
        setLoading(false);
      }
    };
    fetchDados();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from("visitantes").update({
        nome: formData.nome,
        telefone: formData.telefone,
        data_visita: formData.data_visita || null,
        congregacao_id: formData.congregacao_id || null,
        observacao: formData.observacao
      }).eq("id", id);

      if (error) throw error;
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Visitante atualizado com sucesso!" });
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro ao Atualizar", message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    setModal({ ...modal, isOpen: false });
    if (modal.type === "success") router.push("/secretaria/visitantes");
  };

  if (loading) return <div className="w-full h-full flex items-center justify-center text-gray-400">Carregando dados...</div>;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={handleCloseModal} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/secretaria/visitantes" className="text-gray-400 hover:text-white transition-colors mt-1">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Editar Visitante</h1>
            <p className="text-gray-400 text-sm mt-1">Atualize os dados desta visita.</p>
          </div>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={saving} className="w-full md:w-auto px-8 shrink-0">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      <Card className="p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-3 mb-2">
            <UserPlus className="w-5 h-5 text-ohel-blue" />
            <h2 className="text-lg font-semibold text-white">Dados da Visita</h2>
          </div>

          <Input label="Nome Completo *" name="nome" value={formData.nome} onChange={handleChange} required />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input label="Telefone / WhatsApp" name="telefone" value={formData.telefone} onChange={handleChange} />
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