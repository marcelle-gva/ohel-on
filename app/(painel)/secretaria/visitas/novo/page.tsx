"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, User, Calendar, CheckCircle, Image as ImageIcon, Loader2, Search } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function NovaVisitaPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  // --- ESTADOS DA BUSCA DO DESTINATÁRIO ---
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // --- ESTADOS DA BUSCA DO RESPONSÁVEL ---
  const [respSearchTerm, setRespSearchTerm] = useState("");
  const [respResults, setRespResults] = useState<any[]>([]);
  const [isRespSearching, setIsRespSearching] = useState(false);
  const [showRespDropdown, setShowRespDropdown] = useState(false);

  const [formData, setFormData] = useState({
    vinculo_tipo: "Membro",
    pessoa_visitada: "",
    tipo: "Visita Pastoral",
    data_prevista: "",
    hora_prevista: "",
    responsavel: "",
    observacao: "",
    data_realizada: "",
    hora_realizada: "",
    relato: "",
    retorno_previsto: "",
    status: "Agendada",
    foto_url: ""
  });

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSearch = async (text: string) => {
    setSearchTerm(text);
    setFormData({ ...formData, pessoa_visitada: text });
    setIsSearching(true);
    setShowDropdown(true);

    let table = "";
    if (formData.vinculo_tipo === "Membro") table = "membros";
    else if (formData.vinculo_tipo === "Congregado") table = "congregados";
    else table = "visitantes";

    const { data } = await supabase
      .from(table)
      .select(`id, nome, telefone, foto_url, congregacoes (nome)`)
      .ilike('nome', `%${text}%`)
      .limit(5);

    setSearchResults(data || []);
    setIsSearching(false);
  };

  const selectPessoa = (pessoa: any) => {
    setFormData({ ...formData, pessoa_visitada: pessoa.nome });
    setSearchTerm(pessoa.nome);
    setShowDropdown(false);
  };

  const handleSearchResponsavel = async (text: string) => {
    setRespSearchTerm(text);
    setFormData({ ...formData, responsavel: text });
    setIsRespSearching(true);
    setShowRespDropdown(true);

    const { data } = await supabase
      .from('membros')
      .select(`id, nome, congregacoes (nome)`)
      .ilike('nome', `%${text}%`)
      .limit(5);

    setRespResults(data || []);
    setIsRespSearching(false);
  };

  const selectResponsavel = (membro: any) => {
    setFormData({ ...formData, responsavel: membro.nome });
    setRespSearchTerm(membro.nome);
    setShowRespDropdown(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-container')) setShowDropdown(false);
      if (!target.closest('.resp-search-container')) setShowRespDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('comunicacoes').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = await supabase.storage.from('comunicacoes').getPublicUrl(fileName);
      setFormData({ ...formData, foto_url: data.publicUrl });
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro no Upload", message: "Não foi possível enviar a foto." });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) return setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada." });
    
    setLoading(true);
    try {
      const { error } = await supabase.from("visitas").insert([{
        igreja_id: igrejaId,
        vinculo_tipo: formData.vinculo_tipo,
        pessoa_visitada: formData.pessoa_visitada,
        tipo: formData.tipo,
        data_prevista: formData.data_prevista || null,
        hora_prevista: formData.hora_prevista,
        responsavel: formData.responsavel,
        observacao: formData.observacao,
        data_realizada: formData.data_realizada || null,
        hora_realizada: formData.hora_realizada,
        relato: formData.relato,
        retorno_previsto: formData.retorno_previsto || null,
        status: formData.status,
        foto_url: formData.foto_url || null
      }]);

      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Visita cadastrada com sucesso!" });
      setTimeout(() => router.push("/secretaria/visitas"), 1500);

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
          <Link href="/secretaria/visitas" className="text-gray-400 hover:text-white transition-colors mt-0.5"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Nova Visita</h1>
            <p className="text-gray-400 text-xs mt-0.5">Preencha os dados da visita pastoral.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/secretaria/visitas" className="text-gray-400 hover:text-white px-3 py-2 text-xs font-medium transition-colors">Cancelar</Link>
          <Button variant="primary" onClick={handleSubmit} disabled={loading || uploading} className="w-auto px-6 py-2 text-xs">
            <Save className="w-3.5 h-3.5 mr-1.5" /> {loading ? "Salvando..." : "Cadastrar Visita"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        
        {/* CARD 1: DESTINATÁRIO */}
        <Card className="p-4 flex flex-col gap-3 overflow-visible relative z-20">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
            <User className="w-4 h-4 text-ohel-blue" />
            <h2 className="text-sm font-bold text-white">1. Destinatário da Visita</h2>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Público / Vínculo com a Igreja *</label>
            <div className="flex gap-2">
              {['Membro', 'Congregado', 'Visitante'].map(v => (
                <button 
                  key={v} type="button" 
                  onClick={() => {
                    setFormData({...formData, vinculo_tipo: v, pessoa_visitada: ""});
                    setSearchTerm("");
                    setSearchResults([]);
                  }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded border transition-all ${formData.vinculo_tipo === v ? "bg-ohel-blue/10 border-ohel-blue text-ohel-blue" : "bg-ohel-bg border-gray-700 text-gray-400 hover:text-white"}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 relative search-container">
            <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Pesquisar e Selecionar Nome *</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
              <input 
                type="text" 
                placeholder={`Digite para buscar ${formData.vinculo_tipo.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => handleSearch(searchTerm)}
                required
                className="input-ohel w-full pl-9 pr-4 py-2 rounded-md text-xs"
              />
            </div>

            {showDropdown && (
              <div className="absolute top-full left-0 w-full mt-1 bg-ohel-surface border border-gray-700 rounded-md shadow-2xl z-50 max-h-56 overflow-y-auto">
                {isSearching ? (
                  <div className="p-3 text-center text-xs text-gray-400 flex items-center justify-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando...</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-center text-xs text-gray-400">Nenhum resultado. Digite manualmente se preferir.</div>
                ) : (
                  searchResults.map((pessoa) => (
                    <button key={pessoa.id} type="button" onClick={() => selectPessoa(pessoa)} className="w-full flex items-center gap-3 p-2.5 hover:bg-white/5 transition-colors border-b border-gray-800/50 last:border-0 text-left">
                      <div className="w-8 h-8 rounded-full bg-ohel-bg border border-gray-700 flex items-center justify-center overflow-hidden shrink-0">
                        {pessoa.foto_url ? <Image src={pessoa.foto_url} alt={pessoa.nome} width={32} height={32} className="object-cover w-full h-full" /> : <User className="w-4 h-4 text-gray-500" />}
                      </div>
                      <div>
                        <p className="text-white text-xs font-medium">{pessoa.nome}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <span className="text-ohel-blue">{pessoa.congregacoes?.nome || "Sem congregação"}</span>
                          {pessoa.telefone && <span>• {pessoa.telefone}</span>}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </Card>

        {/* CARD 2: AGENDAMENTO */}
        <Card className="p-4 flex flex-col gap-3 overflow-visible relative z-10">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
            <Calendar className="w-4 h-4 text-ohel-blue" />
            <h2 className="text-sm font-bold text-white">2. Agendamento da Visita</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input label="Data Prevista *" type="date" name="data_prevista" value={formData.data_prevista} onChange={handleChange} required className="py-1.5 text-xs" />
            <Input label="Hora" type="time" name="hora_prevista" value={formData.hora_prevista} onChange={handleChange} className="py-1.5 text-xs" />
            
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Tipo de Visita *</label>
              <select name="tipo" value={formData.tipo} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                <option value="Visita Pastoral">Visita Pastoral</option>
                <option value="Acolhimento">Acolhimento</option>
                <option value="Visita de Oração">Visita de Oração</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 relative resp-search-container">
            <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Membro Responsável *</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
              <input 
                type="text" 
                placeholder="Pesquisar membro responsável..."
                value={respSearchTerm}
                onChange={(e) => handleSearchResponsavel(e.target.value)}
                onFocus={() => handleSearchResponsavel(respSearchTerm)}
                required
                className="input-ohel w-full pl-9 pr-4 py-2 rounded-md text-xs"
              />
            </div>

            {showRespDropdown && (
              <div className="absolute top-full left-0 w-full mt-1 bg-ohel-surface border border-gray-700 rounded-md shadow-2xl z-50 max-h-56 overflow-y-auto">
                {isRespSearching ? (
                  <div className="p-3 text-center text-xs text-gray-400 flex items-center justify-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando...</div>
                ) : respResults.length === 0 ? (
                  <div className="p-3 text-center text-xs text-gray-400">Nenhum membro encontrado.</div>
                ) : (
                  respResults.map((membro) => (
                    <button key={membro.id} type="button" onClick={() => selectResponsavel(membro)} className="w-full flex items-center justify-between p-2.5 hover:bg-white/5 transition-colors border-b border-gray-800/50 last:border-0 text-left">
                      <p className="text-white text-xs font-medium">{membro.nome}</p>
                      <span className="text-[10px] text-gray-400">({membro.congregacoes?.nome || "Sem congregação"})</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Orientações Prévias / Motivo</label>
            <textarea name="observacao" value={formData.observacao} onChange={handleChange} placeholder="Instruções para a equipe, pedidos de oração..." className="input-ohel w-full px-3 py-2 rounded-md text-xs min-h-[60px] resize-none" />
          </div>
        </Card>

        {/* CARD 3: REALIZAÇÃO */}
        <Card className="p-4 flex flex-col gap-3 border-ohel-blue/30 relative z-0">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <h2 className="text-sm font-bold text-white">3. Realização e Conclusão</h2>
            </div>
            <select name="status" value={formData.status} onChange={handleChange} className="bg-ohel-bg border border-gray-700 text-xs text-white rounded px-2 py-1 outline-none">
              <option value="Agendada">Agendada</option>
              <option value="Realizada">Realizada</option>
              <option value="Atrasada">Atrasada</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </div>
          <p className="text-[10px] text-gray-500 -mt-1">Preencha estas informações quando a visita for executada.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input label="Data Realizada" type="date" name="data_realizada" value={formData.data_realizada} onChange={handleChange} className="py-1.5 text-xs" />
            <Input label="Hora Realizada" type="time" name="hora_realizada" value={formData.hora_realizada} onChange={handleChange} className="py-1.5 text-xs" />
            <Input label="Data Retorno (Opcional)" type="date" name="retorno_previsto" value={formData.retorno_previsto} onChange={handleChange} className="py-1.5 text-xs" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Relato / Detalhes da Visita</label>
            <textarea name="relato" value={formData.relato} onChange={handleChange} placeholder="Descreva como foi a visita, assuntos conversados..." className="input-ohel w-full px-3 py-2 rounded-md text-xs min-h-[70px] resize-none" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Fotos da Visita</label>
            {formData.foto_url ? (
              <div className="relative w-40 h-28 rounded-md overflow-hidden border border-gray-700">
                <Image src={formData.foto_url} alt="Foto da visita" fill className="object-cover" />
                <button type="button" onClick={() => setFormData({...formData, foto_url: ""})} className="absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">Remover</button>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()} className="w-full h-20 bg-ohel-bg border border-dashed border-gray-700 hover:border-ohel-blue rounded-md flex flex-col items-center justify-center cursor-pointer transition-colors group">
                {uploading ? <Loader2 className="w-4 h-4 text-ohel-blue animate-spin mb-1" /> : <ImageIcon className="w-4 h-4 text-gray-500 group-hover:text-ohel-blue mb-1" />}
                <span className="text-[10px] text-gray-400">{uploading ? "Enviando..." : "Clique para anexar uma foto"}</span>
              </div>
            )}
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleUploadFoto} className="hidden" />
          </div>
        </Card>
      </form>
    </div>
  );
}