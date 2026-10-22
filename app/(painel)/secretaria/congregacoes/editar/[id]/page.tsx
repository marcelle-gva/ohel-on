"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, Building2, MapPin, Landmark } from "lucide-react";
import Link from "next/link";

export default function EditarCongregacaoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [activeTab, setActiveTab] = useState("geral");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  // TIPAGEM ANY ADICIONADA AQUI PARA EVITAR ERROS DO TYPESCRIPT
  const [formData, setFormData] = useState<any>({
    nome: "", tipo: "Congregação", cnpj: "", telefone: "",
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
    dirigente: "", tesoureiro: "", secretario: "",
    pix_tipo: "", pix_chave: "", favorecido: "", banco: "", agencia: "", conta: "", tipo_conta: ""
  });

  useEffect(() => {
    const fetchDados = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase.from('congregacoes').select('*').eq('id', id).single();
        if (error) throw error;
        if (data) {
          const formattedData = { ...data };
          Object.keys(formattedData).forEach(key => { if (formattedData[key] === null) formattedData[key] = ""; });
          setFormData({ ...formData, ...formattedData });
        }
      } catch (error) {
        setModal({ isOpen: true, type: "error", title: "Erro", message: "Erro ao carregar os dados." });
      } finally {
        setLoading(false);
      }
    };
    fetchDados();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Remove campos do banco que não devem ser atualizados via UPDATE
      const { id: _, created_at: __, igreja_id: ___, ...dadosParaAtualizar } = formData;
      
      const { error } = await supabase.from("congregacoes").update(dadosParaAtualizar).eq("id", id);
      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Congregação atualizada com sucesso!" });
      setTimeout(() => router.push("/secretaria/congregacoes"), 1500);
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro ao Atualizar", message: error.message });
      setSaving(false);
    }
  };

  if (loading) return <div className="w-full h-full flex items-center justify-center text-gray-400">Carregando dados...</div>;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Link href="/secretaria/congregacoes" className="text-gray-400 hover:text-white transition-colors mt-0.5"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Editar Congregação</h1>
            <p className="text-gray-400 text-xs mt-0.5">Atualize as informações desta filial.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/secretaria/congregacoes" className="text-gray-400 hover:text-white px-3 py-2 text-xs font-medium transition-colors">Cancelar</Link>
          <Button variant="primary" onClick={handleSubmit} disabled={saving} className="w-auto px-6 py-2 text-xs">
            <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? "Salvando..." : "Salvar"}
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
                <div className="md:col-span-2"><Input label="Nome da Congregação *" name="nome" value={formData.nome} onChange={handleChange} required className="py-2 text-xs" /></div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Tipo</label>
                  <select name="tipo" value={formData.tipo} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                    <option value="Matriz">Matriz</option>
                    <option value="Congregação">Congregação</option>
                    <option value="Ponto de Pregação">Ponto de Pregação</option>
                  </select>
                </div>
                <Input label="CNPJ" name="cnpj" value={formData.cnpj} onChange={handleChange} className="py-2 text-xs" />
                <Input label="Telefone" name="telefone" value={formData.telefone} onChange={handleChange} className="py-2 text-xs md:col-span-2" />
              </div>
              <div className="border-t border-gray-800 pt-4 mt-1">
                <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-3">Liderança</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input label="Dirigente / Pastor" name="dirigente" value={formData.dirigente} onChange={handleChange} className="py-2 text-xs" />
                  <Input label="Tesoureiro" name="tesoureiro" value={formData.tesoureiro} onChange={handleChange} className="py-2 text-xs" />
                  <Input label="Secretário" name="secretario" value={formData.secretario} onChange={handleChange} className="py-2 text-xs" />
                </div>
              </div>
            </div>
          )}

          {activeTab === "endereco" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Input label="CEP" name="cep" value={formData.cep} onChange={handleChange} className="py-2 text-xs" />
              <Input label="Logradouro" name="logradouro" value={formData.logradouro} onChange={handleChange} className="py-2 text-xs md:col-span-3" />
              <Input label="Número" name="numero" value={formData.numero} onChange={handleChange} className="py-2 text-xs" />
              <Input label="Complemento" name="complemento" value={formData.complemento} onChange={handleChange} className="py-2 text-xs md:col-span-3" />
              <Input label="Bairro" name="bairro" value={formData.bairro} onChange={handleChange} className="py-2 text-xs md:col-span-2" />
              <Input label="Cidade" name="cidade" value={formData.cidade} onChange={handleChange} className="py-2 text-xs" />
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