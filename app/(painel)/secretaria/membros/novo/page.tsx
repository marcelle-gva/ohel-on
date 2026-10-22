"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, User, Church, MapPin, Save, Upload, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function NovoMembroPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState("pessoais");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  
  const [congregacoes, setCongregacoes] = useState<{id: string, nome: string}[]>([]);
  const [cargos, setCargos] = useState<{id: string, nome: string}[]>([]);

  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    nome: "", data_nascimento: "", sexo: "", estado_civil: "", cpf: "", telefone: "", email: "",
    cep: "", logradouro: "", numero: "", bairro: "", cidade: "", uf: "",
    data_batismo: "", cargo: "Membro", status: "Ativo",
    congregacao_id: "",
    foto_url: ""
  });

  useEffect(() => {
    const initPage = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) setIgrejaId(user.igreja_id);
      }
      
      // Busca Congregações
      const { data: congs } = await supabase.from('congregacoes').select('id, nome').order('nome');
      if (congs) setCongregacoes(congs);

      // Busca Cargos cadastrados nas Configurações
      const { data: crgs } = await supabase.from('cargos').select('id, nome').order('nome');
      if (crgs && crgs.length > 0) {
        setCargos(crgs);
        // Se o cargo padrão "Membro" não existir na lista, define o primeiro como padrão
        if (!crgs.find(c => c.nome === "Membro")) {
          setFormData(prev => ({ ...prev, cargo: crgs[0].nome }));
        }
      } else {
        // Fallback caso a tabela esteja vazia
        setCargos([
          { id: '1', nome: 'Membro' }, { id: '2', nome: 'Diácono' }, 
          { id: '3', nome: 'Presbítero' }, { id: '4', nome: 'Evangelista' }, { id: '5', nome: 'Pastor' }
        ]);
      }
    };
    initPage();
  }, []);

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
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Erro ao enviar foto." });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) return setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada." });
    
    setLoading(true);
    try {
      const payload = {
        igreja_id: igrejaId,
        ...formData,
        congregacao_id: formData.congregacao_id || null,
        data_nascimento: formData.data_nascimento || null,
        data_batismo: formData.data_batismo || null,
      };

      const { error } = await supabase.from("membros").insert([payload]);
      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Membro cadastrado com sucesso!" });
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro ao Cadastrar", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModal({ ...modal, isOpen: false });
    if (modal.type === "success") router.push("/secretaria/membros");
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={handleCloseModal} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/secretaria/membros" className="text-gray-400 hover:text-white transition-colors mt-1">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Cadastro de Membro</h1>
            <p className="text-gray-400 text-sm mt-1">Preencha os dados abaixo para incluir na membresia.</p>
          </div>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={loading || uploading} className="w-full md:w-auto px-8 shrink-0">
          <Save className="w-4 h-4 mr-2" />
          {loading ? "Salvando..." : "Salvar Membro"}
        </Button>
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
                  {formData.foto_url ? (
                    <Image src={formData.foto_url} alt="Preview" fill sizes="100px" className="object-cover" />
                  ) : (
                    <User className="w-8 h-8" />
                  )}
                </div>
                <div>
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleUploadFoto} className="hidden" />
                  <Button type="button" variant="secondary" className="w-auto px-4 py-2 text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Enviando...</> : <><Upload className="w-3 h-3 mr-2" /> Adicionar Foto</>}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Input label="Nome Completo *" name="nome" placeholder="Ex: João da Silva" value={formData.nome} onChange={handleChange} required />
                </div>
                <Input label="Data de Nascimento" type="date" name="data_nascimento" value={formData.data_nascimento} onChange={handleChange} />
                
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Sexo</label>
                  <select name="sexo" value={formData.sexo} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                    <option value="">Selecione...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Estado Civil</label>
                  <select name="estado_civil" value={formData.estado_civil} onChange={handleChange} className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                    <option value="">Selecione...</option>
                    <option value="Solteiro(a)">Solteiro(a)</option>
                    <option value="Casado(a)">Casado(a)</option>
                    <option value="Divorciado(a)">Divorciado(a)</option>
                    <option value="Viúvo(a)">Viúvo(a)</option>
                  </select>
                </div>

                <Input label="CPF" name="cpf" placeholder="000.000.000-00" value={formData.cpf} onChange={handleChange} />
                <Input label="Telefone / WhatsApp" name="telefone" placeholder="(00) 00000-0000" value={formData.telefone} onChange={handleChange} />
                <div className="md:col-span-2">
                  <Input label="E-mail" type="email" name="email" placeholder="email@exemplo.com" value={formData.email} onChange={handleChange} />
                </div>
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
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                  <option value="Transferido">Transferido</option>
                  <option value="Disciplinado">Disciplinado</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === "endereco" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Input label="CEP" name="cep" placeholder="00000-000" value={formData.cep} onChange={handleChange} />
              <Input label="Logradouro (Rua/Av)" name="logradouro" placeholder="Rua Exemplo" value={formData.logradouro} onChange={handleChange} className="md:col-span-3" />
              <Input label="Número" name="numero" placeholder="123" value={formData.numero} onChange={handleChange} />
              <Input label="Bairro" name="bairro" placeholder="Centro" value={formData.bairro} onChange={handleChange} className="md:col-span-2" />
              <Input label="Cidade" name="cidade" placeholder="Sua Cidade" value={formData.cidade} onChange={handleChange} />
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