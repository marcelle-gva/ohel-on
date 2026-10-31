"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, User, Church, MapPin, Save, Upload, Loader2, Printer } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function EditarMembroPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("pessoais");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [congregacoes, setCongregacoes] = useState<{id: string, nome: string}[]>([]);
  const [cargos, setCargos] = useState<{id: string, nome: string}[]>([]);

  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    nome: "", data_nascimento: "", sexo: "", estado_civil: "", cpf: "", telefone: "", email: "",
    cep: "", logradouro: "", numero: "", bairro: "", cidade: "", uf: "",
    data_batismo: "", cargo: "Membro", status: "Ativo",
    congregacao_id: "",
    foto_url: "",
    whatsapp_opt_in: false,
    whatsapp_opt_in_at: "",
  });

  useEffect(() => {
    const fetchDados = async () => {
      if (!id) return;
      try {
        // Busca Congregações
        const { data: congs } = await supabase.from('congregacoes').select('id, nome').order('nome');
        if (congs) setCongregacoes(congs);

        // Busca Cargos
        const { data: crgs } = await supabase.from('cargos').select('id, nome').order('nome');
        if (crgs && crgs.length > 0) {
          setCargos(crgs);
        } else {
          setCargos([
            { id: '1', nome: 'Membro' }, { id: '2', nome: 'Diácono' }, 
            { id: '3', nome: 'Presbítero' }, { id: '4', nome: 'Evangelista' }, { id: '5', nome: 'Pastor' }
          ]);
        }

        // Busca dados do Membro
        const { data, error } = await supabase.from('membros').select('*').eq('id', id).single();
        if (error) throw error;

        if (data) {
          setFormData({
            nome: data.nome || "", data_nascimento: data.data_nascimento || "", sexo: data.sexo || "",
            estado_civil: data.estado_civil || "", cpf: data.cpf || "", telefone: data.telefone || "",
            email: data.email || "", cep: data.cep || "", logradouro: data.logradouro || "",
            numero: data.numero || "", bairro: data.bairro || "", cidade: data.cidade || "",
            uf: data.uf || "", data_batismo: data.data_batismo || "", cargo: data.cargo || "Membro",
            status: data.status || "Ativo",
            congregacao_id: data.congregacao_id || "",
            foto_url: data.foto_url || "",
            whatsapp_opt_in: data.whatsapp_opt_in === true,
            whatsapp_opt_in_at: data.whatsapp_opt_in_at || "",
          });
        }
      } catch {
        setModal({ isOpen: true, type: "error", title: "Erro", message: "Erro ao carregar os dados do membro." });
      } finally {
        setLoading(false);
      }
    };
    fetchDados();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setFormData({ ...formData, foto_url: data.publicUrl });
    } catch (error) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Erro",
        message: error instanceof Error ? error.message : "Erro ao enviar foto.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const payload = {
        ...formData,
        congregacao_id: formData.congregacao_id || null,
        data_nascimento: formData.data_nascimento ? formData.data_nascimento : null,
        data_batismo: formData.data_batismo ? formData.data_batismo : null,
        whatsapp_opt_in_at: formData.whatsapp_opt_in
          ? (formData.whatsapp_opt_in_at || new Date().toISOString())
          : null,
      };

      const { error } = await supabase.from("membros").update(payload).eq("id", id);
      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Membro atualizado com sucesso!" });
    } catch (error) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Erro ao Atualizar",
        message: error instanceof Error ? error.message : "Não foi possível atualizar o membro.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    setModal({ ...modal, isOpen: false });
    if (modal.type === "success") router.push("/secretaria/membros");
  };

  if (loading) return <div className="w-full h-full flex items-center justify-center text-gray-400">Carregando dados...</div>;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={handleCloseModal} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/secretaria/membros" className="text-gray-400 hover:text-white transition-colors mt-1">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Editar Membro</h1>
            <p className="text-gray-400 text-sm mt-1">Atualize os dados cadastrais deste membro.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <a href={`/imprimir/membro/${id}`} target="_blank" className="bg-ohel-surface border border-gray-700 hover:border-ohel-blue text-white font-medium py-2.5 px-4 rounded-md transition-all flex items-center justify-center gap-2 text-sm w-full md:w-auto">
            <Printer className="w-4 h-4" /> Imprimir Ficha
          </a>
          <Button variant="primary" onClick={handleSubmit} disabled={saving || uploading} className="w-full md:w-auto px-8 shrink-0">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden border-gray-800">
        <div className="flex border-b border-gray-800 bg-ohel-surface/50 overflow-x-auto">
          <button type="button" onClick={() => setActiveTab("pessoais")} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "pessoais" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}>
            <User className="w-4 h-4" /> Dados Pessoais
          </button>
          <button type="button" onClick={() => setActiveTab("eclesiasticos")} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "eclesiasticos" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}>
            <Church className="w-4 h-4" /> Dados Eclesiásticos
          </button>
          <button type="button" onClick={() => setActiveTab("endereco")} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "endereco" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}>
            <MapPin className="w-4 h-4" /> Endereço
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          {activeTab === "pessoais" && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-6 pb-6 border-b border-gray-800">
                <div className="w-24 h-24 bg-ohel-bg rounded-xl border border-dashed border-gray-700 flex items-center justify-center text-gray-500 overflow-hidden relative">
                  {formData.foto_url ? <Image src={formData.foto_url} alt="Preview" fill sizes="100px" className="object-cover" /> : <User className="w-8 h-8" />}
                </div>
                <div>
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleUploadFoto} className="hidden" />
                  <Button type="button" variant="secondary" className="w-auto px-4 py-2 text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Enviando...</> : <><Upload className="w-3 h-3 mr-2" /> Alterar Foto</>}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2"><Input label="Nome Completo *" name="nome" value={formData.nome} onChange={handleChange} required /></div>
                <Input label="Data de Nascimento" type="date" name="data_nascimento" value={formData.data_nascimento} onChange={handleChange} />
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Sexo</label>
                  <select name="sexo" value={formData.sexo} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                    <option value="">Selecione...</option><option value="Masculino">Masculino</option><option value="Feminino">Feminino</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Estado Civil</label>
                  <select name="estado_civil" value={formData.estado_civil} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                    <option value="">Selecione...</option><option value="Solteiro(a)">Solteiro(a)</option><option value="Casado(a)">Casado(a)</option><option value="Divorciado(a)">Divorciado(a)</option><option value="Viúvo(a)">Viúvo(a)</option>
                  </select>
                </div>
                <Input label="CPF" name="cpf" value={formData.cpf} onChange={handleChange} />
                <Input label="Telefone / WhatsApp" name="telefone" value={formData.telefone} onChange={handleChange} />
                <label className="md:col-span-2 flex items-start gap-3 rounded-lg border border-gray-800 bg-ohel-bg p-3 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.whatsapp_opt_in}
                    onChange={(e) => setFormData((previous) => ({
                      ...previous,
                      whatsapp_opt_in: e.target.checked,
                      whatsapp_opt_in_at: e.target.checked ? previous.whatsapp_opt_in_at : "",
                    }))}
                    className="mt-1 accent-green-500"
                  />
                  <span>
                    O membro autorizou receber mensagens da igreja pelo WhatsApp.
                    <span className="mt-1 block text-xs text-gray-500">Desmarcar retira o contato dos próximos envios.</span>
                  </span>
                </label>
                <div className="md:col-span-2"><Input label="E-mail" type="email" name="email" value={formData.email} onChange={handleChange} /></div>
              </div>
            </div>
          )}

          {activeTab === "eclesiasticos" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider mb-2 block">Congregação</label>
                <select name="congregacao_id" value={formData.congregacao_id} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                  <option value="">Selecione a Congregação...</option>
                  {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <Input label="Data de Batismo" type="date" name="data_batismo" value={formData.data_batismo} onChange={handleChange} />
              
              {/* CAMPO DE CARGO DINÂMICO */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Cargo</label>
                <select name="cargo" value={formData.cargo} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                  {cargos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                  <option value="Ativo">Ativo</option><option value="Inativo">Inativo</option><option value="Transferido">Transferido</option><option value="Disciplinado">Disciplinado</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === "endereco" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Input label="CEP" name="cep" value={formData.cep} onChange={handleChange} />
              <Input label="Logradouro (Rua/Av)" name="logradouro" value={formData.logradouro} onChange={handleChange} className="md:col-span-3" />
              <Input label="Número" name="numero" value={formData.numero} onChange={handleChange} />
              <Input label="Bairro" name="bairro" value={formData.bairro} onChange={handleChange} className="md:col-span-2" />
              <Input label="Cidade" name="cidade" value={formData.cidade} onChange={handleChange} />
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">UF</label>
                <select name="uf" value={formData.uf} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                  <option value="">UF</option><option value="RJ">RJ</option><option value="SP">SP</option><option value="MG">MG</option><option value="ES">ES</option>
                </select>
              </div>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}