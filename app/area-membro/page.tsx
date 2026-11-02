"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Camera, CalendarCheck, Heart, Loader2, LogOut, MapPin, Save, UserRound } from "lucide-react";

interface MembroPerfil {
  id: string;
  nome: string;
  email: string | null;
  status: string;
  foto_url: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  estado_civil: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  whatsapp_opt_in: boolean;
}

type FormPerfil = Omit<MembroPerfil, "id" | "email" | "status" | "foto_url">;

const vazio: FormPerfil = {
  nome: "", data_nascimento: "", sexo: "", estado_civil: "", telefone: "", cep: "", logradouro: "", numero: "", bairro: "", cidade: "", uf: "", whatsapp_opt_in: false,
};

export default function AreaMembroPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [membro, setMembro] = useState<MembroPerfil | null>(null);
  const [form, setForm] = useState<FormPerfil>(vazio);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { router.replace("/login-membro"); return; }
    const response = await fetch("/api/membros/meu-perfil", { headers: { Authorization: `Bearer ${session.access_token}` } });
    const result = await response.json() as { membro?: MembroPerfil; error?: string };
    if (!response.ok || !result.membro) { await supabase.auth.signOut(); setErro(result.error || "Não encontramos um membro ativo para este e-mail."); setLoading(false); return; }
    setMembro(result.membro);
    setForm({ nome: result.membro.nome || "", data_nascimento: result.membro.data_nascimento || "", sexo: result.membro.sexo || "", estado_civil: result.membro.estado_civil || "", telefone: result.membro.telefone || "", cep: result.membro.cep || "", logradouro: result.membro.logradouro || "", numero: result.membro.numero || "", bairro: result.membro.bairro || "", cidade: result.membro.cidade || "", uf: result.membro.uf || "", whatsapp_opt_in: result.membro.whatsapp_opt_in === true });
    setLoading(false);
  }, [router]);

  useEffect(() => { const timer = window.setTimeout(() => { void carregar(); }, 0); return () => window.clearTimeout(timer); }, [carregar]);

  const alterar = (campo: keyof FormPerfil, valor: string | boolean) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return router.replace("/login-membro");
    setSalvando(true); setMensagem(""); setErro("");
    const response = await fetch("/api/membros/meu-perfil", { method: "PATCH", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json() as { membro?: MembroPerfil; error?: string };
    if (!response.ok || !result.membro) setErro(result.error || "Não foi possível salvar seu perfil.");
    else { setMembro(result.membro); setMensagem("Perfil atualizado com sucesso."); }
    setSalvando(false);
  };

  const trocarFoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return router.replace("/login-membro");
    const body = new FormData(); body.append("foto", file);
    setEnviandoFoto(true); setMensagem(""); setErro("");
    const response = await fetch("/api/membros/meu-perfil", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body });
    const result = await response.json() as { membro?: MembroPerfil; error?: string };
    if (!response.ok || !result.membro) setErro(result.error || "Não foi possível atualizar sua foto.");
    else { setMembro((atual) => atual ? { ...atual, foto_url: result.membro?.foto_url || null } : atual); setMensagem("Foto atualizada com sucesso."); }
    setEnviandoFoto(false); event.target.value = "";
  };

  const sair = async () => { await supabase.auth.signOut(); router.replace("/login-membro"); };

  if (loading) return <main className="min-h-screen bg-ohel-glow flex items-center justify-center text-gray-300"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando sua área...</main>;
  if (erro && !membro) return <main className="min-h-screen bg-ohel-glow flex items-center justify-center p-4"><Card className="max-w-md text-center"><p className="text-sm text-red-200">{erro}</p><Link href="/login-membro" className="inline-block mt-4 text-sm text-ohel-blue hover:underline">Voltar ao acesso do membro</Link></Card></main>;

  return <main className="min-h-screen bg-ohel-glow p-4 md:p-8"><div className="max-w-4xl mx-auto">
    <div className="flex items-center justify-between mb-6"><div><p className="text-xs text-emerald-300 uppercase tracking-wider font-semibold">Área do Membro</p><h1 className="text-2xl font-bold text-white mt-1">Olá, {membro?.nome}</h1><p className="text-sm text-gray-400 mt-1">Seu cadastro na igreja</p></div><button onClick={() => void sair()} className="text-gray-400 hover:text-white text-xs flex items-center gap-1.5"><LogOut className="w-4 h-4" /> Sair</button></div>
    {(mensagem || erro) && <div className={`mb-4 rounded-lg border p-3 text-sm ${erro ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>{erro || mensagem}</div>}
    <Card className="border-gray-800 mb-4"><form onSubmit={salvar} className="space-y-5"><div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 border-b border-gray-800 pb-5"><div className="w-24 h-24 rounded-full overflow-hidden border border-gray-700 bg-ohel-bg flex items-center justify-center">{membro?.foto_url ? <img src={membro.foto_url} alt={membro.nome} className="w-full h-full object-cover" /> : <UserRound className="w-9 h-9 text-gray-600" />}</div><div className="text-center sm:text-left"><h2 className="text-white font-bold">Meu perfil</h2><p className="text-gray-400 text-xs mt-1">Atualize seus dados e sua foto. O e-mail de acesso não pode ser alterado por aqui.</p><input ref={fileInputRef} type="file" accept="image/*" onChange={trocarFoto} className="hidden" /><Button type="button" variant="secondary" className="mt-3 text-xs" onClick={() => fileInputRef.current?.click()} disabled={enviandoFoto}><Camera className="w-4 h-4 mr-2" />{enviandoFoto ? "Enviando..." : "Trocar foto"}</Button></div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><label className="md:col-span-2"><span className="field-label">Nome completo</span><input required value={form.nome} onChange={(e) => alterar("nome", e.target.value)} className="input-ohel w-full px-4 py-3 rounded-lg text-sm" /></label><label><span className="field-label">Data de nascimento</span><input type="date" value={form.data_nascimento || ""} onChange={(e) => alterar("data_nascimento", e.target.value)} className="input-ohel w-full px-4 py-3 rounded-lg text-sm" /></label><label><span className="field-label">Telefone / WhatsApp</span><input value={form.telefone || ""} onChange={(e) => alterar("telefone", e.target.value)} className="input-ohel w-full px-4 py-3 rounded-lg text-sm" /></label><label><span className="field-label">Sexo</span><select value={form.sexo || ""} onChange={(e) => alterar("sexo", e.target.value)} className="input-ohel w-full px-4 py-3 rounded-lg text-sm"><option value="">Selecione...</option><option>Masculino</option><option>Feminino</option></select></label><label><span className="field-label">Estado civil</span><select value={form.estado_civil || ""} onChange={(e) => alterar("estado_civil", e.target.value)} className="input-ohel w-full px-4 py-3 rounded-lg text-sm"><option value="">Selecione...</option><option>Solteiro(a)</option><option>Casado(a)</option><option>Divorciado(a)</option><option>Viúvo(a)</option></select></label></div>
      <div className="border-t border-gray-800 pt-5"><div className="flex items-center gap-2 text-white text-sm font-bold mb-3"><MapPin className="w-4 h-4 text-ohel-blue" /> Endereço</div><div className="grid grid-cols-1 md:grid-cols-4 gap-4"><label><span className="field-label">CEP</span><input value={form.cep || ""} onChange={(e) => alterar("cep", e.target.value)} className="input-ohel w-full px-4 py-3 rounded-lg text-sm" /></label><label className="md:col-span-3"><span className="field-label">Logradouro</span><input value={form.logradouro || ""} onChange={(e) => alterar("logradouro", e.target.value)} className="input-ohel w-full px-4 py-3 rounded-lg text-sm" /></label><label><span className="field-label">Número</span><input value={form.numero || ""} onChange={(e) => alterar("numero", e.target.value)} className="input-ohel w-full px-4 py-3 rounded-lg text-sm" /></label><label className="md:col-span-2"><span className="field-label">Bairro</span><input value={form.bairro || ""} onChange={(e) => alterar("bairro", e.target.value)} className="input-ohel w-full px-4 py-3 rounded-lg text-sm" /></label><label><span className="field-label">Cidade / UF</span><input value={[form.cidade, form.uf].filter(Boolean).join(" / ")} onChange={(e) => { const [cidade, uf] = e.target.value.split("/"); alterar("cidade", cidade?.trim() || ""); alterar("uf", uf?.trim().toUpperCase() || ""); }} className="input-ohel w-full px-4 py-3 rounded-lg text-sm" /></label></div></div>
      <label className="flex items-start gap-3 rounded-lg border border-gray-800 bg-ohel-bg p-3 text-xs text-gray-300"><input type="checkbox" checked={form.whatsapp_opt_in} onChange={(e) => alterar("whatsapp_opt_in", e.target.checked)} className="mt-0.5 accent-emerald-500" /><span>Autorizo receber comunicações da igreja pelo WhatsApp.</span></label><Button type="submit" disabled={salvando || enviandoFoto} className="w-full sm:w-auto"><Save className="w-4 h-4 mr-2" />{salvando ? "Salvando..." : "Salvar perfil"}</Button></form></Card>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Card className="border-gray-800"><div className="w-10 h-10 rounded-full bg-ohel-blue/10 flex items-center justify-center mb-4"><CalendarCheck className="w-5 h-5 text-ohel-blue" /></div><h2 className="text-white font-bold">Check-in</h2><p className="text-gray-400 text-xs mt-2">Faça seu check-in quando houver um evento disponível.</p><Link href="/checkin" className="block mt-4"><Button variant="primary" className="w-full text-xs">Abrir Check-in</Button></Link></Card><Card className="border-gray-800"><div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4"><Heart className="w-5 h-5 text-emerald-300" /></div><h2 className="text-white font-bold">Cestas básicas</h2><p className="text-gray-400 text-xs mt-2">Veja o que está faltando e marque os itens que você pode doar.</p><Link href="/area-membro/cestas" className="block mt-4"><Button variant="secondary" className="w-full text-xs">Ver itens faltantes</Button></Link></Card></div>
  </div><style jsx>{`.field-label{display:block;color:#a1a1aa;font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem}`}</style></main>;
}
