"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createSignedStorageUrl } from "@/lib/storage";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, Plus, Minus, Search, Upload, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { parseCurrencyInput } from "@/lib/currency";

export default function NovaTransacaoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  // Listas
  const [caixas, setCaixas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [formas, setFormas] = useState<any[]>([]);
  const [congregacoes, setCongregacoes] = useState<any[]>([]);
  const [membros, setMembros] = useState<any[]>([]);

  const [tipo, setTipo] = useState<"Receita" | "Despesa">("Receita");

  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    mes_referencia: new Date().toISOString().slice(0, 7),
    valor: "",
    forma_pagamento_id: "",
    categoria_id: "",
    caixa_id: "",
    departamento: "",
    congregacao_id: "",
    membro_id: "",
    origem_nome_manual: "",
    descricao: "",
    conciliado: false,
    comprovante_url: ""
  });

  const [buscaMembro, setBuscaMembro] = useState("");
  const [showMembros, setShowMembros] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) {
          setIgrejaId(user.igreja_id);
          const [cx, cat, frm, cong, mem] = await Promise.all([
            supabase.from('caixas').select('*').eq('igreja_id', user.igreja_id),
            supabase.from('categorias_financeiras').select('*').eq('igreja_id', user.igreja_id),
            supabase.from('formas_pagamento').select('*').eq('igreja_id', user.igreja_id),
            supabase.from('congregacoes').select('*').eq('igreja_id', user.igreja_id),
            supabase.from('membros').select('*').eq('igreja_id', user.igreja_id).order('nome')
          ]);
          if (cx.data) setCaixas(cx.data);
          if (cat.data) setCategorias(cat.data);
          if (frm.data) setFormas(frm.data);
          if (cong.data) setCongregacoes(cong.data);
          if (mem.data) setMembros(mem.data);
        }
      }
    };
    init();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
      const { error } = await supabase.storage.from('documentos').upload(fileName, file);
      if (error) throw error;
      const signedUrl = await createSignedStorageUrl('documentos', fileName);
      setFormData({ ...formData, comprovante_url: signedUrl });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Erro ao enviar comprovante." });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) return;
    
    setLoading(true);

    try {
      // ==========================================
      // PROTEÇÃO: VERIFICAR SE O MÊS ESTÁ FECHADO
      // ==========================================
      const mesesDaTransacao = [...new Set([formData.mes_referencia, formData.data.slice(0, 7)])];
      const { data: mesFechado, error: errorMes } = await supabase
        .from('meses_fechados')
        .select('mes_referencia')
        .eq('igreja_id', igrejaId)
        .in('mes_referencia', mesesDaTransacao)
        .limit(1)
        .maybeSingle();

      if (errorMes) throw errorMes;

      if (mesFechado) {
        setModal({ 
          isOpen: true, 
          type: "error", 
          title: "Mês Fechado", 
          message: `Não é possível lançar esta transação porque o mês ${mesFechado.mes_referencia} está fechado. Reabra o mês no painel financeiro para continuar.` 
        });
        setLoading(false);
        return;
      }
      // ==========================================

      const valorNumerico = parseCurrencyInput(formData.valor);
      if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
        throw new Error("Informe um valor maior que zero.");
      }
      
      const { error } = await supabase.from("transacoes").insert([{
        igreja_id: igrejaId,
        tipo,
        data: formData.data,
        mes_referencia: formData.mes_referencia,
        valor: valorNumerico,
        caixa_id: formData.caixa_id || null,
        categoria_id: formData.categoria_id || null,
        forma_pagamento_id: formData.forma_pagamento_id || null,
        congregacao_id: formData.congregacao_id || null,
        membro_id: formData.membro_id || null,
        origem_nome_manual: formData.origem_nome_manual,
        departamento: formData.departamento,
        descricao: formData.descricao,
        conciliado: formData.conciliado,
        comprovante_url: formData.comprovante_url || null
      }]);

      if (error) throw error;
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Transação registrada!" });
      setTimeout(() => router.push("/financeiro/movimento"), 1500);
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
      setLoading(false);
    }
  };

  const membrosFiltrados = membros.filter(m => m.nome.toLowerCase().includes(buscaMembro.toLowerCase()));

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Link href="/financeiro/movimento" className="text-gray-400 hover:text-white transition-colors mt-0.5"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Nova Transação</h1>
            <p className="text-gray-400 text-xs mt-0.5">Registre uma entrada ou saída financeira.</p>
          </div>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          {/* Toggle Receita/Despesa */}
          <div className="grid grid-cols-2 gap-3 bg-ohel-bg p-1.5 rounded-lg border border-gray-800">
            <button type="button" onClick={() => setTipo("Receita")} className={`py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-colors ${tipo === "Receita" ? "bg-green-500/20 text-green-400 border border-green-500/30" : "text-gray-500 hover:text-white"}`}>
              <Plus className="w-4 h-4" /> Receita (Entrada)
            </button>
            <button type="button" onClick={() => setTipo("Despesa")} className={`py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-colors ${tipo === "Despesa" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "text-gray-500 hover:text-white"}`}>
              <Minus className="w-4 h-4" /> Despesa (Saída)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input label="Data *" type="date" name="data" value={formData.data} onChange={handleChange} required className="py-2 text-xs" />
            <Input label="Mês/Ano Ref *" type="month" name="mes_referencia" value={formData.mes_referencia} onChange={handleChange} required className="py-2 text-xs" />
            <CurrencyInput label="Valor (R$) *" name="valor" value={formData.valor} onChange={(value) => setFormData((current) => ({ ...current, valor: value }))} required className="py-2 text-xs" />
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Forma Pagto *</label>
              <select name="forma_pagamento_id" value={formData.forma_pagamento_id} onChange={handleChange} required className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                <option value="">Selecione...</option>
                {formas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Categoria *</label>
              <select name="categoria_id" value={formData.categoria_id} onChange={handleChange} required className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                <option value="">Selecione...</option>
                {categorias.filter(c => c.tipo === tipo).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Caixa / Conta *</label>
              <select name="caixa_id" value={formData.caixa_id} onChange={handleChange} required className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                <option value="">Selecione...</option>
                {caixas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <Input label="Departamento" name="departamento" placeholder="Ex: Louvor, Missões" value={formData.departamento} onChange={handleChange} className="py-2 text-xs" />
          </div>

          {/* Origem / Membro */}
          <div className="bg-ohel-bg border border-gray-800 p-4 rounded-xl flex flex-col gap-4">
            <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider">Origem da {tipo}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="text-[10px] font-semibold text-ohel-silver uppercase mb-1.5 block">Pesquisar Membro / Contribuinte</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="Digite o nome..." 
                    value={formData.membro_id ? membros.find(m => m.id === formData.membro_id)?.nome : buscaMembro}
                    onChange={(e) => { setBuscaMembro(e.target.value); setFormData({...formData, membro_id: ""}); setShowMembros(true); }}
                    onFocus={() => setShowMembros(true)}
                    className="input-ohel w-full pl-9 pr-3 py-2 rounded-md text-xs"
                  />
                </div>
                {showMembros && buscaMembro.length > 1 && !formData.membro_id && (
                  <div className="absolute top-full left-0 w-full mt-1 bg-ohel-surface border border-gray-700 rounded-md shadow-2xl z-50 max-h-40 overflow-y-auto">
                    {membrosFiltrados.map(m => (
                      <button key={m.id} type="button" onClick={() => { setFormData({...formData, membro_id: m.id, origem_nome_manual: ""}); setBuscaMembro(""); setShowMembros(false); }} className="w-full text-left p-2 hover:bg-white/5 text-xs text-white">
                        {m.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-ohel-silver uppercase mb-1.5">Congregação</label>
                <select name="congregacao_id" value={formData.congregacao_id} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                  <option value="">Selecione...</option>
                  {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>
            
            <Input label="Ou digite um nome manual (se não for membro)" name="origem_nome_manual" placeholder="Ex: Visitante João" value={formData.origem_nome_manual} onChange={handleChange} disabled={!!formData.membro_id} className="py-2 text-xs" />
          </div>

          <Input label="Descrição Complemento" name="descricao" placeholder="Ex: Dízimos - João da Silva" value={formData.descricao} onChange={handleChange} className="py-2 text-xs" />

          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-2 border-t border-gray-800 pt-4">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input type="checkbox" name="conciliado" checked={formData.conciliado} onChange={handleChange} className="w-4 h-4 accent-ohel-blue" />
                Conciliado?
              </label>
              
              <div className="flex items-center gap-2">
                <input type="file" id="comprovante" className="hidden" onChange={handleUpload} />
                <label htmlFor="comprovante" className="cursor-pointer bg-ohel-bg border border-gray-700 text-gray-300 px-3 py-1.5 rounded text-xs flex items-center gap-2 hover:text-white">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} 
                  {formData.comprovante_url ? "Comprovante Anexado" : "Anexar Comprovante"}
                </label>
              </div>
            </div>

            <Button type="submit" variant="primary" disabled={loading || uploading} className="w-full md:w-auto px-8 py-2 text-xs">
              {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Salvando...</> : <><Save className="w-3.5 h-3.5 mr-1.5" /> Salvar Transação</>}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
