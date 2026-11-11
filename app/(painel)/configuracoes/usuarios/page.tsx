"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Users, Save, Mail, Loader2, RefreshCw, Clock3 } from "lucide-react";

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

  const membrosSemUsuario = membros.filter((membro) => !membro.auth_user_id || !usuarios.some((usuario) => usuario.id === membro.auth_user_id));

  if (loading) return <div className="p-10 text-center text-gray-400">Sincronizando membros e usuários...</div>;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="flex items-center gap-4">
          <Link href="/configuracoes" className="mt-1 text-gray-400 transition-colors hover:text-white"><ArrowLeft className="h-6 w-6" /></Link>
          <div><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white"><Users className="h-6 w-6 text-ohel-blue" /> Gestão de Usuários</h1><p className="mt-1 text-sm text-gray-400">Membros ativos e usuários são sincronizados automaticamente pelo e-mail.</p></div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-ohel-blue/20 bg-ohel-blue/10 p-4 md:flex-row md:items-center md:justify-between">
        <div><p className="text-sm font-semibold text-blue-200">Acesso automático para membros ativos</p><p className="mt-1 text-xs leading-5 text-blue-300/80">Membros que já possuem login são vinculados automaticamente. Quando um membro ativo entrar pela primeira vez, o usuário será criado e aparecerá aqui sem precisar abrir o painel do Supabase.</p></div>
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
                  <td className="p-4 text-center"><Button variant="primary" onClick={() => void handleSavePerfil(usuario)} disabled={savingId === usuario.id} className="w-auto px-4 py-2 text-xs">{savingId === usuario.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-1.5 h-3.5 w-3.5" /> Salvar</>}</Button></td>
                </tr>)}
                {membrosSemUsuario.map((membro) => <tr key={`membro-${membro.id}`} className="bg-amber-500/[0.03] hover:bg-amber-500/[0.06]"><td className="p-4"><p className="text-sm font-bold text-white">{membro.nome}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400"><Mail className="h-3 w-3" /> {membro.email || "E-mail não informado"}</p></td><td colSpan={2} className="p-4"><span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200"><Clock3 className="h-3.5 w-3.5" /> Acesso será criado automaticamente no primeiro login</span></td></tr>)}
              </>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
