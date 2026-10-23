"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { getPrivateFileUrl, uploadChurchFile } from "@/lib/private-storage";
import { ArrowLeft, Save, FileText, Users, Paperclip, Info, Plus, Trash2, Upload, Loader2, Search, User, Video } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function EditarReuniaoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("info");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error" | "warning", title: "", message: "" });

  const [dataReuniao, setDataReuniao] = useState("");
  const [horaReuniao, setHoraReuniao] = useState("");

  const [formData, setFormData] = useState({
    titulo: "", local: "", link_online: "", status: "Agendada", pauta: "", ata: "", observacoes_internas: ""
  });

  const [participantes, setParticipantes] = useState<{nome: string, cargo: string}[]>([]);
  const [novoParticipante, setNovoParticipante] = useState({nome: "", cargo: ""});
  const [anexos, setAnexos] = useState<{nome: string, url: string, signedUrl?: string}[]>([]);

  // --- ESTADOS DA BUSCA DE MEMBROS ---
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const cargos = [
    "Membro", "Diácono", "Presbítero", "Evangelista", "Pastor", 
    "Missionário", "Cooperador", "Secretário", "Tesoureiro", "Dirigente"
  ];

  useEffect(() => {
    const fetchDados = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase.from('reunioes').select('*').eq('id', id).single();
        if (error) throw error;

        if (data) {
          setIgrejaId(data.igreja_id);
          setFormData({
            titulo: data.titulo || "", 
            local: data.local || "", 
            link_online: data.link_online || "",
            status: data.status || "Agendada", 
            pauta: data.pauta || "", 
            ata: data.ata || "", 
            observacoes_internas: data.observacoes_internas || ""
          });

          if (data.data_hora) {
            try {
              const dateObj = new Date(data.data_hora);
              if (!isNaN(dateObj.getTime())) {
                setDataReuniao(dateObj.toISOString().split('T')[0]);
                setHoraReuniao(dateObj.toTimeString().slice(0, 5));
              }
            } catch (e) { console.error("Data inválida"); }
          }

          if (data.participantes) {
             const parts = data.participantes.split(', ');
             const parsed = parts.map((p: string) => {
               const match = p.match(/(.+) \((.+)\)/);
               return match ? { nome: match[1], cargo: match[2] } : { nome: p, cargo: "" };
             });
             setParticipantes(parsed);
          }

          if (data.anexos && Array.isArray(data.anexos)) {
            const attachments = await Promise.all(data.anexos.map(async (anexo: { nome: string; url: string }) => ({
              ...anexo,
              signedUrl: await getPrivateFileUrl(supabase, "documentos", anexo.url),
            })));
            setAnexos(attachments);
          }
        }
      } catch (error) {
        setModal({ isOpen: true, type: "error", title: "Erro", message: "Erro ao carregar a reunião." });
      } finally {
        setLoading(false);
      }
    };
    fetchDados();
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-container')) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSearchParticipante = async (text: string) => {
    setSearchTerm(text);
    setNovoParticipante({ ...novoParticipante, nome: text });
    setIsSearching(true);
    setShowDropdown(true);

    const { data } = await supabase
      .from('membros')
      .select(`id, nome, cargo, foto_url`)
      .ilike('nome', `%${text}%`)
      .limit(5);

    setSearchResults(data || []);
    setIsSearching(false);
  };

  const selectMembro = (membro: any) => {
    const cargoMembro = membro.cargo || "Membro";
    setNovoParticipante({ nome: membro.nome, cargo: cargoMembro });
    setSearchTerm(membro.nome);
    setShowDropdown(false);
  };

  const addParticipante = () => {
    if (!novoParticipante.nome) return;
    setParticipantes([...participantes, novoParticipante]);
    setNovoParticipante({nome: "", cargo: ""});
    setSearchTerm("");
  };

  const removeParticipante = (index: number) => {
    setParticipantes(participantes.filter((_, i) => i !== index));
  };

  const handleUploadAnexo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
      if (!igrejaId) throw new Error("Igreja não identificada.");
      const path = await uploadChurchFile(supabase, "documentos", igrejaId, file, fileName);
      const signedUrl = await getPrivateFileUrl(supabase, "documentos", path);
      setAnexos([...anexos, { nome: file.name, url: path, signedUrl }]);
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Falha ao enviar anexo." });
    } finally {
      setUploading(false);
    }
  };

  const removeAnexo = (index: number) => {
    setAnexos(anexos.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!dataReuniao) {
      return setModal({ isOpen: true, type: "warning", title: "Atenção", message: "Por favor, preencha a data da reunião." });
    }
    const horaFormatada = horaReuniao || "12:00";
    const dataHoraFinal = new Date(`${dataReuniao}T${horaFormatada}:00`).toISOString();

    setSaving(true);
    try {
      const participantesTexto = participantes.map(p => `${p.nome} (${p.cargo || 'Presente'})`).join(', ');

      const { error } = await supabase.from("reunioes").update({
        titulo: formData.titulo,
        data_hora: dataHoraFinal,
        local: formData.local,
        link_online: formData.link_online || null,
        status: formData.status,
        pauta: formData.pauta,
        ata: formData.ata,
        observacoes_internas: formData.observacoes_internas,
        participantes: participantesTexto,
        anexos: anexos.map(({ nome, url }) => ({ nome, url }))
      }).eq("id", id);

      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Reunião atualizada com sucesso!" });
      setTimeout(() => router.push("/secretaria/reunioes"), 1500);

    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro ao Atualizar", message: error.message });
      setSaving(false);
    }
  };

  if (loading) return <div className="w-full h-full flex items-center justify-center text-gray-400">Carregando dados...</div>;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Link href="/secretaria/reunioes" className="text-gray-400 hover:text-white transition-colors mt-0.5"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Editar Reunião</h1>
            <p className="text-gray-400 text-xs mt-0.5">Atualize as informações ou a ata da reunião.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/secretaria/reunioes" className="text-gray-400 hover:text-white px-3 py-2 text-xs font-medium transition-colors">Cancelar</Link>
          <Button variant="primary" onClick={handleSubmit} disabled={saving || uploading} className="w-auto px-6 py-2 text-xs">
            <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden border-gray-800 flex flex-col">
        
        <div className="flex border-b border-gray-800 bg-ohel-surface/50 overflow-x-auto shrink-0">
          <button type="button" onClick={() => setActiveTab("info")} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "info" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}>
            <Info className="w-4 h-4" /> Informações
          </button>
          <button type="button" onClick={() => setActiveTab("participantes")} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "participantes" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}>
            <Users className="w-4 h-4" /> Participantes ({participantes.length})
          </button>
          <button type="button" onClick={() => setActiveTab("ata")} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "ata" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}>
            <FileText className="w-4 h-4" /> Ata Oficial
          </button>
          <button type="button" onClick={() => setActiveTab("anexos")} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "anexos" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}>
            <Paperclip className="w-4 h-4" /> Anexos ({anexos.length})
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          
          {activeTab === "info" && (
            <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Input label="Título da Reunião *" name="titulo" value={formData.titulo} onChange={handleChange} required />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Input label="Data da Reunião *" type="date" value={dataReuniao} onChange={(e) => setDataReuniao(e.target.value)} required />
                <Input label="Horário" type="time" value={horaReuniao} onChange={(e) => setHoraReuniao(e.target.value)} />
                <Input label="Local Físico" name="local" value={formData.local} onChange={handleChange} />
              </div>

              {/* CAMPO DE LINK ONLINE */}
              <div className="flex flex-col gap-2 bg-ohel-bg/50 p-4 rounded-lg border border-gray-800/50 mt-1">
                <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider flex items-center gap-2">
                  <Video className="w-3.5 h-3.5 text-ohel-blue" /> Link da Reunião Online (Opcional)
                </label>
                <Input 
                  name="link_online" 
                  placeholder="Ex: https://meet.google.com/xyz-abc-123" 
                  value={formData.link_online} 
                  onChange={handleChange} 
                />
                <p className="text-[10px] text-gray-500">Preencha este campo caso a reunião seja online ou híbrida.</p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Pauta da Reunião</label>
                <textarea name="pauta" value={formData.pauta} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm min-h-[100px] resize-y" />
              </div>

              <div className="flex flex-col gap-2 border-t border-gray-800 pt-4">
                <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider flex justify-between">Observações Internas (Opcional)</label>
                <textarea name="observacoes_internas" value={formData.observacoes_internas} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm min-h-[80px] resize-y" />
              </div>
            </div>
          )}

          {activeTab === "participantes" && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              <div className="bg-ohel-bg border border-gray-800 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-end">
                
                <div className="flex-1 flex flex-col w-full relative search-container">
                  <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider mb-1.5 block">Nome do Participante *</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
                    <input 
                      type="text" 
                      placeholder="Buscar membro ou digitar nome..."
                      value={searchTerm}
                      onChange={(e) => handleSearchParticipante(e.target.value)}
                      onFocus={() => handleSearchParticipante(searchTerm)}
                      className="input-ohel w-full pl-9 pr-4 py-3 rounded-lg text-sm h-[46px]"
                    />
                  </div>

                  {showDropdown && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-ohel-surface border border-gray-700 rounded-lg shadow-2xl z-50 max-h-56 overflow-y-auto">
                      {isSearching ? (
                        <div className="p-3 text-center text-xs text-gray-400 flex items-center justify-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando...</div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-3 text-center text-xs text-gray-400">Nenhum membro. Digite manualmente se preferir.</div>
                      ) : (
                        searchResults.map((membro) => (
                          <button key={membro.id} type="button" onClick={() => selectMembro(membro)} className="w-full flex items-center gap-3 p-2.5 hover:bg-white/5 transition-colors border-b border-gray-800/50 last:border-0 text-left">
                            <div className="w-8 h-8 rounded-full bg-ohel-bg border border-gray-700 flex items-center justify-center overflow-hidden shrink-0">
                              {membro.foto_url ? <Image src={membro.foto_url} alt={membro.nome} width={32} height={32} className="object-cover w-full h-full" /> : <User className="w-4 h-4 text-gray-500" />}
                            </div>
                            <div>
                              <p className="text-white text-xs font-medium">{membro.nome}</p>
                              <p className="text-[10px] text-ohel-blue">{membro.cargo || "Membro"}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 w-full flex flex-col">
                  <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider mb-1.5 block">Cargo / Função</label>
                  <select 
                    value={novoParticipante.cargo} 
                    onChange={e => setNovoParticipante({...novoParticipante, cargo: e.target.value})} 
                    className="input-ohel w-full px-4 py-3 rounded-lg text-sm h-[46px]"
                  >
                    <option value="">Selecione o Cargo...</option>
                    {cargos.map(c => <option key={c} value={c}>{c}</option>)}
                    {novoParticipante.cargo && !cargos.includes(novoParticipante.cargo) && (
                      <option value={novoParticipante.cargo}>{novoParticipante.cargo}</option>
                    )}
                  </select>
                </div>

                <Button type="button" variant="secondary" onClick={addParticipante} className="px-6 h-[46px] shrink-0 w-full md:w-auto">
                  <Plus className="w-4 h-4 mr-2" /> Adicionar
                </Button>
              </div>

              <div className="border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-ohel-surface/80 text-gray-400 text-xs uppercase">
                    <tr><th className="p-4">Nome</th><th className="p-4">Cargo</th><th className="p-4 text-center">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {participantes.length === 0 ? (
                      <tr><td colSpan={3} className="p-6 text-center text-gray-500">Nenhum participante adicionado ainda.</td></tr>
                    ) : (
                      participantes.map((p, i) => (
                        <tr key={i} className="hover:bg-white/[0.02]">
                          <td className="p-4 text-white font-medium">{p.nome}</td>
                          <td className="p-4 text-gray-400">{p.cargo || "-"}</td>
                          <td className="p-4 text-center"><button type="button" onClick={() => removeParticipante(i)} className="text-red-500 hover:text-red-400"><Trash2 className="w-4 h-4 inline" /></button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "ata" && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Ata Oficial da Reunião</h3>
                  <p className="text-xs text-gray-400 mt-1">Edite ou preencha o texto final da Ata.</p>
                </div>
              </div>
              <textarea name="ata" value={formData.ata} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm min-h-[300px] resize-y font-mono" />
            </div>
          )}

          {activeTab === "anexos" && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Documentos e Anexos</h3>
                  <p className="text-xs text-gray-400 mt-1">Anexe atas em PDF, comprovantes, fotos ou documentos relevantes.</p>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleUploadAnexo} className="hidden" />
                <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : <><Upload className="w-4 h-4 mr-2" /> Adicionar Anexo</>}
                </Button>
              </div>

              {anexos.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-gray-700 rounded-xl bg-ohel-bg/50">
                  <Paperclip className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Nenhum documento anexado ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {anexos.map((anexo, index) => (
                    <div key={index} className="flex items-center justify-between bg-ohel-bg border border-gray-800 p-4 rounded-lg">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText className="w-6 h-6 text-ohel-blue shrink-0" />
                        <a href={anexo.signedUrl} target="_blank" rel="noreferrer" className="text-sm text-white truncate hover:underline">{anexo.nome}</a>
                      </div>
                      <button type="button" onClick={() => removeAnexo(index)} className="text-gray-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </form>
      </Card>
    </div>
  );
}