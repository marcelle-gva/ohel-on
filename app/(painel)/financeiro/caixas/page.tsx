"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Plus, Landmark, Wallet, X, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";

export default function CaixasPage() {
  const [loading, setLoading] = useState(true);
  const [caixas, setCaixas] = useState<Array<{ id: string; nome: string; tipo: string; banco: string | null; agencia: string | null; conta: string | null; saldo_inicial: number }>>([]);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  
  const [showModal, setShowModal] = useState(false);
  const [editingCaixaId, setEditingCaixaId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });
  
  const [formData, setFormData] = useState({
    nome: "", tipo: "Caixa Físico", banco: "", agencia: "", conta: "", saldo_inicial: ""
  });

  useEffect(() => {
    initPage();
  }, []);

  const initPage = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
      if (user) {
        setIgrejaId(user.igreja_id);
        fetchCaixas(user.igreja_id);
      }
    }
  };

  const fetchCaixas = async (id: string) => {
    setLoading(true);
    const { data } = await supabase.from('caixas').select('*').eq('igreja_id', id).order('nome');
    if (data) setCaixas(data);
    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((current) => ({ ...current, [e.target.name]: e.target.value }));
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada. Entre novamente no sistema." });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nome: formData.nome,
        tipo: formData.tipo,
        banco: formData.banco,
        agencia: formData.agencia,
        conta: formData.conta,
        saldo_inicial: parseCurrencyInput(formData.saldo_inicial)
      };
      if (editingCaixaId) {
        const { data, error } = await supabase.from("caixas").update(payload)
          .eq("id", editingCaixaId).eq("igreja_id", igrejaId).select("id").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Caixa não encontrado ou sem permissão para atualizar.");
      } else {
        const { error } = await supabase.from("caixas").insert([{ igreja_id: igrejaId, ...payload }]);
        if (error) throw error;
      }
      
      setShowModal(false);
      setEditingCaixaId(null);
      setFormData({ nome: "", tipo: "Caixa Físico", banco: "", agencia: "", conta: "", saldo_inicial: "" });
      await fetchCaixas(igrejaId);
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: editingCaixaId ? "Caixa atualizado!" : "Caixa cadastrado!" });
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = (caixa: typeof caixas[number]) => {
    setEditingCaixaId(caixa.id);
    setFormData({
      nome: caixa.nome || "",
      tipo: caixa.tipo || "Caixa Físico",
      banco: caixa.banco || "",
      agencia: caixa.agencia || "",
      conta: caixa.conta || "",
      saldo_inicial: formatCurrencyInput(String(Math.round(Number(caixa.saldo_inicial) * 100))),
    });
    setShowModal(true);
  };

  const fecharModal = () => {
    setShowModal(false);
    setEditingCaixaId(null);
    setFormData({ nome: "", tipo: "Caixa Físico", banco: "", agencia: "", conta: "", saldo_inicial: "" });
  };

  const handleExcluir = async (caixa: typeof caixas[number]) => {
    if (!igrejaId || !confirm(`Excluir "${caixa.nome}"? Caixas vinculados a transações não podem ser removidos.`)) return;
    try {
      const { data, error } = await supabase.from("caixas").delete()
        .eq("id", caixa.id).eq("igreja_id", igrejaId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Caixa não encontrado ou vinculado a lançamentos.");
      await fetchCaixas(igrejaId);
    } catch (error) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Não foi possível excluir",
        message: error instanceof Error ? error.message : "Erro ao excluir caixa.",
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-5 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/financeiro" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Landmark className="w-5 h-5 text-ohel-blue" /> Caixas e Contas
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Gerencie os locais onde o dinheiro da igreja fica guardado.</p>
          </div>
        </div>
        <Button onClick={() => setShowModal(true)} className="w-auto px-5 py-2 text-xs bg-ohel-blue hover:bg-blue-600 text-white">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Novo Caixa / Conta
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center py-10 text-gray-400 text-sm">Carregando caixas...</div>
        ) : caixas.map(caixa => (
          <Card key={caixa.id} className="p-5 border-gray-800 hover:border-ohel-blue/50 transition-colors group">
            <div className="flex justify-between items-start mb-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${caixa.tipo === 'Caixa Físico' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                {caixa.tipo === 'Caixa Físico' ? <Wallet className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
              </div>
              <span className="bg-ohel-bg border border-gray-700 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{caixa.tipo}</span>
            </div>
            
            <h3 className="text-base font-bold text-white mb-1">{caixa.nome}</h3>
            <p className="text-xs text-gray-500 mb-4">
              {caixa.tipo === 'Conta Bancária' ? `Banco: ${caixa.banco || '-'} | Ag: ${caixa.agencia || '-'} | CC: ${caixa.conta || '-'}` : 'Dinheiro em espécie'}
            </p>
            
            <div className="border-t border-gray-800 pt-3 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Saldo Inicial</p>
                <p className="text-sm font-bold text-white">{formatCurrency(caixa.saldo_inicial)}</p>
              </div>
              <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={() => handleEditar(caixa)} className="text-gray-500 hover:text-ohel-blue" title="Editar caixa" aria-label={`Editar ${caixa.nome}`}><Edit className="w-4 h-4" /></button>
                <button type="button" onClick={() => handleExcluir(caixa)} className="text-gray-500 hover:text-red-500" title="Excluir caixa" aria-label={`Excluir ${caixa.nome}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* MODAL DE CADASTRO */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5 border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white">{editingCaixaId ? "Editar Caixa / Conta" : "Novo Caixa / Conta"}</h3>
              <button type="button" onClick={fecharModal} className="text-gray-500 hover:text-white" aria-label="Fechar"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSalvar} className="flex flex-col gap-4">
              <Input label="Nome do Caixa / Conta *" name="nome" placeholder="Ex: Caixa da Secretaria, Banco do Brasil" value={formData.nome} onChange={handleChange} required className="py-2 text-xs" />
              
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-ohel-silver uppercase">Tipo</label>
                  <select name="tipo" value={formData.tipo} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                    <option value="Caixa Físico">Caixa Físico</option>
                    <option value="Conta Bancária">Conta Bancária</option>
                  </select>
                </div>
                <CurrencyInput label="Saldo Inicial (R$)" name="saldo_inicial" value={formData.saldo_inicial} onChange={(value) => setFormData((current) => ({ ...current, saldo_inicial: value }))} className="py-2 text-xs" />
              </div>

              {formData.tipo === 'Conta Bancária' && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in">
                  <div className="col-span-2"><Input label="Nome do Banco" name="banco" value={formData.banco} onChange={handleChange} className="py-2 text-xs" /></div>
                  <Input label="Agência" name="agencia" value={formData.agencia} onChange={handleChange} className="py-2 text-xs" />
                  <Input label="Conta" name="conta" value={formData.conta} onChange={handleChange} className="py-2 text-xs" />
                </div>
              )}

              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={fecharModal} className="px-4 py-2 text-xs text-gray-400 hover:text-white">Cancelar</button>
                <Button type="submit" disabled={saving} className="w-auto px-5 py-2 text-xs bg-ohel-blue text-white">{saving ? "Salvando..." : editingCaixaId ? "Salvar Alterações" : "Salvar Caixa"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}