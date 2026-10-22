"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { 
  ArrowLeft, Save, BookOpen, Link as LinkIcon, 
  Search, X, Copy, ArrowRightToLine, Loader2, Sparkles, BookMarked 
} from "lucide-react";
import Link from "next/link";

export default function NovoSermaoPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    titulo: "", tema: "", referencia_biblica: "", pastor: "",
    data_pregacao: new Date().toISOString().split('T')[0], 
    esboco: "", link_video: "", link_audio: ""
  });

  // ESTADOS DO MODAL DA BÍBLIA
  const [isBibleModalOpen, setIsBibleModalOpen] = useState(false);
  const [bibleSearch, setBibleSearch] = useState("");
  const [bibleResult, setBibleResult] = useState<any>(null);
  const [isSearchingBible, setIsSearchingBible] = useState(false);
  const [bibleError, setBibleError] = useState("");
  
  // CONTROLE DE ONDE O VERSÍCULO VAI ENTRAR ('base' ou 'outline')
  const [insertionTarget, setInsertionTarget] = useState<'base' | 'outline'>('base');

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) return setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada." });
    
    setSaving(true);
    try {
      const { error } = await supabase.from("sermoes").insert([{
        ...formData,
        igreja_id: igrejaId,
        data_pregacao: formData.data_pregacao || null
      }]);

      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Sermão salvo com sucesso!" });
      setTimeout(() => router.push("/gabinete/sermoes"), 1500);

    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro ao salvar", message: error.message });
      setSaving(false);
    }
  };

  // FUNÇÕES DA BÍBLIA
  const buscarNaBiblia = async (referencia: string) => {
    if (!referencia) return;
    setIsSearchingBible(true);
    setBibleError("");
    setBibleResult(null);

    try {
      const response = await fetch(`https://bible-api.com/${encodeURIComponent(referencia)}?translation=almeida`);
      if (!response.ok) throw new Error("Referência não encontrada. Tente no formato 'João 3:16'.");
      
      const data = await response.json();
      setBibleResult(data);
    } catch (err: any) {
      setBibleError(err.message);
    } finally {
      setIsSearchingBible(false);
    }
  };

  const inserirNoEsboco = () => {
    if (!bibleResult) return;
    const textoParaInserir = `\n\n${bibleResult.reference}\n"${bibleResult.text.trim()}"\n`;
    
    setFormData(prev => {
      const newData = { ...prev, esboco: prev.esboco + textoParaInserir };
      if (insertionTarget === 'base') newData.referencia_biblica = bibleResult.reference;
      return newData;
    });
    
    setIsBibleModalOpen(false);
    setBibleSearch("");
    setBibleResult(null);
  };

  const copiarTexto = () => {
    if (!bibleResult) return;
    navigator.clipboard.writeText(`${bibleResult.reference}\n${bibleResult.text.trim()}`);
    alert("Texto copiado!");
  };

  const abrirBibliaParaBase = () => {
    setInsertionTarget('base');
    const refAtual = formData.referencia_biblica;
    setBibleSearch(refAtual);
    setIsBibleModalOpen(true);
    if (refAtual) buscarNaBiblia(refAtual);
  };

  const abrirBibliaParaEsboco = () => {
    setInsertionTarget('outline');
    setBibleSearch(""); 
    setBibleResult(null);
    setIsBibleModalOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4 pb-10 relative">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Link href="/gabinete/sermoes" className="text-gray-400 hover:text-white transition-colors mt-0.5"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-ohel-blue" /> Novo Sermão
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Registre o esboço e os links da pregação.</p>
          </div>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={saving} className="w-auto px-6 py-2 text-xs">
          <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? "Salvando..." : "Salvar Sermão"}
        </Button>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          
          <div>
            <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-3">Informações da Pregação</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Input label="Título do Sermão *" name="titulo" placeholder="Ex: A Fé que Move Montanhas" value={formData.titulo} onChange={handleChange} required className="py-2 text-xs" />
              </div>
              <Input label="Tema Central" name="tema" placeholder="Ex: Fé e Perseverança" value={formData.tema} onChange={handleChange} className="py-2 text-xs" />
              
              {/* CAMPO DE REFERÊNCIA COM O BOTÃO ACOPLADO */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Referência Bíblica Base</label>
                <div className="relative">
                  <input
                    name="referencia_biblica"
                    value={formData.referencia_biblica}
                    onChange={handleChange}
                    placeholder="Ex: Marcos 11:22-24"
                    className="input-ohel w-full pl-3 pr-24 py-2 rounded-md text-xs"
                  />
                  <button
                    type="button"
                    onClick={abrirBibliaParaBase}
                    className="absolute right-1 top-1 bottom-1 bg-ohel-blue hover:bg-blue-600 text-white text-[10px] font-bold px-3 rounded transition-colors flex items-center gap-1"
                  >
                    <BookOpen className="w-3 h-3" /> Buscar
                  </button>
                </div>
              </div>

              <Input label="Pastor / Preletor" name="pastor" placeholder="Nome de quem pregou" value={formData.pastor} onChange={handleChange} className="py-2 text-xs" />
              <Input label="Data da Pregação" type="date" name="data_pregacao" value={formData.data_pregacao} onChange={handleChange} className="py-2 text-xs" />
            </div>
          </div>

          <div className="border-t border-gray-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider">Esboço / Conteúdo</h3>
              <button 
                type="button"
                onClick={abrirBibliaParaEsboco}
                className="bg-ohel-blue/10 text-ohel-blue hover:bg-ohel-blue hover:text-white px-3 py-1.5 rounded text-[10px] font-bold transition-colors flex items-center gap-1"
              >
                <BookMarked className="w-3 h-3" /> Inserir Versículo
              </button>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <textarea 
                name="esboco" 
                value={formData.esboco} 
                onChange={handleChange}
                placeholder="Digite aqui os tópicos, introdução, desenvolvimento e conclusão do sermão..."
                className="input-ohel w-full px-4 py-3 rounded-lg text-sm min-h-[400px] resize-y leading-relaxed"
              />
            </div>
          </div>

          <div className="border-t border-gray-800 pt-4">
            <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-3 flex items-center gap-2">
              <LinkIcon className="w-3.5 h-3.5" /> Links de Mídia (Opcional)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Link do Vídeo (YouTube)" name="link_video" placeholder="https://youtube.com/..." value={formData.link_video} onChange={handleChange} className="py-2 text-xs" />
              <Input label="Link do Áudio (Spotify/Podcast)" name="link_audio" placeholder="https://spotify.com/..." value={formData.link_audio} onChange={handleChange} className="py-2 text-xs" />
            </div>
          </div>

        </form>
      </Card>

      {/* MODAL DA BÍBLIA ONLINE */}
      {isBibleModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0b0f19] border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            
            <div className="flex items-center justify-between p-5 border-b border-gray-800/50 bg-[#0f1422]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-ohel-blue flex items-center justify-center shadow-[0_0_15px_rgba(0,123,255,0.4)]">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    {insertionTarget === 'base' ? 'Definir Referência Base' : 'Inserir Versículo no Esboço'}
                  </h3>
                  <p className="text-[10px] text-gray-400">João Ferreira de Almeida</p>
                </div>
              </div>
              <button onClick={() => setIsBibleModalOpen(false)} className="text-gray-500 hover:text-white bg-ohel-bg p-1.5 rounded-md transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              
              <div className="flex gap-2 mb-6">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="Ex: João 3:16, Salmos 23..."
                    value={bibleSearch}
                    onChange={(e) => setBibleSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && buscarNaBiblia(bibleSearch)}
                    className="w-full bg-ohel-bg border border-gray-700 text-sm text-white rounded-lg pl-9 pr-4 py-2.5 focus:border-ohel-blue outline-none"
                  />
                </div>
                <Button onClick={() => buscarNaBiblia(bibleSearch)} disabled={isSearchingBible} className="w-auto px-6 py-2.5 bg-ohel-blue text-white rounded-lg">
                  {isSearchingBible ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
                </Button>
              </div>

              <div className="mb-6">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-ohel-blue" /> Passagens Frequentes:
                </p>
                <div className="flex flex-wrap gap-2">
                  {["João 3:16", "Salmos 23:1-6", "Romanos 8:28", "Filipenses 4:13", "Provérbios 3:5-6", "Isaías 53:5"].map(ref => (
                    <button 
                      key={ref}
                      onClick={() => { setBibleSearch(ref); buscarNaBiblia(ref); }}
                      className="bg-ohel-surface border border-gray-700 hover:border-ohel-blue hover:text-white text-gray-300 text-xs px-3 py-1.5 rounded-full transition-colors"
                    >
                      {ref}
                    </button>
                  ))}
                </div>
              </div>

              {bibleError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg text-sm text-center">
                  {bibleError}
                </div>
              )}

              {bibleResult && (
                <div className="bg-ohel-surface border border-gray-800 rounded-xl overflow-hidden animate-in slide-in-from-bottom-2">
                  <div className="bg-ohel-blue/10 border-b border-ohel-blue/20 p-4 flex justify-between items-center">
                    <h4 className="text-base font-bold text-ohel-blue">{bibleResult.reference}</h4>
                    <span className="text-[10px] bg-ohel-bg text-gray-400 px-2 py-1 rounded border border-gray-800">Almeida</span>
                  </div>
                  <div className="p-5 text-justify text-sm text-gray-200 leading-relaxed space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                    <p>{bibleResult.text}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-[#0f1422] border-t border-gray-800/50 flex justify-end gap-3">
              <button 
                onClick={copiarTexto}
                disabled={!bibleResult}
                className="px-4 py-2 text-xs font-medium text-gray-300 hover:text-white bg-ohel-bg border border-gray-700 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Copy className="w-3.5 h-3.5" /> Copiar Texto
              </button>
              <button 
                onClick={inserirNoEsboco}
                disabled={!bibleResult}
                className="px-5 py-2 text-xs font-bold text-white bg-ohel-blue hover:bg-blue-600 rounded-md transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(0,123,255,0.3)] disabled:opacity-50"
              >
                <ArrowRightToLine className="w-3.5 h-3.5" /> 
                {insertionTarget === 'base' ? 'Definir como Base' : 'Inserir no Esboço'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}