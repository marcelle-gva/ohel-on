"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, Image as ImageIcon, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function EditarComunicacaoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    titulo: "", conteudo: "", imagem_url: ""
  });

  useEffect(() => {
    const fetchDados = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase.from('comunicacoes').select('*').eq('id', id).single();
        if (error) throw error;

        if (data) {
          setFormData({
            titulo: data.titulo || "", 
            conteudo: data.conteudo || "", 
            imagem_url: data.imagem_url || ""
          });
        }
      } catch (error) {
        setModal({ isOpen: true, type: "error", title: "Erro", message: "Erro ao carregar a comunicação." });
      } finally {
        setLoading(false);
      }
    };
    fetchDados();
  }, [id]);

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
    setSaving(true);
    try {
      const { error } = await supabase.from("comunicacoes").update({
        titulo: formData.titulo,
        conteudo: formData.conteudo,
        imagem_url: formData.imagem_url || null
      }).eq("id", id);

      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Comunicação atualizada com sucesso!" });
      
      setTimeout(() => {
        router.push("/secretaria/mural");
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
    <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={handleCloseModal} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/secretaria/mural" className="text-gray-400 hover:text-white transition-colors mt-1">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Editar Comunicação</h1>
            <p className="text-gray-400 text-sm mt-1">Atualize o aviso publicado no mural.</p>
          </div>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={saving || uploading} className="w-full md:w-auto px-8 shrink-0">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      <Card className="p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          <Input label="Título do Aviso *" name="titulo" value={formData.titulo} onChange={handleChange} required />
          
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Mensagem / Conteúdo *</label>
            <textarea 
              name="conteudo" 
              value={formData.conteudo} 
              onChange={handleChange}
              required
              className="input-ohel w-full px-4 py-3 rounded-lg text-sm min-h-[150px] resize-y"
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-800 pt-6">
            <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Imagem de Capa (Opcional)</label>
            
            {formData.imagem_url ? (
              <div className="relative w-full h-64 rounded-xl overflow-hidden border border-gray-700">
                <Image src={formData.imagem_url} alt="Capa" fill sizes="(max-width: 768px) 100vw, 800px" className="object-cover" />
                <button 
                  type="button" 
                  onClick={() => setFormData({...formData, imagem_url: ""})}
                  className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-md hover:bg-red-500 transition-colors"
                >
                  Remover
                </button>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 bg-ohel-bg border border-dashed border-gray-700 hover:border-ohel-blue rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors group"
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-ohel-blue animate-spin mb-2" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-gray-500 group-hover:text-ohel-blue mb-2 transition-colors" />
                )}
                <span className="text-sm text-gray-400 group-hover:text-white transition-colors">
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