"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, Award } from "lucide-react";
import Link from "next/link";

export default function EditarModeloCertificadoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({ nome: "", conteudo: "" });

  const variaveis = [
    { tag: "{{nome}}", desc: "Nome Completo" },
    { tag: "{{cargo}}", desc: "Cargo Atual" },
    { tag: "{{data_atual}}", desc: "Data de Hoje" },
  ];

  useEffect(() => {
    const fetchModelo = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase.from('modelos_certificados').select('*').eq('id', id).single();
        if (error) throw error;
        if (data) setFormData({ nome: data.nome, conteudo: data.conteudo });
      } catch (error) {
        setModal({ isOpen: true, type: "error", title: "Erro", message: "Erro ao carregar." });
      } finally {
        setLoading(false);
      }
    };
    fetchModelo();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const insertVariavel = (tag: string) => {
    setFormData(prev => ({ ...prev, conteudo: prev.conteudo + " " + tag + " " }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from("modelos_certificados").update({
        nome: formData.nome,
        conteudo: formData.conteudo
      }).eq("id", id);

      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Modelo atualizado!" });
      setTimeout(() => router.push("/secretaria/certificados/modelos"), 1500);
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando...</div>;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Link href="/secretaria/certificados/modelos" className="text-gray-400 hover:text-white transition-colors mt-0.5"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Editar Modelo de Certificado</h1>
            <p className="text-gray-400 text-xs mt-0.5">Atualize o texto do certificado.</p>
          </div>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={saving} className="w-auto px-6 py-2 text-xs">
          <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        <Card className="p-6 lg:col-span-2 flex flex-col gap-4">
          <Input label="Nome do Modelo *" name="nome" value={formData.nome} onChange={handleChange} required className="py-2 text-xs" />
          
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Corpo do Certificado *</label>
            <textarea 
              name="conteudo" 
              value={formData.conteudo} 
              onChange={handleChange}
              required
              className="input-ohel w-full px-4 py-3 rounded-lg text-sm min-h-[250px] resize-y leading-relaxed"
            />
          </div>
        </Card>

        <Card className="p-5 flex flex-col gap-3 bg-ohel-surface/50 h-fit">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-1">
            <Award className="w-4 h-4 text-ohel-blue" />
            <h3 className="text-sm font-bold text-white">Variáveis</h3>
          </div>
          <p className="text-[11px] text-gray-400 mb-2">Clique para inserir no texto.</p>
          
          <div className="flex flex-col gap-2">
            {variaveis.map(v => (
              <button 
                key={v.tag} 
                type="button" 
                onClick={() => insertVariavel(v.tag)}
                className="flex flex-col items-start bg-ohel-bg border border-gray-800 hover:border-ohel-blue/50 p-2 rounded text-left transition-colors group"
              >
                <span className="text-[11px] font-mono text-ohel-blue font-bold">{v.tag}</span>
                <span className="text-[10px] text-gray-500 mt-0.5">{v.desc}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}