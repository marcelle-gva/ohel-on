"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { BibleSearchModal } from "@/components/ui/BibleSearchModal";
import { Logo } from "@/components/brand/Logo";
import { CheckCircle, Music, BookOpen, Search, Loader2, Wand2 } from "lucide-react";

export default function PublicWorshipForm() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const igrejaId = params.id;

  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "error" as "success" | "error", title: "", message: "" });
  const [isBibleModalOpen, setIsBibleModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    titulo: "", tom: "", ministro: "", link_cifra: "", link_video: "", palavra_vinculada: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const transformarEmChordPro = () => {
    const textoOriginal = formData.link_cifra;
    if (!textoOriginal) return setModal({ isOpen: true, type: "error", title: "Aviso", message: "Cole algum texto primeiro." });

    const linhas = textoOriginal.split('\n');
    let textoFinal: string[] = [];
    
    const isChordLine = (linha: string) => {
      const palavras = linha.trim().split(/\s+/);
      if (palavras.length === 0) return false;
      return palavras.every(p => /^[A-G][#b]?(m|maj|min|dim|aug|sus|add|º|°)?[0-9]*(?:\/[A-G][#b]?)?$/.test(p));
    };

    for (let i = 0; i < linhas.length; i++) {
      if (isChordLine(linhas[i]) && i + 1 < linhas.length && !isChordLine(linhas[i + 1])) {
        let novaLinha = "";
        let lastIndex = 0;
        const regexAcorde = /[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|º|°)?[0-9]*(?:\/[A-G][#b]?)?/g;
        let match;

        while ((match = regexAcorde.exec(linhas[i])) !== null) {
          const posicao = match.index;
          if (posicao > lastIndex) {
            novaLinha += linhas[i + 1].substring(lastIndex, posicao).padEnd(posicao - lastIndex, " ");
            lastIndex = Math.max(lastIndex, posicao);
          }
          novaLinha += `[${match[0]}]`;
        }
        if (lastIndex < linhas[i + 1].length) novaLinha += linhas[i + 1].substring(lastIndex);

        textoFinal.push(novaLinha.trim());
        i++;
      } else {
        textoFinal.push(linhas[i]);
      }
    }
    setFormData({ ...formData, link_cifra: textoFinal.join('\n') });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId || !formData.titulo) return;

    setLoading(true);
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('louvores').insert([{
        igreja_id: igrejaId,
        titulo: formData.titulo,
        tom: formData.tom,
        ministro: formData.ministro,
        link_cifra: formData.link_cifra,
        link_video: formData.link_video,
        palavra_vinculada: formData.palavra_vinculada,
        data: hoje
      }]);

      if (error) throw error;
      setSucesso(true);
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Não foi possível adicionar a música." });
    } finally {
      setLoading(false);
    }
  };

  if (sucesso) {
    return (
      <div className="w-full min-h-screen bg-ohel-bg flex items-center justify-center p-4 bg-ohel-glow">
        <Card className="w-full max-w-md p-8 flex flex-col items-center text-center animate-in zoom-in-95">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Música Adicionada!</h1>
          <p className="text-gray-400 text-sm mb-8">Ela já está no telão.</p>
          <Button onClick={() => { setSucesso(false); setFormData({ titulo: "", tom: "", ministro: "", link_cifra: "", link_video: "", palavra_vinculada: "" }); }} variant="primary" className="w-full">
            Adicionar Outra
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-ohel-bg flex flex-col items-center py-8 px-4 bg-ohel-glow">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />
      
      <BibleSearchModal 
        isOpen={isBibleModalOpen} 
        onClose={() => setIsBibleModalOpen(false)} 
        onSelect={(texto) => { setFormData(prev => ({ ...prev, palavra_vinculada: texto })); setIsBibleModalOpen(false); }} 
      />

      <div className="mb-6 mt-2 scale-90">
        <Logo />
      </div>

      <Card className="w-full max-w-md p-6 border-gray-800">
        <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Music className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Adicionar Música</h1>
            <p className="text-xs text-gray-400">Ministério de Louvor</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Nome da Música *" name="titulo" placeholder="Ex: Oceanos" value={formData.titulo} onChange={handleChange} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Tom *" name="tom" placeholder="Ex: G" value={formData.tom} onChange={handleChange} required />
            <Input label="Ministro" name="ministro" placeholder="Quem canta?" value={formData.ministro} onChange={handleChange} />
          </div>

          <div className="flex justify-between items-center mt-2">
             <label className="text-xs font-semibold text-ohel-silver uppercase">Letra / Cifra</label>
             <button type="button" onClick={transformarEmChordPro} className="text-[10px] bg-ohel-blue/10 text-ohel-blue px-2 py-1 rounded flex items-center gap-1">
                <Wand2 className="w-3 h-3" /> Converter
             </button>
          </div>
          <textarea 
            name="link_cifra" placeholder="Cole a cifra..." value={formData.link_cifra} onChange={handleChange}
            className="input-ohel w-full px-4 py-3 rounded-lg text-sm min-h-[150px] font-mono resize-y"
          />

          <button type="button" onClick={() => setIsBibleModalOpen(true)} className="flex items-center justify-between bg-ohel-bg border border-gray-700 text-sm text-gray-400 rounded-md px-4 py-2.5 hover:border-ohel-blue">
             <span className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-ohel-blue" /> Palavra Vinculada</span>
             <Search className="w-4 h-4" />
          </button>
          {formData.palavra_vinculada && (
             <p className="text-[10px] text-gray-400 line-clamp-2 italic">"{formData.palavra_vinculada}"</p>
          )}

          <Button type="submit" variant="primary" disabled={loading} className="mt-4 py-3 w-full">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : "Adicionar ao Telão"}
          </Button>
        </form>
      </Card>
    </div>
  );
}