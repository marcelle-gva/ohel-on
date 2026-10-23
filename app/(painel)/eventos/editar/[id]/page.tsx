"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { GenerateEventImage } from "@/components/eventos/GenerateEventImage";
import { ArrowLeft, Save, Calendar, MapPin, Upload, Loader2, Image as ImageIcon, Megaphone, CheckCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function EditarEventoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState("dados");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [congregacoes, setCongregacoes] = useState<{id: string, nome: string}[]>([]);
  
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    nome: "", descricao: "", congregacao_id: "", data_inicio: "", data_fim: "", hora_abertura: "",
    data_limite_inscricao: "", limite_participantes: "", cartaz_url: "",
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
    status: "Aberto", publicar_mural: false
  });

  useEffect(() => {
    const fetchDados = async () => {
      if (!id) return;
      try {
        const { data: congs } = await supabase.from('congregacoes').select('id, nome').order('nome');
        if (congs) setCongregacoes(congs);

        const { data, error } = await supabase.from('eventos').select('*').eq('id', id).single();
        if (error) throw error;

        if (data) {
          setFormData({
            nome: data.nome || "", descricao: data.descricao || "", congregacao_id: data.congregacao_id || "",
            data_inicio: data.data_inicio || "", data_fim: data.data_fim || "", hora_abertura: data.hora_abertura || "",
            data_limite_inscricao: data.data_limite_inscricao || "", limite_participantes: data.limite_participantes?.toString() || "",
            cartaz_url: data.cartaz_url || "", cep: data.cep || "", logradouro: data.logradouro || "",
            numero: data.numero || "", complemento: data.complemento || "", bairro: data.bairro || "",
            cidade: data.cidade || "", uf: data.uf || "", status: data.status || "Aberto",
            publicar_mural: data.publicar_mural || false
          });
        }
      } catch (error) {
        setModal({ isOpen: true, type: "error", title: "Erro", message: error instanceof Error ? error.message : "Erro ao carregar os dados do evento." });
      } finally {
        setLoading(false);
      }
    };
    fetchDados();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleUploadCartaz = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `evento-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('cartazes').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('cartazes').getPublicUrl(fileName);
      setFormData({ ...formData, cartaz_url: data.publicUrl });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Erro no Upload", message: error instanceof Error ? error.message : "Não foi possível enviar a imagem do cartaz." });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        nome: formData.nome, descricao: formData.descricao, congregacao_id: formData.congregacao_id || null,
        data_inicio: formData.data_inicio, data_fim: formData.data_fim || null, hora_abertura: formData.hora_abertura || null,
        data_limite_inscricao: formData.data_limite_inscricao || null,
        limite_participantes: formData.limite_participantes ? parseInt(formData.limite_participantes) : null,
        cartaz_url: formData.cartaz_url || null,
        cep: formData.cep || null, logradouro: formData.logradouro || null, numero: formData.numero || null,
        complemento: formData.complemento || null, bairro: formData.bairro || null, cidade: formData.cidade || null, uf: formData.uf || null,
        status: formData.status, publicar_mural: formData.publicar_mural
      };
      const { error } = await supabase.from("eventos").update(payload).eq("id", id);
      if (error) throw error;
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Evento atualizado com sucesso!" });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Erro ao Atualizar", message: error instanceof Error ? error.message : "Não foi possível atualizar o evento." });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    setModal({ ...modal, isOpen: false });
    if (modal.type === "success") router.push("/eventos");
  };

  if (loading) return <div className="w-full h-full flex items-center justify-center text-gray-400">Carregando dados do evento...</div>;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={handleCloseModal} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/eventos" className="text-gray-400 hover:text-white transition-colors mt-1"><ArrowLeft className="w-6 h-6" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Editar Evento</h1>
            <p className="text-gray-400 text-sm mt-1">Atualize as informações, datas e local deste evento.</p>
          </div>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={saving || uploading} className="w-full md:w-auto px-8 shrink-0">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      <Card className="p-0 overflow-hidden border-gray-800">
        <div className="flex border-b border-gray-800 bg-ohel-surface/50 overflow-x-auto">
          <button type="button" onClick={() => setActiveTab("dados")} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "dados" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}><Calendar className="w-4 h-4" /> Dados do Evento</button>
          <button type="button" onClick={() => setActiveTab("local")} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "local" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}><MapPin className="w-4 h-4" /> Local e Cartaz</button>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          {activeTab === "dados" && (
            <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="md:col-span-2"><Input label="Nome do Evento *" name="nome" value={formData.nome} onChange={handleChange} required /></div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Status do Evento</label>
                  <select name="status" value={formData.status} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                    <option value="Aberto">Aberto (Inscrições Abertas)</option><option value="Encerrado">Encerrado</option><option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              {/* CHECKBOX NO TOPO */}
              <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" name="publicar_mural" checked={formData.publicar_mural} onChange={handleChange} className="peer appearance-none w-6 h-6 border-2 border-gray-500 rounded bg-transparent checked:bg-ohel-blue checked:border-ohel-blue transition-all cursor-pointer" />
                    <CheckCircle className="w-4 h-4 text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-ohel-blue transition-colors flex items-center gap-2"><Megaphone className="w-4 h-4 text-purple-400" /> Publicar no Mural de Comunicações</p>
                    <p className="text-[11px] text-gray-400">O cartaz deste evento aparecerá em destaque no mural da igreja.</p>
                  </div>
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Descrição (Opcional)</label>
                <textarea name="descricao" value={formData.descricao} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm min-h-[100px] resize-y" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Congregação</label>
                  <select name="congregacao_id" value={formData.congregacao_id} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                    <option value="">Todas as Congregações / Geral</option>
                    {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <Input label="Hora Abertura" type="time" name="hora_abertura" value={formData.hora_abertura} onChange={handleChange} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-gray-800 pt-5 mt-2">
                <Input label="Data de Início *" type="date" name="data_inicio" value={formData.data_inicio} onChange={handleChange} required />
                <Input label="Data de Término" type="date" name="data_fim" value={formData.data_fim} onChange={handleChange} />
                <Input label="Limite de Inscrição" type="date" name="data_limite_inscricao" value={formData.data_limite_inscricao} onChange={handleChange} />
              </div>

              <div className="md:w-1/2">
                <Input label="Quantidade Limite de Pessoas" type="number" name="limite_participantes" value={formData.limite_participantes} onChange={handleChange} />
              </div>
            </div>
          )}

          {activeTab === "local" && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Cartaz do Evento</label>
                  <span className="text-[10px] text-gray-500">Imagem ou PDF (máx 2MB)</span>
                </div>
                <div onClick={() => fileInputRef.current?.click()} className="w-full h-40 bg-ohel-bg border-2 border-dashed border-gray-700 hover:border-ohel-blue rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden group">
                  {formData.cartaz_url ? (
                    <>
                      <Image src={formData.cartaz_url} alt="Cartaz" fill className="object-cover opacity-50 group-hover:opacity-70 transition-opacity" />
                      <div className="z-10 bg-black/60 p-2 rounded-lg flex items-center gap-2 text-white text-xs font-bold backdrop-blur-md"><ImageIcon className="w-4 h-4" /> Trocar Imagem</div>
                    </>
                  ) : (
                    <><Upload className="w-8 h-8 text-gray-500 mb-2 group-hover:text-ohel-blue transition-colors" /><p className="text-sm font-medium text-white">Clique para anexar o Cartaz</p></>
                  )}
                  {uploading && <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20"><Loader2 className="w-6 h-6 text-ohel-blue animate-spin" /></div>}
                </div>
                <input type="file" accept="image/*, application/pdf" ref={fileInputRef} onChange={handleUploadCartaz} className="hidden" />
                <GenerateEventImage eventName={formData.nome} onImageReady={url => setFormData(current => ({ ...current, cartaz_url: url }))} />
              </div>

              <div className="border-t border-gray-800 pt-5 mt-2">
                <h3 className="text-sm font-semibold text-white mb-4">Endereço do Evento (Opcional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                  <Input label="CEP" name="cep" value={formData.cep} onChange={handleChange} />
                  <div className="md:col-span-3"><Input label="Logradouro" name="logradouro" value={formData.logradouro} onChange={handleChange} /></div>
                  <Input label="Número" name="numero" value={formData.numero} onChange={handleChange} />
                  <Input label="Complemento" name="complemento" value={formData.complemento} onChange={handleChange} />
                  <Input label="Bairro" name="bairro" value={formData.bairro} onChange={handleChange} className="md:col-span-2" />
                  <Input label="Cidade" name="cidade" value={formData.cidade} onChange={handleChange} className="md:col-span-3" />
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">UF</label>
                    <select name="uf" value={formData.uf} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                      <option value="">UF</option><option value="RJ">RJ</option><option value="SP">SP</option><option value="MG">MG</option><option value="ES">ES</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}