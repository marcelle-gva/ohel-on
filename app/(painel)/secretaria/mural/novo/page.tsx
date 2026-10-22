"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, Image as ImageIcon, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function NovaComunicacaoPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({ titulo: "", conteudo: "", imagem_url: "" });

  useEffect(() => {
    const initPage = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) setIgrejaId(user.igreja_id);
      }
    };
    initPage();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUploadImagem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('comunicacoes').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('comunicacoes').getPublicUrl(fileName);
      setFormData({ ...formData, imagem_url: data.publicUrl });
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro no Upload", message: "Não foi possível enviar a imagem." });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) return setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada." });
    
    setLoading(true);
    try {
      const { error } = await supabase.from("comunicacoes").insert([{
        igreja_id: igrejaId,
        titulo: formData.titulo,
        conteudo: formData.conteudo,
        imagem_url: formData.imagem_url || null
      }]);

      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Comunicação publicada com sucesso!" });
      setTimeout(() => router.push("/secretaria/mural"), 1500);
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
          <Link href="/secretaria/mural" className="text-gray-400 hover:text-white transition-colors mt-0.5"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Nova Comunicação</h1>
            <p className="text-gray-400 text-xs mt-0.5">Publique um aviso no mural da igreja.</p>
          </div>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={loading || uploading} className="w-auto px-6 py-2 text-xs">
          <Save className="w-3.5 h-3.5 mr-1.5" /> {loading ? "Publicando..." : "Publicar Aviso"}
        </Button>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          
          <div>
            <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-3">Conteúdo do Aviso</h3>
            <div className="flex flex-col gap-3">
              <Input label="Título do Aviso *" name="titulo" placeholder="Ex: Culto de Santa Ceia" value={formData.titulo} onChange={handleChange} required className="py-2 text-xs" />
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Mensagem *</label>
                <textarea 
                  name="conteudo" 
                  value={formData.conteudo} 
                  onChange={handleChange}
                  placeholder="Escreva os detalhes do aviso aqui..."
                  required
                  className="input-ohel w-full px-3 py-2 rounded-md text-xs min-h-[120px] resize-y"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-4">
            <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-3">Imagem de Capa (Opcional)</h3>
            
            {formData.imagem_url ? (
              <div className="relative w-full h-48 rounded-lg overflow-hidden border border-gray-700">
                <Image src={formData.imagem_url} alt="Capa" fill sizes="800px" className="object-cover" />
                <button 
                  type="button" 
                  onClick={() => setFormData({...formData, imagem_url: ""})}
                  className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded hover:bg-red-500 transition-colors"
                >
                  Remover
                </button>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-24 bg-ohel-bg border border-dashed border-gray-700 hover:border-ohel-blue rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors group"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 text-ohel-blue animate-spin mb-1" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-gray-500 group-hover:text-ohel-blue mb-1 transition-colors" />
                )}
                <span className="text-xs text-gray-400 group-hover:text-white transition-colors">
                  {uploading ? "Enviando imagem..." : "Clique para fazer upload da capa"}
                </span>
              </div>
            )}
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleUploadImagem} className="hidden" />
          </div>

        </form>
      </Card>
    </div>
  );
}