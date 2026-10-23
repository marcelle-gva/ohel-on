"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Building2, Copy, Loader2, Plus, RefreshCw, Users } from "lucide-react";

type Church = {
  igreja_id: string;
  igreja_nome: string;
  criado_em: string;
  total_membros: number;
  total_usuarios: number;
  emails_administradores: string[];
};

type Invite = {
  igreja_id: string;
  igreja_nome: string;
  email_admin: string;
  convite_token: string;
  expira_em: string;
};

export default function PlatformAdminPage() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [churchName, setChurchName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadChurches = async () => {
    setError("");
    const { data, error: loadError } = await supabase.rpc("platform_list_churches");
    if (loadError) throw loadError;
    setChurches((data ?? []) as Church[]);
  };

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void loadChurches()
        .catch(loadError => {
          if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as igrejas.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const createInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    setNotice("");
    setInvite(null);
    try {
      const { data, error: inviteError } = await supabase.rpc("platform_create_church_admin_invite", {
        p_nome_igreja: churchName.trim(),
        p_email_admin: adminEmail.trim().toLowerCase(),
      });
      if (inviteError) throw inviteError;
      const createdInvite = (Array.isArray(data) ? data[0] : data) as Invite | null;
      if (!createdInvite?.convite_token) throw new Error("O banco não retornou o convite criado.");
      setInvite(createdInvite);
      setChurchName("");
      setAdminEmail("");
      setNotice("Igreja criada. O convite expira em sete dias e só pode ser usado pelo e-mail informado.");
      await loadChurches();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Não foi possível criar o convite.");
    } finally {
      setCreating(false);
    }
  };

  const inviteLink = invite && typeof window !== "undefined"
    ? `${window.location.origin}/cadastro/convite/${invite.convite_token}`
    : "";

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 pb-10">
      <header className="flex items-center gap-4">
        <span className="rounded-xl bg-violet-500/10 p-3 text-violet-300"><Building2 className="h-6 w-6" /></span>
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Administração global</p><h1 className="text-2xl font-bold text-white">Plataforma OHEL ON</h1><p className="mt-1 text-sm text-gray-400">Igrejas cadastradas e convites de novos administradores.</p></div>
      </header>

      {error && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-gray-800 bg-gray-900/70 p-5 sm:p-6">
          <h2 className="font-semibold text-white">Adicionar igreja e convidar administrador</h2>
          <p className="mt-1 text-xs leading-5 text-gray-500">O primeiro acesso cria a conta de administrador da nova igreja. O e-mail é validado pelo banco e o link é de uso único.</p>
          <form onSubmit={createInvite} className="mt-5 flex flex-col gap-3">
            <input required maxLength={150} value={churchName} onChange={event => setChurchName(event.target.value)} placeholder="Nome da igreja" className="input-ohel rounded-lg px-3 py-2.5 text-sm" />
            <input required type="email" value={adminEmail} onChange={event => setAdminEmail(event.target.value)} placeholder="E-mail do novo administrador" className="input-ohel rounded-lg px-3 py-2.5 text-sm" />
            <button disabled={creating} className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"><Plus className="h-4 w-4" />{creating ? "Criando convite…" : "Criar igreja e convite"}</button>
          </form>
          {invite && (
            <div className="mt-5 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
              <p className="text-sm font-semibold text-white">Convite pronto · {invite.igreja_nome}</p>
              <p className="mt-1 text-xs text-gray-300">Enviar para {invite.email_admin}. Expira em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(invite.expira_em))}.</p>
              <div className="mt-3 flex gap-2"><input readOnly value={inviteLink} aria-label="Link do convite" className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-gray-300" /><button type="button" onClick={() => void navigator.clipboard.writeText(inviteLink).then(() => setNotice("Link copiado."), () => setError("Não foi possível copiar automaticamente. Copie o link pelo campo."))} className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 text-xs font-semibold text-gray-200 hover:border-gray-500"><Copy className="h-4 w-4" />Copiar</button></div>
              <p className="mt-2 text-[11px] text-gray-500">O administrador precisa se cadastrar com o e-mail exato do convite.</p>
            </div>
          )}
        </Card>

        <Card className="border-gray-800 bg-gray-900/70 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Igrejas da plataforma</h2><p className="mt-1 text-xs text-gray-500">Visão administrativa agregada; dados operacionais continuam isolados por igreja.</p></div><button type="button" onClick={() => void loadChurches().catch(loadError => setError(loadError instanceof Error ? loadError.message : "Falha ao atualizar."))} className="rounded-lg border border-gray-700 p-2 text-gray-300 hover:text-white" title="Atualizar"><RefreshCw className="h-4 w-4" /></button></div>
          {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : (
            <div className="space-y-3">
              {churches.map(church => <div key={church.igreja_id} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-gray-100">{church.igreja_nome}</p><p className="mt-1 text-xs text-gray-500">Criada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(church.criado_em))}</p></div><span className="flex items-center gap-1 rounded-full bg-gray-800 px-2.5 py-1 text-[10px] text-gray-300"><Users className="h-3 w-3" />{church.total_usuarios} usuários</span></div><p className="mt-3 text-xs text-gray-400">{church.total_membros} membros</p><p className="mt-1 break-all text-xs text-violet-200">{church.emails_administradores.length ? church.emails_administradores.join(", ") : "Sem administrador ativo"}</p></div>)}
              {!churches.length && <p className="py-8 text-center text-sm text-gray-500">Nenhuma igreja cadastrada.</p>}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
