"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, AlignLeft, Bold, Italic, Underline, List, Image as ImageIcon, Search, Eye, FileText, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function EditarModeloCartaPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const editorRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    nome: "", tipo_cabecalho: "padrao", tipo_rodape: "padrao", texto_rodape: "", conteudo: ""
  });

  const [buscaVar, setBuscaVar] = useState("");

  const variaveis = [
    { cat: "Dados Pessoais", items: [
      { tag: "{{nome}}", desc: "Nome Completo" }, { tag: "{{cpf}}", desc: "CPF" },
      { tag: "{{rg}}", desc: "RG" }, { tag: "{{data_nascimento}}", desc: "Data de Nascimento" },
    ]},
    { cat: "Dados Eclesiásticos", items: [
      { tag: "{{cargo}}", desc: "Cargo Atual" }, { tag: "{{congregacao}}", desc: "Congregação" },
      { tag: "{{data_batismo}}", desc: "Data de Batismo" },
    ]},
    { cat: "Sistema / Igreja", items: [
      { tag: "{{denominacao}}", desc: "Nome da Igreja" }, { tag: "{{data_atual}}", desc: "Data de Hoje" },
    ]}
  ];

  useEffect(() => {
    const fetchModelo = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase.from('modelos_cartas').select('*').eq('id', id).single();
        if (error) throw error;

        if (data) {
          setFormData({
            nome: data.nome || "", tipo_cabecalho: data.tipo_cabecalho || "padrao",
            tipo_rodape: data.tipo_rodape || "padrao", texto_rodape: data.texto_rodape || "", conteudo: data.conteudo || ""
          });
          if (editorRef.current) {
            editorRef.current.innerHTML = data.conteudo || "";
          }
        }
      } catch (error) {
        setModal({ isOpen: true, type: "error", title: "Erro", message: "Erro ao carregar." });
      } finally {
        setLoading(false);
      }
    };
    fetchModelo();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEditorInput = () => {
    if (editorRef.current) setFormData({ ...formData, conteudo: editorRef.current.innerHTML });
  };

  const execCommand = (command: string) => {
    document.execCommand(command, false);
    handleEditorInput();
  };

  const insertVariavel = (tag: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand("insertText", false, tag);
      handleEditorInput();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const conteudoFinal = editorRef.current?.innerHTML || "";
      const { error } = await supabase.from("modelos_cartas").update({
        nome: formData.nome, tipo_cabecalho: formData.tipo_cabecalho,
        tipo_rodape: formData.tipo_rodape, texto_rodape: formData.texto_rodape, conteudo: conteudoFinal
      }).eq("id", id);

      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Modelo atualizado!" });
      setTimeout(() => router.push("/secretaria/cartas/modelos"), 1500);
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando modelo...</div>;

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-4 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Link href="/secretaria/cartas/modelos" className="text-gray-400 hover:text-white transition-colors mt-0.5"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2"><FileText className="w-5 h-5 text-ohel-blue"/> Editar Modelo</h1>
            <p className="text-gray-400 text-xs mt-0.5">Atualize o texto ou layout da carta.</p>
          </div>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={saving} className="w-auto px-6 py-2 text-xs">
          <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* COLUNA ESQUERDA: Editor */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-xl p-5">
            <Input label="Descrição da Carta *" name="nome" value={formData.nome} onChange={handleChange} required className="py-2 text-xs mb-5" />
            
            <div className="mb-5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider mb-2 block">Tipo de Cabeçalho</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setFormData({...formData, tipo_cabecalho: "padrao"})} className={`flex-1 flex items-center gap-3 p-3 rounded-lg border text-left ${formData.tipo_cabecalho === "padrao" ? "border-ohel-blue bg-ohel-blue/5" : "border-gray-800 bg-ohel-bg"}`}>
                  <div className={`w-3 h-3 rounded-full border ${formData.tipo_cabecalho === "padrao" ? "border-ohel-blue bg-ohel-blue" : "border-gray-500"}`}></div>
                  <p className="text-xs font-bold text-white">Padrão Sistema</p>
                </button>
                <button type="button" onClick={() => setFormData({...formData, tipo_cabecalho: "custom"})} className={`flex-1 flex items-center gap-3 p-3 rounded-lg border text-left ${formData.tipo_cabecalho === "custom" ? "border-ohel-blue bg-ohel-blue/5" : "border-gray-800 bg-ohel-bg"}`}>
                  <div className={`w-3 h-3 rounded-full border ${formData.tipo_cabecalho === "custom" ? "border-ohel-blue bg-ohel-blue" : "border-gray-500"}`}></div>
                  <p className="text-xs font-bold text-white">Personalizado</p>
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlignLeft className="w-3.5 h-3.5 text-ohel-blue" /> Corpo da Carta (Texto Rico) *
              </label>
              
              <div className="flex items-center gap-1 border border-gray-800 bg-ohel-bg p-2 rounded-t-lg border-b-0 flex-wrap">
                <button type="button" onClick={() => execCommand("bold")} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"><Bold className="w-4 h-4"/></button>
                <button type="button" onClick={() => execCommand("italic")} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"><Italic className="w-4 h-4"/></button>
                <button type="button" onClick={() => execCommand("underline")} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"><Underline className="w-4 h-4"/></button>
                <div className="w-px h-4 bg-gray-700 mx-1"></div>
                <button type="button" onClick={() => execCommand("insertUnorderedList")} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"><List className="w-4 h-4"/></button>
              </div>

              <div 
                ref={editorRef}
                contentEditable
                onInput={handleEditorInput}
                className="input-ohel w-full px-5 py-6 rounded-b-lg text-sm min-h-[350px] outline-none overflow-y-auto leading-relaxed"
                style={{ whiteSpace: 'pre-wrap' }}
              ></div>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: Variáveis */}
        <div className="flex flex-col gap-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-xl p-5">
            <div className="flex justify-between items-center mb-3 border-b border-gray-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-ohel-blue" /> Dados Variáveis</h3>
            </div>
            
            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute left-3 top-2 text-gray-500" />
              <input type="text" placeholder="Filtrar..." value={buscaVar} onChange={e => setBuscaVar(e.target.value)} className="w-full bg-ohel-bg border border-gray-800 text-xs text-white rounded-md pl-9 pr-3 py-2 outline-none" />
            </div>

            <div className="flex flex-col gap-4 max-h-[380px] overflow-y-auto pr-1">
              {variaveis.map(grupo => {
                const itemsFiltrados = grupo.items.filter(i => i.desc.toLowerCase().includes(buscaVar.toLowerCase()));
                if (itemsFiltrados.length === 0) return null;
                return (
                  <div key={grupo.cat}>
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2">{grupo.cat}</h4>
                    <div className="flex flex-col gap-2">
                      {itemsFiltrados.map(item => (
                        <button key={item.tag} type="button" onClick={() => insertVariavel(item.tag)} className="bg-ohel-bg border border-gray-800 hover:border-ohel-blue p-2.5 rounded text-left transition-colors group">
                          <p className="text-xs text-white font-medium">{item.desc}</p>
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">{item.tag}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}