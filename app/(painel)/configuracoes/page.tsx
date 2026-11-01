"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { Settings, Upload, Loader2, Save, Building2, MapPin, Phone, ArrowRight, ShieldCheck, Lock, Plus, Trash2, Users, UserPlus, CreditCard } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function ConfiguracoesPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  // Dados da Igreja
  const [formData, setFormData] = useState({
    nome: "", cnpj: "", endereco: "", telefone: "", email: "", logo_url: ""
  });

  // Departamentos e Cargos
  const [departamentos, setDepartamentos] = useState<any[]>([]);
  const [cargos, setCargos] = useState<any[]>([]);
  const [novoDepto, setNovoDepto] = useState("");
  const [novoCargo, setNovoCargo] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) {
          setIgrejaId(user.igreja_id);
          
          const { data: igreja } = await supabase.from('igrejas').select('*').eq('id', user.igreja_id).single();
          if (igreja) {
            setFormData({
              nome: igreja.nome || "", cnpj: igreja.cnpj || "", endereco: igreja.endereco || "",
              telefone: igreja.telefone || "", email: igreja.email || "", logo_url: igreja.logo_url || ""
            });
          }

          const { data: deps } = await supabase.from('departamentos').select('*').eq('igreja_id', user.igreja_id).order('nome');
          if (deps) setDepartamentos(deps);

          const { data: crgs } = await supabase.from('cargos').select('*').eq('igreja_id', user.igreja_id).order('nome');
          if (crgs) setCargos(crgs);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${igrejaId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, file);
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
      setFormData({ ...formData, logo_url: data.publicUrl });
      setModal({ isOpen: true, type: "success", title: "Logo Enviada", message: "Não esqueça de clicar em Salvar Configurações!" });
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro no Upload", message: "Verifique se o bucket 'logos' está público." });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('igrejas').update({
        nome: formData.nome, cnpj: formData.cnpj, endereco: formData.endereco,
        telefone: formData.telefone, email: formData.email, logo_url: formData.logo_url
      }).eq('id', igrejaId);

      if (error) throw error;
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Configurações salvas!" });
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleAddDepto = async () => {
    if (!novoDepto || !igrejaId) return;
    const { data } = await supabase.from('departamentos').insert([{ igreja_id: igrejaId, nome: novoDepto }]).select().single();
    if (data) setDepartamentos([...departamentos, data]);
    setNovoDepto("");
  };

  const handleDeleteDepto = async (id: string) => {
    await supabase.from('departamentos').delete().eq('id', id);
    setDepartamentos(departamentos.filter(d => d.id !== id));
  };

  const handleAddCargo = async () => {
    if (!novoCargo || !igrejaId) return;
    const { data } = await supabase.from('cargos').insert([{ igreja_id: igrejaId, nome: novoCargo }]).select().single();
    if (data) setCargos([...cargos, data]);
    setNovoCargo("");
  };

  const handleDeleteCargo = async (id: string) => {
    await supabase.from('cargos').delete().eq('id', id);
    setCargos(cargos.filter(c => c.id !== id));
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando configurações...</div>;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      {/* CABEÇALHO */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-ohel-blue flex items-center justify-center shadow-lg">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Configurações da Igreja</h1>
          <p className="text-gray-400 text-xs mt-0.5">Dados institucionais, segurança e gestão.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        
        {/* 1. IDENTIDADE VISUAL */}
        <Card className="p-5 border-gray-800 bg-ohel-surface">
          <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-4 border-b border-gray-800 pb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Identidade Visual
          </h3>
          
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-40 h-24 bg-ohel-bg rounded-lg border border-dashed border-gray-700 flex items-center justify-center overflow-hidden relative">
              {formData.logo_url ? (
                <Image src={formData.logo_url} alt="Logo" fill className="object-contain p-2" />
              ) : (
                <span className="text-xs text-gray-500">Sem Logo</span>
              )}
            </div>
            <div>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleUploadLogo} className="hidden" />
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-auto px-5 py-2 text-xs">
                {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> Enviando...</> : <><Upload className="w-3.5 h-3.5 mr-2" /> Alterar Logo</>}
              </Button>
            </div>
          </div>
        </Card>

        {/* 2. DADOS INSTITUCIONAIS */}
        <Card className="p-5 border-gray-800 bg-ohel-surface">
          <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-4 border-b border-gray-800 pb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Dados Institucionais
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input label="Nome da Igreja / Denominação *" name="nome" value={formData.nome} onChange={handleChange} required className="py-2 text-xs" />
            </div>
            <Input label="CNPJ" name="cnpj" placeholder="00.000.000/0000-00" value={formData.cnpj} onChange={handleChange} className="py-2 text-xs" />
            <div className="relative">
              <Phone className="w-3.5 h-3.5 absolute left-3 top-8 text-gray-500" />
              <Input label="Telefone / WhatsApp" name="telefone" placeholder="(00) 0000-0000" value={formData.telefone} onChange={handleChange} className="py-2 text-xs pl-9" />
            </div>
            <div className="md:col-span-2">
              <Input label="E-mail de Contato" type="email" name="email" placeholder="contato@igreja.com" value={formData.email} onChange={handleChange} className="py-2 text-xs" />
            </div>
            <div className="md:col-span-2">
              <Input label="Endereço Completo" name="endereco" placeholder="Rua, número, bairro, cidade - UF" value={formData.endereco} onChange={handleChange} className="py-2 text-xs" />
            </div>
          </div>
        </Card>

        {/* 3. DEPARTAMENTOS E CARGOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5 border-gray-800 bg-ohel-surface flex flex-col">
            <h3 className="text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">
              Departamentos da Igreja
            </h3>
            <div className="flex gap-2 mb-4">
              <Input placeholder="Ex: Louvor, Infantil..." value={novoDepto} onChange={(e) => setNovoDepto(e.target.value)} className="py-2 text-xs flex-1" />
              <Button type="button" onClick={handleAddDepto} variant="secondary" className="w-auto px-3 py-2"><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {departamentos.map(d => (
                <div key={d.id} className="flex items-center gap-2 bg-ohel-bg border border-gray-700 px-3 py-1.5 rounded-lg text-xs text-white">
                  {d.nome}
                  <button type="button" onClick={() => handleDeleteDepto(d.id)} className="text-red-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 border-gray-800 bg-ohel-surface flex flex-col">
            <h3 className="text-[11px] font-bold text-yellow-500 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">
              Cargos Eclesiásticos
            </h3>
            <div className="flex gap-2 mb-4">
              <Input placeholder="Ex: Diácono, Presbítero..." value={novoCargo} onChange={(e) => setNovoCargo(e.target.value)} className="py-2 text-xs flex-1" />
              <Button type="button" onClick={handleAddCargo} variant="secondary" className="w-auto px-3 py-2"><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {cargos.map(c => (
                <div key={c.id} className="flex items-center gap-2 bg-ohel-bg border border-gray-700 px-3 py-1.5 rounded-lg text-xs text-white">
                  {c.nome}
                  <button type="button" onClick={() => handleDeleteCargo(c.id)} className="text-red-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* 4. RECURSOS ADICIONAIS */}
        <div className="mt-2">
          <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-3 ml-1">
            Recursos Adicionais
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Check-in */}
            <Link 
              href="/configuracoes/checkin" 
              className="flex items-center justify-between bg-ohel-surface border border-gray-800 hover:border-ohel-blue p-4 rounded-xl transition-colors group shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-ohel-blue" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-ohel-blue transition-colors">Configurar Check-in</p>
                  <p className="text-[11px] text-gray-400">Horários e GPS.</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-ohel-blue transition-all" />
            </Link>

            {/* Segurança da Conta (2FA) */}
            <Link 
              href="/configuracoes/seguranca" 
              className="flex items-center justify-between bg-ohel-surface border border-gray-800 hover:border-ohel-blue p-4 rounded-xl transition-colors group shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-ohel-blue transition-colors">Segurança da Conta</p>
                  <p className="text-[11px] text-gray-400">Ativar 2FA (Login).</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-ohel-blue transition-all" />
            </Link>

            {/* GRUPOS E PERMISSÕES */}
            <Link 
              href="/configuracoes/grupos" 
              className="flex items-center justify-between bg-ohel-surface border border-gray-800 hover:border-ohel-blue p-4 rounded-xl transition-colors group shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-ohel-blue transition-colors">Grupos e Permissões</p>
                  <p className="text-[11px] text-gray-400">Controle o que cada um acessa.</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-ohel-blue transition-all" />
            </Link>

            {/* Gestão de Usuários */}
            <Link 
              href="/configuracoes/usuarios" 
              className="flex items-center justify-between bg-ohel-surface border border-gray-800 hover:border-ohel-blue p-4 rounded-xl transition-colors group shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-ohel-blue transition-colors">Gestão de Usuários</p>
                  <p className="text-[11px] text-gray-400">Vincule pessoas aos grupos.</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-ohel-blue transition-all" />
            </Link>

            {/* Administradores */}
            <Link
              href="/configuracoes/administradores"
              className="flex items-center justify-between bg-ohel-surface border border-gray-800 hover:border-ohel-blue p-4 rounded-xl transition-colors group shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-ohel-blue transition-colors">Administradores</p>
                  <p className="text-[11px] text-gray-400">Convide e revogue administradores.</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-ohel-blue transition-all" />
            </Link>

            {/* Faturamento */}
            <Link
              href="/configuracoes/faturamento"
              className="flex items-center justify-between bg-ohel-surface border border-cyan-500/20 hover:border-cyan-400 p-4 rounded-xl transition-colors group shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">Faturamento</p>
                  <p className="text-[11px] text-gray-400">Plano mensal de R$ 80,00.</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-all" />
            </Link>

          </div>
        </div>

        {/* BOTÃO SALVAR */}
        <div className="flex justify-end mt-4">
          <Button type="submit" variant="primary" disabled={saving || uploading} className="w-auto px-8 py-2.5 text-xs bg-ohel-blue hover:bg-blue-600 text-white shadow-lg">
            <Save className="w-4 h-4 mr-2" /> {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>

      </form>
    </div>
  );
}
