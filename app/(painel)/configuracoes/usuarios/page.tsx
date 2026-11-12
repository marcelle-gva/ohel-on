"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Users, Save, Mail, Loader2, RefreshCw, Clock3, KeyRound, UserPlus } from "lucide-react";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: string;
  perfil_id: string | null;
  perfis: { nome: string } | null;
}

interface MembroAtivo {
  id: string;
  nome: string;
  email: string | null;
  auth_user_id: string | null;
  status: string | null;
}

interface Perfil {
  id: string;
  nome: string;
}

type Feedback = { isOpen: boolean; type: "success" | "error"; title: string; message: string };

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [membros, setMembros] = useState<MembroAtivo[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [modal, setModal] = useState<Feedback>({ isOpen: false, type: "success", title: "", message: "" });

  const fetchDados = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch("/api/configuracoes/usuarios", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const data = await response.json() as { usuarios?: Usuario[]; membros?: MembroAtivo[]; perfis?: Perfil[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível sincronizar os usuários.");
      setUsuarios(data.usuarios || []);
      setMembros(data.membros || []);
      setPerfis(data.perfis || []);
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Erro ao sincronizar", message: error instanceof Error ? error.message : "Não foi possível carregar os usuários." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchDados(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const sincronizarAgora = async () => {
    setSyncing(true);
    await fetchDados();
    setSyncing(false);
  };

  const convidarMembro = async (membro: MembroAtivo) => {
    if (!membro.email) {
      setModal({ isOpen: true, type: "error", title: "E-mail necessário", message: "Cadastre um e-mail válido para este membro antes de enviar o convite." });
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setModal({ isOpen: true, type: "error", title: "Sessão expirada", message: "Entre novamente como administrador para enviar o convite." });
      return;
    }

    setInvitingId(membro.id);
    try {
      const response = await fetch("/api/configuracoes/usuarios", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ membroId: membro.id }),
      });
      const data = await response.json() as { message?: string; error?: string; conviteEnviado?: boolean };
      if (!response.ok) throw new Error(data.error || "Não foi possível convidar este membro.");
      await fetchDados();
      setModal({ isOpen: true, type: "success", title: data.conviteEnviado ? "Convite enviado" : "Usuário sincronizado", message: data.message || `Acesso de ${membro.nome} atualizado.` });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível enviar", message: error instanceof Error ? error.message : "Tente novamente em alguns instantes." });
    } finally {
      setInvitingId(null);
    }
  };

  const handleChangePerfil = (usuarioId: string, perfilId: string) => {
    setUsuarios((atual) => atual.map((usuario) => usuario.id === usuarioId ? { ...usuario, perfil_id: perfilId || null } : usuario));
  };

  const handleSavePerfil = async (usuario: Usuario) => {
    setSavingId(usuario.id);
    try {
      const { error } = await supabase.from("usuarios").update({ perfil_id: usuario.perfil_id }).eq("id", usuario.id);
      if (error) throw error;
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: `Perfil de ${usuario.nome} atualizado!` });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error instanceof Error ? error.message : "Não foi possível salvar o perfil." });
    } finally {
      setSavingId(null);
    }
  };

  const handleResetSenha = async (usuario: Usuario) => {
    if (!usuario.email) return;
    setResettingId(usuario.id);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(usuario.email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/redefinir-senha?origem=membro`,
      });
      if (error) throw error;
      setModal({ isOpen: true, type: "success", title: "Link enviado", message: `Enviamos um link para zerar a senha de ${usuario.nome}.` });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível enviar", message: error instanceof Error ? error.message : "Tente novamente em alguns instantes." });
    } finally {
      setResettingId(null);
    }
  };

  const membrosSemUsuario = membros.filter((membro) => !membro.auth_user_id || !usuarios.some((usuario) => usuario.id === membro.auth_user_id));

  if (loading) return <div className="p-10 text-center text-gray-400">Sincronizando membros e usuários...</div>;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="flex items-center gap-4">
          <Link href="/configuracoes" className="mt-1 text-gray-400 transition-colors hover:text-white"><ArrowLeft className="h-6 w-6" /></Link>
          <div><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white"><Users className="h-6 w-6 text-ohel-blue" /> Gestão de Usuários</h1><p className="mt-1 text-sm text-gray-400">Contas existentes são vinculadas automaticamente; membros sem login podem receber convite.</p></div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-ohel-blue/20 bg-ohel-blue/10 p-4 md:flex-row md:items-center md:justify-between">
        <div><p className="text-sm font-semibold text-blue-200">Vínculo e convites de acesso</p><p className="mt-1 text-xs leading-5 text-blue-300/80">Membros com conta existente são vinculados ao sincronizar. Para quem ainda não tem login, envie um convite: a conta será criada com acesso de membro e aparecerá no seletor de responsáveis de departamentos; a pessoa poderá entrar após aceitar o e-mail.</p></div>
        <Button variant="secondary" onClick={() => void sincronizarAgora()} disabled={syncing} className="shrink-0 whitespace-nowrap">{syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sincronizar agora</Button>
      </div>

      <Card className="overflow-hidden border-gray-800/60 p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left whitespace-nowrap">
            <thead><tr className="border-b border-gray-800 bg-ohel-surface/80 text-xs uppercase tracking-wider text-gray-400"><th className="p-4 font-medium">Nome / E-mail</th><th className="p-4 font-medium">Perfil de Acesso</th><th className="w-24 p-4 text-center font-medium">Ação</th></tr></thead>
            <tbody className="divide-y divide-gray-800/50">
              {usuarios.length === 0 && membrosSemUsuario.length === 0 ? <tr><td colSpan={3} className="p-8 text-center text-gray-400">Nenhum membro ou usuário encontrado.</td></tr> : <>
                {usuarios.map((usuario) => <tr key={usuario.id} className="hover:bg-white/[0.02]">
                  <td className="p-4"><p className="text-sm font-bold text-white">{usuario.nome}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400"><Mail className="h-3 w-3" /> {usuario.email}</p></td>
                  <td className="p-4"><select value={usuario.perfil_id || ""} onChange={(event) => handleChangePerfil(usuario.id, event.target.value)} className="input-ohel w-full max-w-xs rounded-lg px-3 py-2 text-sm"><option value="">Sem Perfil (Acesso Restrito)</option>{perfis.map((perfil) => <option key={perfil.id} value={perfil.id}>{perfil.nome}</option>)}</select></td>
                  <td className="p-4 text-center"><div className="flex items-center justify-center gap-2"><Button variant="primary" onClick={() => void handleSavePerfil(usuario)} disabled={savingId === usuario.id} className="w-auto px-4 py-2 text-xs">{savingId === usuario.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-1.5 h-3.5 w-3.5" /> Salvar</>}</Button>{membros.some((membro) => membro.auth_user_id === usuario.id) && <button type="button" onClick={() => void handleResetSenha(usuario)} disabled={resettingId === usuario.id} className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-500/20 hover:text-amber-100 disabled:opacity-50" title="Enviar link para zerar senha" aria-label={`Zerar senha de ${usuario.nome}`}>{resettingId === usuario.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}</button>}</div></td>
                </tr>)}
                {membrosSemUsuario.map((membro) => <tr key={`membro-${membro.id}`} className="bg-amber-500/[0.03] hover:bg-amber-500/[0.06]"><td className="p-4"><p className="text-sm font-bold text-white">{membro.nome}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400"><Mail className="h-3 w-3" /> {membro.email || "E-mail não informado"}</p></td><td className="p-4 text-right" colSpan={2}><div className="flex flex-col items-end gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200"><Clock3 className="h-3.5 w-3.5" /> Sem conta de acesso</span>{membro.email ? <Button variant="secondary" onClick={() => void convidarMembro(membro)} disabled={invitingId === membro.id} className="w-auto px-3 py-2 text-xs">{invitingId === membro.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="mr-1.5 h-3.5 w-3.5" /> Enviar convite</>}</Button> : <span className="text-[10px] text-gray-500">Cadastre um e-mail válido para convidar.</span>}</div></td></tr>)}
              </>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
