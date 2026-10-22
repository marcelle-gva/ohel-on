"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, Building2, MapPin, Landmark } from "lucide-react";
import Link from "next/link";

export default function NovaCongregacaoPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("geral");
  const [loading, setLoading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    nome: "", tipo: "Congregação", cnpj: "", telefone: "",
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
    dirigente: "", tesoureiro: "", secretario: "",
    pix_tipo: "", pix_chave: "", favorecido: "", banco: "", agencia: "", conta: "", tipo_conta: ""
  });

  useEffect(() => {
    const getIgreja = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (data) setIgrejaId(data.igreja_id);
      }
    };
    getIgreja();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) return setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada." });
    
    setLoading(true);
    try {
      const { error } = await supabase.from("congregacoes").insert([{ igreja_id: igrejaId, ...formData }]);
      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Congregação cadastrada com sucesso!" });
      setTimeout(() => router.push("/secretaria/congregacoes"), 1500);
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro ao Cadastrar", message: error.message });
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Link href="/secretaria/congregacoes" className="text-gray-400 hover:text-white transition-colors mt-0.5"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Nova Congregação</h1>
            <p className="text-gray-400 text-xs mt-0.5">Cadastre uma filial ou ponto de pregação.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/secretaria/congregacoes" className="text-gray-400 hover:text-white px-3 py-2 text-xs font-medium transition-colors">Cancelar</Link>
          <Button variant="primary" onClick={handleSubmit} disabled={loading} className="w-auto px-6 py-2 text-xs">
            <Save className="w-3.5 h-3.5 mr-1.5" /> {loading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden border-gray-800 flex flex-col">
        <div className="flex border-b border-gray-800 bg-ohel-surface/50 overflow-x-auto shrink-0">
          <button type="button" onClick={() => setActiveTab("geral")} className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "geral" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}>
            <Building2 className="w-4 h-4" /> Informações Básicas
          </button>
          <button type="button" onClick={() => setActiveTab("endereco")} className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "endereco" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}>
            <MapPin className="w-4 h-4" /> Endereço
          </button>
          <button type="button" onClick={() => setActiveTab("financeiro")} className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "financeiro" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}>
            <Landmark className="w-4 h-4" /> Financeiro e PIX
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {activeTab === "geral" && (
            <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2"><Input label="Nome da Congregação *" name="nome" placeholder="Ex: Templo Central" value={formData.nome} onChange={handleChange} required className="py-2 text-xs" /></div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Tipo</label>
                  <select name="tipo" value={formData.tipo} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                    <option value="Matriz">Matriz</option>
                    <option value="Congregação">Congregação</option>
                    <option value="Ponto de Pregação">Ponto de Pregação</option>
                  </select>
                </div>
                <Input label="CNPJ" name="cnpj" placeholder="00.000.000/0000-00" value={formData.cnpj} onChange={handleChange} className="py-2 text-xs" />
                <Input label="Telefone" name="telefone" placeholder="(00) 00000-0000" value={formData.telefone} onChange={handleChange} className="py-2 text-xs md:col-span-2" />
              </div>
              <div className="border-t border-gray-800 pt-4 mt-1">
                <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-3">Liderança</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input label="Dirigente / Pastor" name="dirigente" placeholder="Nome" value={formData.dirigente} onChange={handleChange} className="py-2 text-xs" />
                  <Input label="Tesoureiro" name="tesoureiro" placeholder="Nome" value={formData.tesoureiro} onChange={handleChange} className="py-2 text-xs" />
                  <Input label="Secretário" name="secretario" placeholder="Nome" value={formData.secretario} onChange={handleChange} className="py-2 text-xs" />
                </div>
              </div>
            </div>
          )}

          {activeTab === "endereco" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Input label="CEP" name="cep" placeholder="00000-000" value={formData.cep} onChange={handleChange} className="py-2 text-xs" />
              <Input label="Logradouro" name="logradouro" placeholder="Rua, Avenida, etc." value={formData.logradouro} onChange={handleChange} className="py-2 text-xs md:col-span-3" />
              <Input label="Número" name="numero" placeholder="123" value={formData.numero} onChange={handleChange} className="py-2 text-xs" />
              <Input label="Complemento" name="complemento" placeholder="Apto, Sala" value={formData.complemento} onChange={handleChange} className="py-2 text-xs md:col-span-3" />
              <Input label="Bairro" name="bairro" placeholder="Centro" value={formData.bairro} onChange={handleChange} className="py-2 text-xs md:col-span-2" />
              <Input label="Cidade" name="cidade" placeholder="Sua Cidade" value={formData.cidade} onChange={handleChange} className="py-2 text-xs" />
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">UF</label>
                <select name="uf" value={formData.uf} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                  <option value="">UF</option><option value="RJ">RJ</option><option value="SP">SP</option><option value="MG">MG</option><option value="ES">ES</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === "financeiro" && (
            <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p className="text-[11px] text-gray-500 mb-1">Informações para dízimos e ofertas via PIX.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Tipo de Chave PIX</label>
                  <select name="pix_tipo" value={formData.pix_tipo} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                    <option value="">Selecione...</option><option value="CNPJ">CNPJ</option><option value="CPF">CPF</option><option value="Email">E-mail</option><option value="Telefone">Telefone</option><option value="Aleatória">Aleatória</option>
                  </select>
                </div>
                <div className="md:col-span-2"><Input label="Chave PIX" name="pix_chave" value={formData.pix_chave} onChange={handleChange} className="py-2 text-xs" /></div>
                <div className="md:col-span-3"><Input label="Favorecido / Titular" name="favorecido" value={formData.favorecido} onChange={handleChange} className="py-2 text-xs" /></div>
              </div>
              <div className="border-t border-gray-800 pt-4 mt-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input label="Nome do Banco" name="banco" value={formData.banco} onChange={handleChange} className="py-2 text-xs" />
                <Input label="Agência" name="agencia" value={formData.agencia} onChange={handleChange} className="py-2 text-xs" />
                <Input label="Conta (com dígito)" name="conta" value={formData.conta} onChange={handleChange} className="py-2 text-xs" />
              </div>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}