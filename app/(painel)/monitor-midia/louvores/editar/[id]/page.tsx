"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { BibleSearchModal } from "@/components/ui/BibleSearchModal"; // Importando o novo modal
import { ArrowLeft, Search, BookOpen, Loader2, Save, Wand2, Eye, X } from "lucide-react";

export default function FormularioLouvorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string; // Se tiver ID, é edição. Se não, é novo.
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing); // Se for edição, já começa carregando
  const [saving, setSaving] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  // Modal da Bíblia
  const [isBibleModalOpen, setIsBibleModalOpen] = useState(false);

  // Estados do Formulário
  const [formData, setFormData] = useState({
    titulo: "", tom: "", ministro: "", link_cifra: "", link_video: "", palavra_vinculada: ""
  });

  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) setIgrejaId(user.igreja_id);
      }

      // Se for edição, busca os dados do louvor
      if (isEditing) {
        const { data, error } = await supabase.from('louvores').select('*').eq('id', id).single();
        if (data) {
          setFormData({
            titulo: data.titulo || "", tom: data.tom || "", ministro: data.ministro || "",
            link_cifra: data.link_cifra || "", link_video: data.link_video || "", palavra_vinculada: data.palavra_vinculada || ""
          });
          setShowPreview(true);
        }
        setLoading(false);
      }
    };
    init();
  }, [id, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const transformarEmChordPro = () => {
    const textoOriginal = formData.link_cifra;
    if (!textoOriginal) return setModal({ isOpen: true, type: "error", title: "Aviso", message: "Cole algum texto no campo da cifra primeiro." });

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
    setShowPreview(true);
    setModal({ isOpen: true, type: "success", title: "Conversão Concluída", message: "Verifique o texto no preview abaixo." });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId || !formData.titulo) return setModal({ isOpen: true, type: "error", title: "Atenção", message: "O título da música é obrigatório." });
    
    setSaving(true);
    try {
      const payload = {
        igreja_id: igrejaId,
        titulo: formData.titulo,
        tom: formData.tom,
        ministro: formData.ministro,
        link_cifra: formData.link_cifra,
        link_video: formData.link_video,
        palavra_vinculada: formData.palavra_vinculada
      };

      if (isEditing) {
        const { error } = await supabase.from('louvores').update(payload).eq('id', id);
        if (error) throw error;
        setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Música atualizada com sucesso!" });
      } else {
        const { error } = await supabase.from('louvores').insert([{ ...payload, data: new Date().toISOString().split('T')[0] }]);
        if (error) throw error;
        setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Música adicionada ao repertório!" });
      }
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    setModal({ ...modal, isOpen: false });
    if (modal.title === "Sucesso") router.push("/monitor-midia");
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando dados...</div>;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={handleCloseModal} type={modal.type} title={modal.title} message={modal.message} />
      
      {/* MODAL DA BÍBLIA INTEGRADO */}
      <BibleSearchModal 
        isOpen={isBibleModalOpen} 
        onClose={() => setIsBibleModalOpen(false)} 
        onSelect={(texto) => {
          setFormData(prev => ({ ...prev, palavra_vinculada: texto }));
          setIsBibleModalOpen(false);
        }} 
      />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/monitor-midia" className="text-gray-400 hover:text-white transition-colors mt-1">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{isEditing ? "Editar Louvor" : "Adicionar Louvor"}</h1>
            <p className="text-gray-400 text-sm mt-1">{isEditing ? "Ajuste a letra ou crie um Pot-pourri." : "Cadastre uma nova música no repertório."}</p>
          </div>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={saving} className="w-full md:w-auto px-8 shrink-0">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvando..." : "Salvar no Repertório"}
        </Button>
      </div>

      <Card className="p-8 border-gray-800">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input label="Título da Música *" name="titulo" value={formData.titulo} onChange={handleChange} required />
            <Input label="Tom" name="tom" placeholder="Ex: G, A, Em" value={formData.tom} onChange={handleChange} />
            <Input label="Ministro" name="ministro" placeholder="Quem vai cantar?" value={formData.ministro} onChange={handleChange} />
            <Input label="Link do Vídeo" name="link_video" placeholder="https://youtube.com/..." value={formData.link_video} onChange={handleChange} />
          </div>

          {/* ÁREA DA CIFRA */}
          <div className="border-t border-gray-800 pt-5 mt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Cifra e Letra</label>
              <Button type="button" variant="secondary" onClick={transformarEmChordPro} className="w-auto px-4 py-1.5 text-xs bg-ohel-blue/10 text-ohel-blue border-ohel-blue/30 hover:bg-ohel-blue hover:text-white">
                <Wand2 className="w-3.5 h-3.5 mr-2" /> Transformar em ChordPro
              </Button>
            </div>
            
            <textarea 
              name="link_cifra"
              placeholder="Cole aqui a cifra copiada do site... (Para fazer Pot-pourri, basta colar a letra de outra música aqui embaixo)." 
              value={formData.link_cifra} 
              onChange={handleChange}
              className="input-ohel w-full px-4 py-3 rounded-lg text-sm min-h-[300px] resize-y font-mono"
            />

            {showPreview && formData.link_cifra && (
              <div className="mt-4 border border-gray-800 rounded-lg overflow-hidden">
                <div className="bg-ohel-surface px-4 py-2 text-xs font-bold text-white flex items-center gap-2 border-b border-gray-800">
                  <Eye className="w-4 h-4 text-green-400" /> Preview (Telão)
                </div>
                <div className="p-4 bg-[#03060D] text-sm text-gray-300 whitespace-pre-wrap font-mono overflow-x-auto max-h-[300px]">
                  {formData.link_cifra.split('\n').map((linha, idx) => {
                    const partes = linha.split(/(\[[^\]]+\])/g);
                    return (
                      <div key={idx} className="mb-1">
                        {partes.map((parte, i) => parte.startsWith('[') ? <span key={i} className="text-ohel-blue font-bold">{parte}</span> : <span key={i}>{parte}</span>)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ÁREA DA BÍBLIA (ATUALIZADA) */}
          <div className="border-t border-gray-800 pt-5 mt-2">
            <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider mb-2 block">
              Palavra Vinculada
            </label>
            <div className="flex gap-2 mb-3">
              <button 
                type="button"
                onClick={() => setIsBibleModalOpen(true)}
                className="flex-1 flex items-center justify-between bg-ohel-bg border border-gray-700 text-sm text-gray-400 rounded-md px-4 py-3 hover:border-ohel-blue transition-colors"
              >
                <span className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-ohel-blue" /> Buscar passagem bíblica...</span>
                <Search className="w-4 h-4" />
              </button>
            </div>
            <textarea 
              name="palavra_vinculada"
              placeholder="O texto aparecerá aqui..." 
              value={formData.palavra_vinculada} 
              onChange={handleChange}
              className="input-ohel w-full px-4 py-3 rounded-lg text-sm min-h-[80px] resize-y"
            />
          </div>
        </form>
      </Card>
    </div>
  );
}