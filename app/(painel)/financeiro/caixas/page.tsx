"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Plus, Landmark, Wallet, X, Edit, Trash2 } from "lucide-react";
import Link from "next/link";

export default function CaixasPage() {
  const [loading, setLoading] = useState(true);
  const [caixas, setCaixas] = useState<any[]>([]);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  
  const [showModal, setShowModal] = useState(false);
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
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('caixas').insert([{
        igreja_id: igrejaId,
        nome: formData.nome,
        tipo: formData.tipo,
        banco: formData.banco,
        agencia: formData.agencia,
        conta: formData.conta,
        saldo_inicial: parseFloat(formData.saldo_inicial.replace(',', '.')) || 0
      }]);

      if (error) throw error;
      
      setShowModal(false);
      setFormData({ nome: "", tipo: "Caixa Físico", banco: "", agencia: "", conta: "", saldo_inicial: "" });
      fetchCaixas(igrejaId!);
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Caixa cadastrado!" });
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
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
                <p className="text-sm font-bold text-white">R$ {Number(caixa.saldo_inicial).toFixed(2).replace('.', ',')}</p>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-gray-500 hover:text-ohel-blue"><Edit className="w-4 h-4" /></button>
                <button className="text-gray-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
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
              <h3 className="text-sm font-bold text-white">Novo Caixa / Conta</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
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
                <Input label="Saldo Inicial (R$)" name="saldo_inicial" type="number" step="0.01" placeholder="0.00" value={formData.saldo_inicial} onChange={handleChange} className="py-2 text-xs" />
              </div>

              {formData.tipo === 'Conta Bancária' && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in">
                  <div className="col-span-2"><Input label="Nome do Banco" name="banco" value={formData.banco} onChange={handleChange} className="py-2 text-xs" /></div>
                  <Input label="Agência" name="agencia" value={formData.agencia} onChange={handleChange} className="py-2 text-xs" />
                  <Input label="Conta" name="conta" value={formData.conta} onChange={handleChange} className="py-2 text-xs" />
                </div>
              )}

              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white">Cancelar</button>
                <Button type="submit" className="w-auto px-5 py-2 text-xs bg-ohel-blue text-white">Salvar Caixa</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}