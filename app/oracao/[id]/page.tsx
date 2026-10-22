"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { Logo } from "@/components/brand/Logo";
import { HeartHandshake, CheckCircle, Loader2 } from "lucide-react";

export default function PedidoOracaoPublicPage() {
  const params = useParams<{ id: string }>();
  const igrejaId = params.id;

  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "error" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({ nome: "", descricao: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId || !formData.descricao) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('pedidos_oracao').insert([{
        igreja_id: igrejaId,
        nome_solicitante: formData.nome || "Anônimo",
        descricao: formData.descricao,
        status: "Pendente"
      }]);

      if (error) throw error;
      
      setSucesso(true);
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Não foi possível enviar seu pedido. Tente novamente." });
    } finally {
      setLoading(false);
    }
  };

  if (sucesso) {
    return (
      <div className="w-full min-h-screen bg-ohel-bg flex items-center justify-center p-4 bg-ohel-glow">
        <Card className="w-full max-w-md p-8 flex flex-col items-center text-center animate-in zoom-in-95">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Pedido Recebido!</h1>
          <p className="text-gray-400 text-sm mb-8">Sua oração foi enviada para a equipe pastoral. Estaremos orando por você.</p>
          <Button onClick={() => { setSucesso(false); setFormData({ nome: "", descricao: "" }); }} variant="secondary" className="w-full">
            Enviar outro pedido
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-ohel-bg flex flex-col items-center py-8 px-4 bg-ohel-glow">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />
      
      <div className="mb-8 mt-4 scale-90">
        <Logo />
      </div>

      <Card className="w-full max-w-md p-6 border-gray-800">
        <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
            <HeartHandshake className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Pedido de Oração</h1>
            <p className="text-xs text-gray-400">Nossa equipe orará por você.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input 
            label="Seu Nome (Opcional)" 
            placeholder="Deixe em branco para anônimo" 
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
          />
          
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Pedido de Oração *</label>
            <textarea 
              placeholder="Escreva aqui o motivo da sua oração..." 
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              required
              className="input-ohel w-full px-4 py-3 rounded-lg text-sm min-h-[120px] resize-y"
            />
          </div>

          <Button type="submit" variant="primary" disabled={loading} className="mt-2 py-3 w-full bg-red-500 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : "Enviar Pedido de Oração"}
          </Button>
        </form>
      </Card>
    </div>
  );
}