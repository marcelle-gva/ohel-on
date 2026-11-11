"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CreditCard, Loader2, LockKeyhole, LogOut, Mail, Plus, ShieldCheck, Upload, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/brand/Logo";
import styles from "./dashboard.module.css";

interface Cliente {
  id: string;
  nome: string;
  slug: string;
  plano: string;
  limite_igrejas: number;
  status: "ativo" | "suspenso" | "cancelado";
  created_at: string;
}

const clienteInicial = {
  nome: "", slug: "", plano: "Igreja individual", limite_igrejas: "1", primeira_igreja: "",
};
const conviteInicial = { cliente_id: "", nome: "", email: "" };

export default function IpoCloudDashboardPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nome, setNome] = useState("Admin Geral");
  const [loading, setLoading] = useState(true);
  const [bloqueado, setBloqueado] = useState(false);
  const [novoCliente, setNovoCliente] = useState(clienteInicial);
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: "success" | "error"; mensagem: string } | null>(null);
  const [convite, setConvite] = useState(conviteInicial);
  const [enviandoConvite, setEnviandoConvite] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [salvandoLogo, setSalvandoLogo] = useState(false);

  useEffect(() => {
    const carregar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      const { data: admin } = await supabase
        .from("ipocloud_platform_admins")
        .select("auth_user_id")
        .eq("auth_user_id", session.user.id)
        .eq("ativo", true)
        .maybeSingle();
      if (!admin) {
        setBloqueado(true);
        setLoading(false);
        return;
      }
      const { data: usuario } = await supabase.from("usuarios").select("nome").eq("id", session.user.id).maybeSingle();
      if (usuario?.nome) setNome(usuario.nome.split(" ")[0]);
      const { data, error } = await supabase
        .from("ipocloud_clientes")
        .select("id, nome, slug, plano, limite_igrejas, status, created_at")
        .order("created_at", { ascending: false });
      if (error) setBloqueado(true);
      else setClientes((data || []) as Cliente[]);
      setLoading(false);
    };
    void carregar();
  }, [router]);

  const sair = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const alterarLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSalvandoLogo(true);
    setFeedback(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada.");
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/ipocloud/logo", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar a logo.");
      window.dispatchEvent(new Event("ohel:logo-atualizada"));
      setFeedback({ tipo: "success", mensagem: "Logo IPO CLOUD atualizada com sucesso." });
    } catch (error) {
      setFeedback({ tipo: "error", mensagem: error instanceof Error ? error.message : "Não foi possível atualizar a logo." });
    } finally {
      setSalvandoLogo(false);
      event.target.value = "";
    }
  };

  const criarCliente = async (event: React.FormEvent) => {
    event.preventDefault();
    setSalvandoCliente(true);
    setFeedback(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada.");
      const response = await fetch("/api/ipocloud/clientes", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(novoCliente),
      });
      const result = await response.json() as { error?: string; cliente?: Cliente };
      if (!response.ok) throw new Error(result.error || "Não foi possível criar o cliente.");
      setClientes((atuais) => result.cliente ? [result.cliente, ...atuais] : atuais);
      setNovoCliente(clienteInicial);
      setFeedback({ tipo: "success", mensagem: "Cliente criado com sucesso. Os dados internos continuam isolados." });
    } catch (error) {
      setFeedback({ tipo: "error", mensagem: error instanceof Error ? error.message : "Não foi possível criar o cliente." });
    } finally {
      setSalvandoCliente(false);
    }
  };

  const enviarConvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setEnviandoConvite(true);
    setFeedback(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada.");
      const response = await fetch(`/api/ipocloud/clientes/${convite.cliente_id}/convite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ nome: convite.nome, email: convite.email }),
      });
      const result = await response.json() as { error?: string; cliente?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar o convite.");
      setConvite(conviteInicial);
      setFeedback({ tipo: "success", mensagem: `Convite enviado para administrar ${result.cliente || "o cliente"}.` });
    } catch (error) {
      setFeedback({ tipo: "error", mensagem: error instanceof Error ? error.message : "Não foi possível enviar o convite." });
    } finally {
      setEnviandoConvite(false);
    }
  };

  if (loading) {
    return <main className={`${styles.viewport} bg-ohel-bg flex items-center justify-center text-gray-300`}>Carregando IPO CLOUD...</main>;
  }
  if (bloqueado) {
    return (
      <main className={`${styles.viewport} bg-ohel-glow p-4`}>
        <Card className={`${styles.card} mx-auto my-8 w-full max-w-md text-center`}>
          <LockKeyhole className="mx-auto mb-4 h-8 w-8 text-red-300" />
          <h1 className="text-lg font-bold text-white">Acesso restrito</h1>
          <p className="mt-2 text-sm text-gray-400">Este usuário não possui vínculo de Admin Geral da IPO CLOUD.</p>
          <button onClick={() => void sair()} className="mt-5 text-sm text-ohel-blue hover:underline">Sair</button>
        </Card>
      </main>
    );
  }

  return (
    <main className={`${styles.viewport} bg-ohel-glow p-3 text-white sm:p-4`}>
      <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-3 pb-4">
        <header className="flex min-w-0 items-center justify-between gap-3 border-b border-gray-800 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative shrink-0">
              <input ref={logoInputRef} type="file" accept="image/*" onChange={alterarLogo} className="hidden" />
              <button type="button" onClick={() => logoInputRef.current?.click()} disabled={salvandoLogo} className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ohel-blue" title="Alterar logo IPO CLOUD">
                <Logo className="h-10 w-16 sm:w-20" />
                <span className="pointer-events-none absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-ohel-blue/30 bg-ohel-bg/90 px-1.5 py-0.5 text-[8px] text-ohel-blue opacity-0 transition group-hover:opacity-100">{salvandoLogo ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Upload className="h-2.5 w-2.5" />} editar</span>
              </button>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ohel-blue">IPO CLOUD</p>
              <h1 className="mt-0.5 break-words text-lg font-bold sm:text-xl">Olá, {nome}</h1>
              <p className="text-xs text-gray-400">Admin Geral da plataforma</p>
            </div>
          </div>
          <button onClick={() => void sair()} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:border-red-400 hover:text-red-300">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </header>

        <section className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
          <div className="flex gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <div className="min-w-0">
              <h2 className="text-xs font-semibold text-emerald-200">Privacidade dos clientes protegida</h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-300">Apenas dados comerciais das contas. Sem acesso automático a membros, financeiro, orações, eventos, fotos ou conteúdo interno dos clientes.</p>
            </div>
          </div>
        </section>

        <section aria-label="Resumo dos clientes" className="grid grid-cols-3 gap-2 sm:gap-3">
          <Card className={styles.card}>
            <h2 className="text-[11px] text-gray-400">Clientes</h2>
            <p className="mt-1 text-2xl font-bold text-white">{clientes.length}</p>
            <p className="hidden text-[11px] text-gray-400 sm:block">Organizações na plataforma</p>
          </Card>
          <Card className={styles.card}>
            <h2 className="text-[11px] text-gray-400">Ativos</h2>
            <p className="mt-1 text-2xl font-bold text-emerald-300">{clientes.filter((cliente) => cliente.status === "ativo").length}</p>
            <p className="hidden text-[11px] text-gray-400 sm:block">Contas com status ativo</p>
          </Card>
          <Card className={styles.card}>
            <h2 className="text-[11px] text-gray-400">Escala contratada</h2>
            <p className="mt-1 text-2xl font-bold text-ohel-blue">{clientes.reduce((total, cliente) => total + cliente.limite_igrejas, 0)}</p>
            <p className="hidden text-[11px] text-gray-400 sm:block">Igrejas licenciadas</p>
          </Card>
        </section>

        <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
          <Card className={styles.card}>
            <div className="mb-3 flex items-start gap-2.5">
              <Plus className="mt-0.5 h-4 w-4 shrink-0 text-ohel-blue" />
              <div>
                <h2 className="text-sm font-bold text-white">Novo cliente IPO CLOUD</h2>
                <p className="mt-0.5 text-xs text-gray-400">Conta comercial e primeira igreja do cliente.</p>
              </div>
            </div>
            <form onSubmit={criarCliente} className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className={styles.field}>
                Nome do cliente/organização
                <input value={novoCliente.nome} onChange={(event) => setNovoCliente({ ...novoCliente, nome: event.target.value })} placeholder="Nome da organização" required className="input-ohel" />
              </label>
              <label className={styles.field}>
                Slug (opcional)
                <input value={novoCliente.slug} onChange={(event) => setNovoCliente({ ...novoCliente, slug: event.target.value })} placeholder="exemplo-cliente" className="input-ohel" />
              </label>
              <label className={styles.field}>
                Primeira igreja
                <input value={novoCliente.primeira_igreja} onChange={(event) => setNovoCliente({ ...novoCliente, primeira_igreja: event.target.value })} placeholder="Nome da igreja" required className="input-ohel" />
              </label>
              <label className={styles.field}>
                Limite de igrejas
                <input type="number" min="1" max="10000" value={novoCliente.limite_igrejas} onChange={(event) => setNovoCliente({ ...novoCliente, limite_igrejas: event.target.value })} required className="input-ohel" />
              </label>
              <label className={styles.field}>
                Plano
                <select aria-label="Plano" value={novoCliente.plano} onChange={(event) => setNovoCliente({ ...novoCliente, plano: event.target.value })} className="input-ohel">
                  <option>Igreja individual</option>
                  <option>Rede regional</option>
                  <option>Rede episcopal</option>
                  <option>Convenção</option>
                </select>
              </label>
              <button type="submit" disabled={salvandoCliente} className="h-10 self-end rounded-lg bg-ohel-blue px-3 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60">
                {salvandoCliente ? "Criando..." : "Criar cliente"}
              </button>
            </form>
          </Card>

          <Card className={styles.card}>
            <div className="mb-3 flex items-start gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <div>
                <h2 className="text-sm font-bold text-white">Convidar administrador de cliente</h2>
                <p className="mt-0.5 text-xs text-gray-400">Acesso apenas à organização escolhida.</p>
              </div>
            </div>
            <form onSubmit={enviarConvite} className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className={`${styles.field} sm:col-span-2`}>
                Cliente
                <select aria-label="Cliente" value={convite.cliente_id} onChange={(event) => setConvite({ ...convite, cliente_id: event.target.value })} required className="input-ohel">
                  <option value="">Selecione o cliente</option>
                  {clientes.filter((cliente) => cliente.status === "ativo").map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                Nome do administrador
                <input value={convite.nome} onChange={(event) => setConvite({ ...convite, nome: event.target.value })} placeholder="Nome do responsável" required className="input-ohel" />
              </label>
              <label className={styles.field}>
                E-mail
                <input type="email" value={convite.email} onChange={(event) => setConvite({ ...convite, email: event.target.value })} placeholder="email@cliente.com" required className="input-ohel" />
              </label>
              <button type="submit" disabled={enviandoConvite || clientes.length === 0} className="h-10 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:col-span-2">
                {enviandoConvite ? "Enviando..." : "Enviar convite"}
              </button>
            </form>
          </Card>
        </div>

        {feedback && (
          <p role={feedback.tipo === "error" ? "alert" : "status"} className={`rounded-lg border p-3 text-sm break-words ${feedback.tipo === "success" ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300" : "border-red-500/20 bg-red-500/5 text-red-300"}`}>
            {feedback.mensagem}
          </p>
        )}

        <Card className={`${styles.card} ${styles.flush}`}>
          <div className="flex items-start gap-2 border-b border-gray-800 px-4 py-3">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-ohel-blue" />
            <div>
              <h2 className="text-sm font-bold text-white">Clientes da IPO CLOUD</h2>
              <p className="mt-0.5 text-xs text-gray-400">Conta, plano e limite contratado.</p>
            </div>
          </div>
          <div className="divide-y divide-gray-800/70">
            {clientes.map((cliente) => (
              <div key={cliente.id} className="flex min-w-0 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-white">{cliente.nome}</p>
                  <p className="mt-0.5 break-all text-xs text-gray-500">{cliente.slug}</p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs sm:justify-end">
                  <span className="inline-flex max-w-full items-start gap-1 rounded-lg border border-gray-700 px-2 py-1 text-gray-300">
                    <CreditCard className="mt-0.5 h-3 w-3 shrink-0" /><span className="min-w-0 break-words">{cliente.plano}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-2 py-1 text-gray-300">
                    <Users className="h-3 w-3 shrink-0" /> até {cliente.limite_igrejas} igreja{cliente.limite_igrejas === 1 ? "" : "s"}
                  </span>
                  <span className={`rounded-lg px-2 py-1 ${cliente.status === "ativo" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>{cliente.status}</span>
                </div>
              </div>
            ))}
            {clientes.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhum cliente cadastrado.</p>}
          </div>
        </Card>
      </div>
    </main>
  );
}
