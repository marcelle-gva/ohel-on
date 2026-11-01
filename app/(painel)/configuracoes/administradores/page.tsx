"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";

interface Invitation {
  id: string;
  email: string;
  nome: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export default function AdministradoresPage() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [convites, setConvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const authHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : null;
  };

  const load = async () => {
    const headers = await authHeaders();
    if (!headers) {
      setLoading(false);
      return;
    }
    const response = await fetch("/api/admin/invitations", { headers });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setConvites(data.invitations || []);
    else setModal({ isOpen: true, type: "error", title: "Acesso negado", message: data.error || "Não foi possível carregar os convites." });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Faça login novamente.");
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers,
        body: JSON.stringify({ nome, email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar o convite.");
      setNome("");
      setEmail("");
      setModal({ isOpen: true, type: "success", title: "Convite enviado", message: `O convite para ${email} foi enviado pelo Supabase Auth. O destinatário terá 7 dias para aceitar.` });
      await load();
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Erro no convite", message: error instanceof Error ? error.message : "Erro inesperado." });
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (id: string) => {
    const headers = await authHeaders();
    if (!headers) return;
    const response = await fetch("/api/admin/invitations", { method: "DELETE", headers, body: JSON.stringify({ id }) });
    if (response.ok) await load();
    else {
      const data = await response.json().catch(() => ({}));
      setModal({ isOpen: true, type: "error", title: "Erro", message: data.error || "Não foi possível revogar o convite." });
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />
      <div className="flex items-start gap-4">
        <Link href="/configuracoes" className="text-gray-400 hover:text-white mt-1"><ArrowLeft className="w-6 h-6" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-cyan-400" /> Administradores</h1>
          <p className="text-gray-400 text-sm mt-1">Somente admin@ipocloud.com.br pode convidar novos administradores.</p>
        </div>
      </div>

      <Card className="border-cyan-500/20">
        <div className="flex items-center gap-3 mb-5"><UserPlus className="w-5 h-5 text-cyan-400" /><div><h2 className="text-white font-semibold">Convidar administrador</h2><p className="text-gray-400 text-xs">O convite fica vinculado à sua igreja e expira em 7 dias.</p></div></div>
        <form onSubmit={invite} className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <Input label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do administrador" required />
          <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@outra-pessoa.com" required />
          <Button type="submit" disabled={saving} className="h-10">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4 mr-2" /> Enviar convite</>}</Button>
        </form>
        <p className="text-[11px] text-gray-500 mt-4">O envio usa o e-mail transacional configurado em Supabase Authentication. Para aparecer como admin@ipocloud.com.br, configure o SMTP do Supabase com essa conta.</p>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-gray-800"><h2 className="text-white font-semibold">Convites enviados</h2></div>
        {loading ? <div className="p-8 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div> : convites.length === 0 ? <div className="p-8 text-center text-gray-400">Nenhum convite enviado.</div> : <div className="divide-y divide-gray-800">{convites.map((convite) => { const expired = new Date(convite.expires_at).getTime() < Date.now(); return <div key={convite.id} className="p-4 flex items-center justify-between gap-4"><div><p className="text-white text-sm font-medium">{convite.nome}</p><p className="text-gray-400 text-xs flex items-center gap-1"><Mail className="w-3 h-3" />{convite.email}</p></div><div className="flex items-center gap-3"><span className={`text-xs ${convite.accepted_at ? "text-green-400" : expired ? "text-red-400" : "text-yellow-400"}`}>{convite.accepted_at ? "Aceito" : expired ? "Expirado" : "Pendente"}</span>{!convite.accepted_at && <button onClick={() => revoke(convite.id)} className="text-gray-500 hover:text-red-400" title="Revogar convite"><Trash2 className="w-4 h-4" /></button>}</div></div>; })}</div>}
      </Card>
    </div>
  );
}
