"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { Settings, Upload, Loader2, Save, Building2, MapPin, Phone, ArrowRight, ShieldCheck, Lock, Plus, Trash2, Users, UserPlus, CreditCard, X, MonitorPlay, User, Pencil } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface MonitorAcesso {
  id: string;
  email: string;
  ativo: boolean;
}

interface MonitorUsuario {
  id: string;
  nome: string;
  email: string | null;
  foto_url: string | null;
  role: string;
}

export default function ConfiguracoesPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sistemaLogoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  // Dados da Igreja
  const [formData, setFormData] = useState({
    nome: "", cnpj: "", cep: "", endereco: "", telefone: "", email: "", logo_url: "", logo_sistema_url: "", logo_scale: 100, logo_position_x: 0, logo_position_y: 0
  });
  const logoDragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Departamentos e Cargos
  const [departamentos, setDepartamentos] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<MonitorUsuario[]>([]);
  const [cargos, setCargos] = useState<any[]>([]);
  const [novoDepto, setNovoDepto] = useState("");
  const [novoCargo, setNovoCargo] = useState("");
  const [monitorAcessos, setMonitorAcessos] = useState<MonitorAcesso[]>([]);
  const [novoMonitorEmail, setNovoMonitorEmail] = useState("");
  const [recursoAberto, setRecursoAberto] = useState<"departamentos" | "cargos" | "monitor" | null>(null);

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
              nome: igreja.nome || "", cnpj: igreja.cnpj || "", cep: igreja.cep || "", endereco: igreja.endereco || "",
              telefone: igreja.telefone || "", email: igreja.email || "", logo_url: igreja.logo_url || "", logo_sistema_url: igreja.logo_sistema_url || "", logo_scale: Number(igreja.logo_scale) || 100, logo_position_x: Number(igreja.logo_position_x) || 0, logo_position_y: Number(igreja.logo_position_y) || 0
            });
          }

          const { data: deps } = await supabase.from('departamentos').select('*, usuarios:responsavel_usuario_id(id, nome, email)').eq('igreja_id', user.igreja_id).order('nome');
          if (deps) setDepartamentos(deps);
          const { data: users } = await supabase.from('usuarios').select('id, nome, email, foto_url, role').eq('igreja_id', user.igreja_id).order('nome');
          if (users) setUsuarios(users);

          const { data: crgs } = await supabase.from('cargos').select('*').eq('igreja_id', user.igreja_id).order('nome');
          if (crgs) setCargos(crgs);
          const { data: acessosMonitor } = await supabase.from('igreja_monitor_acessos').select('id, email, ativo').eq('igreja_id', user.igreja_id).order('email');
          if (acessosMonitor) setMonitorAcessos(acessosMonitor as MonitorAcesso[]);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.name === "cep"
      ? e.target.value.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2")
      : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleLogoPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!formData.logo_url) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    logoDragRef.current = { startX: event.clientX, startY: event.clientY, x: formData.logo_position_x, y: formData.logo_position_y };
  };

  const handleLogoPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = logoDragRef.current;
    if (!drag) return;
    setFormData((current) => ({
      ...current,
      logo_position_x: Math.max(-80, Math.min(80, drag.x + event.clientX - drag.startX)),
      logo_position_y: Math.max(-60, Math.min(60, drag.y + event.clientY - drag.startY)),
    }));
  };

  const handleLogoPointerUp = () => {
    logoDragRef.current = null;
  };

  const buscarCep = async () => {
    const cep = formData.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      setBuscandoCep(true);
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error("Não foi possível consultar o CEP.");
      const data = await response.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (data.erro) {
        setModal({ isOpen: true, type: "error", title: "CEP não encontrado", message: "Confira o CEP informado e tente novamente." });
        return;
      }
      const endereco = [data.logradouro, data.bairro, data.localidade && data.uf ? `${data.localidade} - ${data.uf}` : data.localidade || data.uf]
        .filter(Boolean)
        .join(", ");
      setFormData((current) => ({ ...current, endereco }));
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Erro ao consultar CEP", message: error instanceof Error ? error.message : "Não foi possível preencher o endereço automaticamente." });
    } finally {
      setBuscandoCep(false);
    }
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

  const handleUploadSistemaLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !igrejaId) return;
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `logo-sistema-${igrejaId}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
      setFormData((current) => ({ ...current, logo_sistema_url: data.publicUrl }));
      setModal({ isOpen: true, type: "success", title: "Logo OHEL ON enviada", message: "Clique em Salvar Configurações para aplicar a nova marca." });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Erro no Upload", message: error instanceof Error ? error.message : "Verifique se o bucket 'logos' está público." });
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
        nome: formData.nome, cnpj: formData.cnpj, cep: formData.cep.replace(/\D/g, "") || null, endereco: formData.endereco,
        telefone: formData.telefone, email: formData.email, logo_url: formData.logo_url, logo_sistema_url: formData.logo_sistema_url, logo_scale: formData.logo_scale, logo_position_x: formData.logo_position_x, logo_position_y: formData.logo_position_y
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

  const handleResponsavelDepto = async (id: string, responsavel_usuario_id: string) => {
    const { data, error } = await supabase.from('departamentos').update({ responsavel_usuario_id: responsavel_usuario_id || null }).eq('id', id).select('*, usuarios:responsavel_usuario_id(id, nome, email)').single();
    if (error) { setModal({ isOpen: true, type: "error", title: "Erro", message: error.message }); return; }
    setDepartamentos((current) => current.map((departamento) => departamento.id === id ? data : departamento));
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

  const handleAddMonitor = async () => {
    const email = novoMonitorEmail.trim().toLowerCase();
    if (!igrejaId || !/^\S+@\S+\.\S+$/.test(email)) {
      setModal({ isOpen: true, type: "error", title: "E-mail inválido", message: "Informe um e-mail válido para o acesso do Monitor." });
      return;
    }
    const { data, error } = await supabase.from("igreja_monitor_acessos").insert({ igreja_id: igrejaId, email }).select("id, email, ativo").single();
    if (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível adicionar", message: error.code === "23505" ? "Esse e-mail já está autorizado como Monitor." : error.message });
      return;
    }
    if (data) setMonitorAcessos((current) => [...current, data as MonitorAcesso].sort((a, b) => a.email.localeCompare(b.email)));
    setNovoMonitorEmail("");
    setModal({ isOpen: true, type: "success", title: "Acesso adicionado", message: "No próximo login, essa conta receberá acesso ao Monitor de Mídia." });
  };

  const handleDeleteMonitor = async (id: string) => {
    const { error } = await supabase.from("igreja_monitor_acessos").delete().eq("id", id).eq("igreja_id", igrejaId || "");
    if (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível remover", message: error.message });
      return;
    }
    setMonitorAcessos((current) => current.filter((acesso) => acesso.id !== id));
  };

  const handleUploadMonitorFoto = async (acesso: MonitorAcesso, file: File) => {
    const usuario = usuarios.find((item) => item.email?.trim().toLowerCase() === acesso.email.toLowerCase());
    if (!usuario) {
      setModal({ isOpen: true, type: "error", title: "Usuário ainda não encontrado", message: "A foto poderá ser editada depois que esse e-mail fizer o primeiro login." });
      return;
    }
    try {
      setUploading(true);
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `monitor-${igrejaId}-${usuario.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente para salvar a foto.");
      const response = await fetch("/api/configuracoes/monitor-foto", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ usuarioId: usuario.id, fotoUrl: data.publicUrl }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar a foto.");
      setUsuarios((current) => current.map((item) => item.id === usuario.id ? { ...item, foto_url: data.publicUrl } : item));
      setModal({ isOpen: true, type: "success", title: "Foto atualizada", message: "A foto do perfil do Monitor foi salva." });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Erro ao salvar foto", message: error instanceof Error ? error.message : "Não foi possível atualizar a foto." });
    } finally {
      setUploading(false);
    }
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

          <div className="mb-5 rounded-xl border border-ohel-blue/20 bg-ohel-blue/5 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Logo OHEL ON do painel</p>
                <p className="mt-1 text-[11px] leading-5 text-gray-400">Imagem exibida nas telas de login e na navegação. A logo padrão será usada enquanto nenhuma personalizada for salva.</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="relative flex h-16 w-28 items-center justify-center overflow-hidden rounded-lg border border-gray-700 bg-ohel-bg">
                  {formData.logo_sistema_url ? <Image src={formData.logo_sistema_url} alt="Logo OHEL ON personalizada" fill sizes="112px" className="object-contain p-2" /> : <Image src="/ipo-cloud-art.png" alt="Logo IPO CLOUD padrão" fill sizes="112px" className="object-contain p-2" />}
                </div>
                <input type="file" accept="image/*" ref={sistemaLogoInputRef} onChange={handleUploadSistemaLogo} className="hidden" />
                <Button type="button" variant="secondary" onClick={() => sistemaLogoInputRef.current?.click()} disabled={uploading} className="w-auto px-4 py-2 text-xs">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Upload className="mr-1.5 h-3.5 w-3.5" /> Alterar logo OHEL ON</>}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-40 h-24 bg-ohel-bg rounded-lg border border-dashed border-gray-700 flex items-center justify-center overflow-hidden relative cursor-grab active:cursor-grabbing" onPointerDown={handleLogoPointerDown} onPointerMove={handleLogoPointerMove} onPointerUp={handleLogoPointerUp} onPointerCancel={handleLogoPointerUp}>
              {formData.logo_url ? (
                <div className="relative w-full h-full" style={{ transform: `translate(${formData.logo_position_x}px, ${formData.logo_position_y}px) scale(${formData.logo_scale / 100})` }}><Image src={formData.logo_url} alt="Logo" fill quality={100} className="object-contain p-2 pointer-events-none" style={{ filter: "brightness(1.2) contrast(1.22) saturate(1.3) drop-shadow(0 0 8px rgba(0, 174, 255, 0.5))" }} /></div>
              ) : (
                <span className="text-xs text-gray-500">Sem Logo</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleUploadLogo} className="hidden" />
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-auto px-5 py-2 text-xs">
                {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> Enviando...</> : <><Upload className="w-3.5 h-3.5 mr-2" /> Alterar Logo</>}
              </Button>
              <label className="block mt-4 text-[11px] text-gray-400">Tamanho da logo: <span className="text-white font-semibold">{formData.logo_scale}%</span><input type="range" min="50" max="150" step="5" value={formData.logo_scale} onChange={(event) => setFormData((current) => ({ ...current, logo_scale: Number(event.target.value) }))} className="mt-2 w-full accent-[#007BFF]" /></label>
              <p className="text-[10px] text-gray-500 mt-2">Arraste a imagem na prévia para ajustar o enquadramento.</p>
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
            <div className="relative">
              <Input label="CEP" name="cep" placeholder="00000-000" value={formData.cep} onChange={handleChange} onBlur={() => void buscarCep()} inputMode="numeric" autoComplete="postal-code" className="py-2 text-xs pr-10" />
              {buscandoCep && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-8 text-ohel-blue" aria-label="Consultando CEP" />}
              <p className="text-[10px] text-gray-500 mt-1">Ao preencher, a rua, bairro, cidade e UF serão buscados automaticamente.</p>
            </div>
            <div className="md:col-span-2">
              <Input label="E-mail de Contato" type="email" name="email" placeholder="contato@igreja.com" value={formData.email} onChange={handleChange} className="py-2 text-xs" />
            </div>
            <div className="md:col-span-2">
              <Input label="Endereço Completo" name="endereco" placeholder="Rua, número, bairro, cidade - UF" value={formData.endereco} onChange={handleChange} className="py-2 text-xs" />
            </div>
          </div>
        </Card>

        {/* 3. RECURSOS ADICIONAIS */}
        <div className="mt-2">
          <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-3 ml-1">
            Recursos Adicionais
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Departamentos da Igreja */}
            <button
              type="button"
              onClick={() => setRecursoAberto("departamentos")}
              className="flex items-center justify-between text-left bg-ohel-surface border border-gray-800 hover:border-purple-400 p-4 rounded-xl transition-colors group shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">Departamentos da Igreja</p>
                  <p className="text-[11px] text-gray-400">{departamentos.length} cadastrados.</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-purple-300 transition-all" />
            </button>

            {/* Cargos Eclesiásticos */}
            <button
              type="button"
              onClick={() => setRecursoAberto("cargos")}
              className="flex items-center justify-between text-left bg-ohel-surface border border-gray-800 hover:border-yellow-500 p-4 rounded-xl transition-colors group shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-yellow-400 transition-colors">Cargos Eclesiásticos</p>
                  <p className="text-[11px] text-gray-400">{cargos.length} cadastrados.</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-yellow-400 transition-all" />
            </button>

            {/* Acessos do Monitor de Mídia */}
            <button
              type="button"
              onClick={() => setRecursoAberto("monitor")}
              className="flex items-center justify-between text-left bg-ohel-surface border border-gray-800 hover:border-green-400 p-4 rounded-xl transition-colors group shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <MonitorPlay className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-green-300 transition-colors">Acessos do Monitor</p>
                  <p className="text-[11px] text-gray-400">{monitorAcessos.length} e-mail(s) autorizado(s).</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-green-300 transition-all" />
            </button>
            
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

        {recursoAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-ohel-surface border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
              <div className="p-5 border-b border-gray-800 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {recursoAberto === "departamentos" ? "Departamentos da Igreja" : recursoAberto === "cargos" ? "Cargos Eclesiásticos" : "Acessos do Monitor de Mídia"}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Cadastre, gerencie e remova itens sem aumentar a tela de configurações.</p>
                </div>
                <button type="button" onClick={() => setRecursoAberto(null)} className="text-gray-400 hover:text-white" aria-label="Fechar">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {recursoAberto === "departamentos" ? (
                <div className="p-5 overflow-y-auto custom-scrollbar">
                  <div className="flex gap-2 mb-4">
                    <Input placeholder="Ex: Louvor, Infantil..." value={novoDepto} onChange={(e) => setNovoDepto(e.target.value)} className="py-2 text-xs flex-1" />
                    <Button type="button" onClick={handleAddDepto} variant="secondary" className="w-auto px-3 py-2"><Plus className="w-4 h-4" /></Button>
                  </div>
                  <div className="flex flex-col gap-2 max-h-[52vh] overflow-y-auto pr-1 custom-scrollbar">
                    {departamentos.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">Nenhum departamento cadastrado.</p>
                    ) : departamentos.map((d) => (
                      <div key={d.id} className="bg-ohel-bg border border-gray-700 px-3 py-2 rounded-lg text-xs text-white">
                        <div className="flex items-center justify-between gap-2"><span className="font-semibold">{d.nome}</span><button type="button" onClick={() => handleDeleteDepto(d.id)} className="text-red-500 hover:text-red-400" aria-label={`Excluir ${d.nome}`}><Trash2 className="w-3 h-3" /></button></div>
                        <select value={d.responsavel_usuario_id || ""} onChange={(e) => void handleResponsavelDepto(d.id, e.target.value)} className="input-ohel w-full mt-2 px-2 py-1.5 rounded text-[11px]">
                          <option value="">Sem responsável definido</option>{usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nome || usuario.email}</option>)}
                        </select>
                        <Link href={`/financeiro/produtos?departamento=${d.id}`} onClick={() => setRecursoAberto(null)} className="text-[10px] text-ohel-blue hover:underline mt-2 inline-block">Gerenciar produtos e fornecedores</Link>
                      </div>
                    ))}
                  </div>
                </div>
              ) : recursoAberto === "cargos" ? (
                <div className="p-5 overflow-y-auto custom-scrollbar">
                  <div className="flex gap-2 mb-4">
                    <Input placeholder="Ex: Diácono, Presbítero..." value={novoCargo} onChange={(e) => setNovoCargo(e.target.value)} className="py-2 text-xs flex-1" />
                    <Button type="button" onClick={handleAddCargo} variant="secondary" className="w-auto px-3 py-2"><Plus className="w-4 h-4" /></Button>
                  </div>
                  <div className="flex flex-col gap-2 max-h-[52vh] overflow-y-auto pr-1 custom-scrollbar">
                    {cargos.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">Nenhum cargo cadastrado.</p>
                    ) : cargos.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 bg-ohel-bg border border-gray-700 px-3 py-2 rounded-lg text-xs text-white">
                        <span>{c.nome}</span>
                        <button type="button" onClick={() => handleDeleteCargo(c.id)} className="text-red-500 hover:text-red-400" aria-label={`Excluir ${c.nome}`}><Trash2 className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-5 overflow-y-auto custom-scrollbar">
                  <p className="text-xs text-gray-400 mb-4">Esses e-mails poderão entrar no Monitor de Mídia, sem acesso às demais áreas administrativas. Se a conta já existir, o grupo Monitor será aplicado no próximo login.</p>
                  <div className="flex gap-2 mb-4">
                    <Input type="email" placeholder="monitor@igreja.com" value={novoMonitorEmail} onChange={(e) => setNovoMonitorEmail(e.target.value)} className="py-2 text-xs flex-1" />
                    <Button type="button" onClick={() => void handleAddMonitor()} variant="secondary" className="w-auto px-3 py-2"><Plus className="w-4 h-4" /></Button>
                  </div>
                  <div className="flex flex-col gap-2 max-h-[52vh] overflow-y-auto pr-1 custom-scrollbar">
                    {monitorAcessos.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">Nenhum e-mail autorizado.</p>
                    ) : monitorAcessos.map((acesso) => {
                      const usuario = usuarios.find((item) => item.email?.trim().toLowerCase() === acesso.email.toLowerCase());
                      return (
                        <div key={acesso.id} className="flex items-center justify-between gap-3 bg-ohel-bg border border-gray-700 px-3 py-2 rounded-lg text-xs text-white">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative w-9 h-9 rounded-full overflow-hidden bg-gray-800 border border-gray-700 shrink-0 flex items-center justify-center">
                              {usuario?.foto_url ? <Image src={usuario.foto_url} alt={usuario.nome || acesso.email} fill sizes="36px" className="object-cover" /> : <User className="w-4 h-4 text-gray-500" />}
                            </div>
                            <div className="min-w-0"><p className="font-medium truncate">{usuario?.nome || "Acesso do Monitor"}</p><span className="text-gray-400 truncate block">{acesso.email}</span></div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <label className="text-ohel-blue hover:text-white cursor-pointer" title={usuario ? "Editar foto do perfil" : "Disponível após o primeiro login"}>
                              <Pencil className="w-3.5 h-3.5" /><input type="file" accept="image/*" className="hidden" disabled={!usuario || uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUploadMonitorFoto(acesso, file); event.target.value = ""; }} />
                            </label>
                            <button type="button" onClick={() => void handleDeleteMonitor(acesso.id)} className="text-red-500 hover:text-red-400" aria-label={`Excluir acesso ${acesso.email}`}><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
