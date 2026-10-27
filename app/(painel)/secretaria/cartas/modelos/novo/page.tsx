"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, AlignLeft, Bold, Italic, Underline, List, Search, X, Eye, FileText, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { buildLetterHtml, sanitizeLetterHtml } from "@/lib/cartas";

export default function NovoModeloCartaPage() {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    nome: "", 
    tipo_cabecalho: "padrao",
    tipo_rodape: "padrao",
    texto_rodape: "",
    imagem_cabecalho_url: "",
    conteudo: ""
  });

  const [buscaVar, setBuscaVar] = useState("");

  const variaveis = [
    { cat: "Dados Pessoais", items: [
      { tag: "{{nome}}", desc: "Nome Completo" },
      { tag: "{{cpf}}", desc: "CPF" },
      { tag: "{{rg}}", desc: "RG" },
      { tag: "{{data_nascimento}}", desc: "Data de Nascimento" },
      { tag: "{{email}}", desc: "E-mail" },
      { tag: "{{telefone}}", desc: "Telefone" },
      { tag: "{{endereco}}", desc: "Endereço" },
    ]},
    { cat: "Dados Eclesiásticos", items: [
      { tag: "{{cargo}}", desc: "Cargo Atual" },
      { tag: "{{congregacao}}", desc: "Congregação" },
      { tag: "{{data_batismo}}", desc: "Data de Batismo" },
      { tag: "{{igreja_destino}}", desc: "Nome da igreja destinatária (envio por e-mail)" },
      { tag: "{{email_igreja_destino}}", desc: "E-mail da igreja destinatária" },
      { tag: "{{cidade}}", desc: "Cidade" },
      { tag: "{{estado}}", desc: "Estado" },
      { tag: "{{cep}}", desc: "CEP" },
    ]},
    { cat: "Sistema / Igreja", items: [
      { tag: "{{denominacao}}", desc: "Nome da Igreja" },
      { tag: "{{data_atual}}", desc: "Data de Hoje por Extenso" },
      { tag: "{{data_emissao}}", desc: "Data de Emissão por Extenso" },
    ]}
  ];

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("Sua sessão expirou. Entre novamente.");
        const { data, error } = await supabase.from("usuarios").select("igreja_id").eq("id", session.user.id).maybeSingle();
        if (error) throw error;
        if (!data?.igreja_id) throw new Error("Não foi possível identificar a igreja do usuário.");
        setIgrejaId(data.igreja_id);
      } catch (error) {
        setModal({ isOpen: true, type: "error", title: "Erro", message: error instanceof Error ? error.message : "Não foi possível carregar o perfil." });
      }
    };
    void init();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      const conteudo = editorRef.current.innerHTML;
      setFormData(prev => ({ ...prev, conteudo }));
    }
  };

  // Comando para formatar texto (Negrito, Itálico, etc)
  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    handleEditorInput();
  };

  // Inserir variável no cursor
  const insertVariavel = (tag: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand("insertText", false, tag);
      handleEditorInput();
    }
  };

  // Carregar modelo padrão
  const carregarModelo = (tipo: "recomendacao" | "transferencia") => {
    if (tipo === "recomendacao") {
      setFormData(prev => ({ ...prev, nome: "Carta de Recomendação" }));
      if (editorRef.current) {
        editorRef.current.innerHTML = `A <b>{{denominacao}}</b>, através de sua diretoria e ministério pastoral, vem por meio desta certificar que o(a) irmão(ã) <b>{{nome}}</b>, portador(a) do CPF nº <b>{{cpf}}</b> e RG nº <b>{{rg}}</b>, é membro em plena comunhão e desempenha a função de <b>{{cargo}}</b> na <b>{{congregacao}}</b>.<br><br>Recomendamos o(a) mesmo(a) a qualquer igreja onde porventura venha a congregar ou prestar serviços eclesiásticos.<br><br><br>{{data_atual}}.`;
        handleEditorInput();
      }
    } else {
      setFormData(prev => ({ ...prev, nome: "Carta de Transferência" }));
      if (editorRef.current) {
        editorRef.current.innerHTML = `A <b>{{denominacao}}</b>, através de sua diretoria e ministério pastoral, vem por meio desta transferir o(a) irmão(ã) <b>{{nome}}</b>, portador(a) do CPF nº <b>{{cpf}}</b>, que se encontra em plena comunhão com esta igreja, para a congregação que o(a) receber.<br><br>Desejamos que o(a) irmão(ã) continue servindo ao Senhor com alegria e dedicação.<br><br><br>{{data_atual}}.`;
        handleEditorInput();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) return setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada." });
    if (!formData.nome) return setModal({ isOpen: true, type: "error", title: "Atenção", message: "Preencha a descrição da carta." });
    if (formData.tipo_cabecalho === "custom" && !/^https:\/\/\S+$/i.test(formData.imagem_cabecalho_url)) {
      return setModal({ isOpen: true, type: "error", title: "Atenção", message: "Informe uma URL HTTPS válida para o banner personalizado." });
    }
    
    setLoading(true);
    try {
      const conteudoFinal = sanitizeLetterHtml(editorRef.current?.innerHTML || "");
      const { error } = await supabase.from("modelos_cartas").insert([{
        igreja_id: igrejaId,
        nome: formData.nome,
        tipo_cabecalho: formData.tipo_cabecalho,
        tipo_rodape: formData.tipo_rodape,
        texto_rodape: formData.texto_rodape,
        imagem_cabecalho_url: formData.imagem_cabecalho_url || null,
        conteudo: conteudoFinal
      }]);

      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Modelo criado!" });
      setTimeout(() => router.push("/secretaria/cartas/modelos"), 1500);
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error instanceof Error ? error.message : "Não foi possível salvar o modelo." });
      setLoading(false);
    }
  };

  const previewHtml = buildLetterHtml(
    formData,
    { nome: "Maria Exemplo", cpf: "000.000.000-00", cargo: "Membro", congregacoes: { nome: "Sede" } },
    { nome: "Igreja Exemplo", email: "contato@igreja.com", telefone: "(00) 0000-0000" },
    "2025-01-15",
    { mostrarCabecalho: true, mostrarRodape: true, incluirAssinatura: false, assinaturas: [] },
    sanitizeLetterHtml(formData.conteudo),
  );

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-4 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Link href="/secretaria/cartas/modelos" className="text-gray-400 hover:text-white transition-colors mt-0.5"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2"><FileText className="w-5 h-5 text-ohel-blue"/> Novo Modelo de Carta</h1>
            <p className="text-gray-400 text-xs mt-0.5">Configure o layout, cabeçalho, corpo e o rodapé do documento.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => carregarModelo("recomendacao")} className="px-4 py-2 text-xs">Carregar: Recomendação</Button>
          <Button variant="secondary" onClick={() => carregarModelo("transferencia")} className="px-4 py-2 text-xs">Carregar: Transferência</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading} className="w-auto px-6 py-2 text-xs">
            <Save className="w-3.5 h-3.5 mr-1.5" /> Salvar Modelo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* COLUNA ESQUERDA: Editor */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-xl p-5">
            <Input label="Descrição da Carta *" name="nome" placeholder="Ex: Carta de Mudança, Apresentação..." value={formData.nome} onChange={handleChange} required className="py-2 text-xs mb-5" />
            
            <div className="mb-5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider mb-2 block">Tipo de Cabeçalho</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setFormData({...formData, tipo_cabecalho: "padrao"})} className={`flex-1 flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${formData.tipo_cabecalho === "padrao" ? "border-ohel-blue bg-ohel-blue/5" : "border-gray-800 bg-ohel-bg"}`}>
                  <div className={`w-3 h-3 rounded-full border ${formData.tipo_cabecalho === "padrao" ? "border-ohel-blue bg-ohel-blue" : "border-gray-500"}`}></div>
                  <div><p className="text-xs font-bold text-white">Padrão Sistema (Logotipo e Dados da Igreja)</p></div>
                </button>
                <button type="button" onClick={() => setFormData({...formData, tipo_cabecalho: "custom"})} className={`flex-1 flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${formData.tipo_cabecalho === "custom" ? "border-ohel-blue bg-ohel-blue/5" : "border-gray-800 bg-ohel-bg"}`}>
                  <div className={`w-3 h-3 rounded-full border ${formData.tipo_cabecalho === "custom" ? "border-ohel-blue bg-ohel-blue" : "border-gray-500"}`}></div>
                  <div><p className="text-xs font-bold text-white">Imagem Personalizada (Banner do Topo)</p></div>
                </button>
              </div>
              {formData.tipo_cabecalho === "custom" && (
                <Input label="URL HTTPS do banner *" name="imagem_cabecalho_url" value={formData.imagem_cabecalho_url} onChange={handleChange} placeholder="https://..." required className="mt-3 py-2 text-xs" />
              )}
            </div>

            <div className="mb-5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider mb-2 block">Rodapé</label>
              <select
                value={formData.tipo_rodape}
                onChange={event => setFormData(prev => ({ ...prev, tipo_rodape: event.target.value }))}
                className="input-ohel w-full rounded-md px-3 py-2 text-xs"
              >
                <option value="padrao">Rodapé padrão do OHEL ON</option>
                <option value="custom">Texto personalizado</option>
              </select>
              {formData.tipo_rodape === "custom" && (
                <textarea
                  value={formData.texto_rodape}
                  onChange={event => setFormData(prev => ({ ...prev, texto_rodape: event.target.value }))}
                  maxLength={1000}
                  rows={3}
                  placeholder="Endereço, contato ou observações do documento"
                  className="input-ohel mt-3 w-full rounded-md px-3 py-2 text-xs"
                />
              )}
            </div>

            <div>
              <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlignLeft className="w-3.5 h-3.5 text-ohel-blue" /> Corpo da Carta (Texto Rico) *
              </label>
              
              {/* Toolbar */}
              <div className="flex items-center gap-1 border border-gray-800 bg-ohel-bg p-2 rounded-t-lg border-b-0 flex-wrap">
                <select className="bg-transparent text-xs text-gray-300 outline-none mr-2 border-r border-gray-700 pr-2">
                  <option>Padrão</option>
                </select>
                <select className="bg-transparent text-xs text-gray-300 outline-none mr-2 border-r border-gray-700 pr-2">
                  <option>Padrão A4 (16px)</option>
                </select>
                <button type="button" onClick={() => execCommand("bold")} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"><Bold className="w-4 h-4"/></button>
                <button type="button" onClick={() => execCommand("italic")} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"><Italic className="w-4 h-4"/></button>
                <button type="button" onClick={() => execCommand("underline")} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"><Underline className="w-4 h-4"/></button>
                <div className="w-px h-4 bg-gray-700 mx-1"></div>
                <button type="button" onClick={() => execCommand("insertUnorderedList")} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded"><List className="w-4 h-4"/></button>
              </div>

              {/* Editor Body */}
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
              <span className="bg-ohel-blue/10 text-ohel-blue text-[9px] font-bold px-2 py-0.5 rounded uppercase">Inserindo no Corpo</span>
            </div>
            
            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute left-3 top-2 text-gray-500" />
              <input type="text" placeholder="Filtrar variáveis..." value={buscaVar} onChange={e => setBuscaVar(e.target.value)} className="w-full bg-ohel-bg border border-gray-800 text-xs text-white rounded-md pl-9 pr-3 py-2 outline-none focus:border-ohel-blue" />
            </div>
            
            <p className="text-[10px] text-gray-500 mb-4">Clique na variável para inserir na posição do cursor.</p>

            <div className="flex flex-col gap-4 max-h-[380px] overflow-y-auto pr-1">
              {variaveis.map(grupo => {
                const itemsFiltrados = grupo.items.filter(i => i.desc.toLowerCase().includes(buscaVar.toLowerCase()) || i.tag.includes(buscaVar));
                if (itemsFiltrados.length === 0) return null;
                
                return (
                  <div key={grupo.cat}>
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex justify-between items-center">{grupo.cat} ({itemsFiltrados.length})</h4>
                    <div className="flex flex-col gap-2">
                      {itemsFiltrados.map(item => (
                        <button key={item.tag} type="button" onClick={() => insertVariavel(item.tag)} className="bg-ohel-bg border border-gray-800 hover:border-ohel-blue p-2.5 rounded text-left transition-colors group">
                          <p className="text-xs text-white font-medium group-hover:text-ohel-blue">{item.desc}</p>
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">{item.tag}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Card de Pré-visualização */}
          <div className="bg-ohel-surface border border-gray-800 rounded-xl p-5 text-center">
            <button type="button" onClick={() => setPreviewOpen(true)} className="bg-ohel-bg border border-gray-700 text-gray-300 font-medium py-2 px-4 rounded-md text-xs flex items-center justify-center gap-2 w-full hover:text-white transition-colors">
              <Eye className="w-4 h-4" /> Pré-visualizar Carta
            </button>
          </div>
        </div>

      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Pré-visualização da carta">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-ohel-surface">
            <div className="flex items-center justify-between border-b border-gray-700 px-5 py-3">
              <h2 className="text-sm font-bold text-white">Pré-visualização</h2>
              <button type="button" onClick={() => setPreviewOpen(false)} aria-label="Fechar pré-visualização" className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-auto bg-gray-200 p-6">
              <div className="mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white p-12 shadow-lg" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}