"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, Package, Upload, Loader2, MapPin, DollarSign } from "lucide-react";
import Link from "next/link";

export default function NovoBemPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    codigo: "",
    descricao: "",
    tipo: "Som / Áudio",
    localizacao: "",
    departamento: "",
    status: "Em Uso",
    quantidade: "1",
    valor: "",
    data_aquisicao: "",
    garantia_ate: "",
    nota_fiscal_url: ""
  });

  const tiposBens = [
    "Som / Áudio", "Instrumentos Musicais", "Informática / TI", 
    "Móveis e Utensílios", "Veículos", "Imóvel", "Outros"
  ];

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUploadNF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `nf-${Date.now()}-${Math.random()}.${fileExt}`;
      
      // Usando o bucket documentos que já criamos
      const { error } = await supabase.storage.from('documentos').upload(fileName, file);
      if (error) throw error;
      
      const { data } = supabase.storage.from('documentos').getPublicUrl(fileName);
      setFormData({ ...formData, nota_fiscal_url: data.publicUrl });
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro no Upload", message: "Não foi possível enviar o arquivo." });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) return setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada." });
    
    setLoading(true);
    try {
      const valorNumerico = parseFloat(formData.valor.replace(/\./g, '').replace(',', '.')) || 0;

      const { error } = await supabase.from("patrimonio_bens").insert([{
        igreja_id: igrejaId,
        codigo: formData.codigo,
        descricao: formData.descricao,
        tipo: formData.tipo,
        localizacao: formData.localizacao,
        departamento: formData.departamento,
        status: formData.status,
        quantidade: parseInt(formData.quantidade) || 1,
        valor: valorNumerico,
        data_aquisicao: formData.data_aquisicao || null,
        garantia_ate: formData.garantia_ate || null,
        nota_fiscal_url: formData.nota_fiscal_url || null
      }]);

      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Bem cadastrado no patrimônio!" });
      setTimeout(() => router.push("/patrimonio"), 1500);

    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro ao Cadastrar", message: error.message });
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Link href="/patrimonio" className="text-gray-400 hover:text-white transition-colors mt-0.5"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Package className="w-5 h-5 text-ohel-blue" /> Cadastrar Novo Bem
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Adicione um novo item ao inventário da igreja.</p>
          </div>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={loading || uploading} className="w-auto px-6 py-2 text-xs bg-ohel-blue hover:bg-blue-600 text-white">
          <Save className="w-3.5 h-3.5 mr-1.5" /> {loading ? "Salvando..." : "Salvar Bem"}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        
        {/* CARD 1: INFORMAÇÕES DO BEM */}
        <Card className="p-5 border-gray-800 bg-ohel-surface flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-1">
            <Package className="w-4 h-4 text-ohel-blue" />
            <h2 className="text-sm font-bold text-white">Informações do Bem</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <Input label="Descrição do Bem *" name="descricao" placeholder="Ex: Mesa de Som Behringer X32" value={formData.descricao} onChange={handleChange} required className="py-2 text-xs" />
            </div>
            <Input label="Código (Opcional)" name="codigo" placeholder="Ex: PAT-001" value={formData.codigo} onChange={handleChange} className="py-2 text-xs" />
            
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase">Tipo de Bem *</label>
              <select name="tipo" value={formData.tipo} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                {tiposBens.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase">Status *</label>
              <select name="status" value={formData.status} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                <option value="Em Uso">Em Uso</option>
                <option value="Em Manutenção">Em Manutenção</option>
                <option value="Emprestado">Emprestado</option>
                <option value="Baixado">Baixado (Descartado/Vendido)</option>
              </select>
            </div>
          </div>
        </Card>

        {/* CARD 2: LOCALIZAÇÃO E VALORES */}
        <Card className="p-5 border-gray-800 bg-ohel-surface flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-1">
            <MapPin className="w-4 h-4 text-ohel-blue" />
            <h2 className="text-sm font-bold text-white">Localização e Valores</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Input label="Localização Física" name="localizacao" placeholder="Ex: Templo Principal, Sala 2..." value={formData.localizacao} onChange={handleChange} className="py-2 text-xs" />
            </div>
            <div className="md:col-span-2">
              <Input label="Departamento Responsável" name="departamento" placeholder="Ex: Louvor, Mídia, Infantil..." value={formData.departamento} onChange={handleChange} className="py-2 text-xs" />
            </div>
            
            <Input label="Quantidade *" type="number" min="1" name="quantidade" value={formData.quantidade} onChange={handleChange} required className="py-2 text-xs" />
            <div className="md:col-span-3">
              <Input label="Valor de Aquisição (R$)" name="valor" placeholder="0,00" value={formData.valor} onChange={handleChange} className="py-2 text-xs" />
            </div>

            <div className="md:col-span-2">
              <Input label="Data de Aquisição" type="date" name="data_aquisicao" value={formData.data_aquisicao} onChange={handleChange} className="py-2 text-xs" />
            </div>
            <div className="md:col-span-2">
              <Input label="Garantia Válida Até" type="date" name="garantia_ate" value={formData.garantia_ate} onChange={handleChange} className="py-2 text-xs" />
            </div>
          </div>
        </Card>

        {/* CARD 3: DOCUMENTAÇÃO */}
        <Card className="p-5 border-gray-800 bg-ohel-surface flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-1">
            <DollarSign className="w-4 h-4 text-ohel-blue" />
            <h2 className="text-sm font-bold text-white">Documentação e Nota Fiscal</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <input type="file" accept=".pdf, image/*" ref={fileInputRef} onChange={handleUploadNF} className="hidden" />
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-auto px-4 py-2 text-xs">
              {uploading ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Enviando...</> : <><Upload className="w-3.5 h-3.5 mr-2" /> Anexar Nota Fiscal</>}
            </Button>
            {formData.nota_fiscal_url && (
              <a href={formData.nota_fiscal_url} target="_blank" className="text-xs text-ohel-blue hover:underline">
                Ver arquivo anexado
              </a>
            )}
          </div>
        </Card>

        <div className="flex justify-end gap-3 mt-2">
          <Link href="/patrimonio" className="px-6 py-2.5 text-xs font-medium text-gray-400 hover:text-white transition-colors">
            Cancelar
          </Link>
          <Button type="submit" variant="primary" disabled={loading || uploading} className="w-auto px-8 py-2.5 text-xs bg-ohel-blue hover:bg-blue-600 text-white shadow-lg">
            <Save className="w-4 h-4 mr-2" /> Salvar Bem
          </Button>
        </div>

      </form>
    </div>
  );
}