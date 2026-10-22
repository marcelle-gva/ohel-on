"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, HeartHandshake } from "lucide-react";
import Link from "next/link";

export default function EditarPedidoOracaoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    nome_solicitante: "", descricao: "", visibilidade: "", status: ""
  });

  useEffect(() => {
    const fetchDados = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase.from('pedidos_oracao').select('*').eq('id', id).single();
        if (error) throw error;

        if (data) {
          setFormData({
            nome_solicitante: data.nome_solicitante || "", 
            descricao: data.descricao || "", 
            visibilidade: data.visibilidade || "Público", 
            status: data.status || "Pendente"
          });
        }
      } catch (error) {
        setModal({ isOpen: true, type: "error", title: "Erro", message: "Erro ao carregar o pedido." });
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
      const { error } = await supabase.from("pedidos_oracao").update({
        nome_solicitante: formData.nome_solicitante,
        descricao: formData.descricao,
        visibilidade: formData.visibilidade,
        status: formData.status
      }).eq("id", id);

      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Pedido atualizado com sucesso!" });
      
      setTimeout(() => {
        router.push("/secretaria/oracoes");
      }, 1500);

    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro ao Atualizar", message: error.message });
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    setModal({ ...modal, isOpen: false });
  };

  if (loading) return <div className="w-full h-full flex items-center justify-center text-gray-400">Carregando dados...</div>;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={handleCloseModal} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/secretaria/oracoes" className="text-gray-400 hover:text-white transition-colors mt-1">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Editar Pedido de Oração</h1>
            <p className="text-gray-400 text-sm mt-1">Atualize o status ou os detalhes deste pedido.</p>
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
            <HeartHandshake className="w-5 h-5 text-ohel-blue" />
            <h2 className="text-lg font-semibold text-white">Detalhes do Pedido</h2>
          </div>

          <Input label="Nome do Solicitante *" name="nome_solicitante" value={formData.nome_solicitante} onChange={handleChange} required />
          
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Descrição do Pedido *</label>
            <textarea 
              name="descricao" 
              value={formData.descricao} 
              onChange={handleChange}
              required
              className="input-ohel w-full px-4 py-3 rounded-lg text-sm min-h-[120px] resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Visibilidade</label>
              <select name="visibilidade" value={formData.visibilidade} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                <option value="Público">Público (Todos veem)</option>
                <option value="Privado">Privado (Apenas Liderança)</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                <option value="Pendente">Pendente</option>
                <option value="Em Oração">Em Oração</option>
                <option value="Atendido">Atendido</option>
              </select>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}