"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Send, Users, Image as ImageIcon, Paperclip, Loader2, CheckCheck } from "lucide-react";
import Link from "next/link";

export default function NovaComunicacaoPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    publico_alvo: "Todos os Membros",
    mensagem: "",
    anexo_nome: ""
  });

  const publicos = [
    "Todos os Membros", "Aniversariantes do Mês", "Líderes e Pastores", 
    "Membros Novos", "Congregados", "Visitantes", "Departamento de Louvor"
  ];

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) setIgrejaId(user.igreja_id);
      }
    };
    init();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFormData({ ...formData, anexo_nome: file.name });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) return setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada." });
    if (!formData.mensagem) return setModal({ isOpen: true, type: "error", title: "Atenção", message: "Digite a mensagem que será enviada." });
    
    setLoading(true);
    try {
      // Aqui, no futuro, chamaremos a API do WhatsApp.
      // Por enquanto, apenas salvamos o registro de que a comunicação foi disparada.
      
      const { error } = await supabase.from("comunicacoes_pastorais").insert([{
        igreja_id: igrejaId,
        mensagem: formData.mensagem,
        publico_alvo: formData.publico_alvo,
        anexo_nome: formData.anexo_nome || null,
        status: 'Enviado' // Simulando envio imediato
      }]);

      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Enviado!", message: "A comunicação foi registrada e está pronta para integração com o WhatsApp." });
      setTimeout(() => router.push("/gabinete/comunicacoes"), 1500);

    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro ao enviar", message: error.message });
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex items-center gap-3">
        <Link href="/gabinete/comunicacoes" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Nova Comunicação</h1>
          <p className="text-gray-400 text-xs mt-0.5">Prepare a mensagem e visualize como ela chegará no celular.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Lado Esquerdo: Formulário */}
        <Card className="p-6 border-gray-800 bg-ohel-surface">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Público-Alvo *</label>
              <select name="publico_alvo" value={formData.publico_alvo} onChange={handleChange} className="input-ohel w-full px-3 py-2.5 rounded-md text-xs">
                {publicos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Mensagem *</label>
              <textarea 
                name="mensagem" 
                value={formData.mensagem} 
                onChange={handleChange}
                placeholder="Olá irmão(ã), a paz do Senhor! Passando para avisar que..."
                className="input-ohel w-full px-3 py-2 rounded-md text-xs min-h-[150px] resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Anexo (Foto ou PDF)</label>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              <div onClick={() => fileInputRef.current?.click()} className="border border-dashed border-gray-700 hover:border-ohel-blue rounded-lg p-4 flex items-center gap-3 cursor-pointer transition-colors bg-ohel-bg">
                <ImageIcon className="w-5 h-5 text-gray-500" />
                <span className="text-xs text-gray-400">{formData.anexo_nome || "Clique para selecionar um arquivo"}</span>
              </div>
            </div>

            <Button type="submit" variant="primary" disabled={loading} className="mt-2 w-full py-2.5 text-xs bg-green-500 hover:bg-green-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</> : <><Send className="w-4 h-4 mr-2" /> Disparar Mensagem</>}
            </Button>

          </form>
        </Card>

        {/* Lado Direito: Preview WhatsApp */}
        <div className="flex flex-col items-center justify-center bg-[#0b141a] rounded-xl border border-gray-800 p-6 relative overflow-hidden">
          {/* Fundo de conversa do Whats */}
          <div className="absolute inset-0 opacity-10 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-cover"></div>
          
          <div className="w-full max-w-[320px] bg-[#efeae2] rounded-2xl shadow-2xl overflow-hidden relative z-10 border-4 border-gray-900">
            
            {/* Header Whats */}
            <div className="bg-[#075e54] text-white p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
                <Users className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <h4 className="text-sm font-bold">{formData.publico_alvo}</h4>
                <p className="text-[10px] text-green-100">online</p>
              </div>
            </div>

            {/* Área de mensagens */}
            <div className="p-4 min-h-[300px] flex flex-col justify-end">
              <div className="bg-white rounded-lg p-2 rounded-tr-none shadow-sm self-end max-w-[90%] relative">
                {formData.anexo_nome && (
                  <div className="bg-gray-100 p-2 rounded flex items-center gap-2 mb-2 border border-gray-200">
                    <Paperclip className="w-4 h-4 text-gray-500" />
                    <span className="text-[10px] text-gray-700 truncate">{formData.anexo_nome}</span>
                  </div>
                )}
                <p className="text-xs text-gray-800 whitespace-pre-wrap break-words">
                  {formData.mensagem || "Digite a mensagem ao lado para ver o preview..."}
                </p>
                <div className="flex justify-end items-center gap-1 mt-1">
                  <span className="text-[9px] text-gray-400">{new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                  <CheckCheck className="w-3 h-3 text-blue-500" />
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}