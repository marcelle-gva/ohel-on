"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CreditCard, LockKeyhole, LogOut, Mail, Plus, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/brand/Logo";

interface Cliente {
  id: string;
  nome: string;
  slug: string;
  plano: string;
  limite_igrejas: number;
  status: "ativo" | "suspenso" | "cancelado";
  created_at: string;
}

export default function IpoCloudDashboardPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nome, setNome] = useState("Admin Geral");
  const [loading, setLoading] = useState(true);
  const [bloqueado, setBloqueado] = useState(false);
  const [novoCliente, setNovoCliente] = useState({ nome: "", slug: "", plano: "Igreja individual", limite_igrejas: "1", primeira_igreja: "" });
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [convite, setConvite] = useState({ cliente_id: "", nome: "", email: "" });
  const [enviandoConvite, setEnviandoConvite] = useState(false);

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

  const criarCliente = async (event: React.FormEvent) => {
    event.preventDefault();
    setSalvandoCliente(true);
    setMensagem("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada.");
      const response = await fetch("/api/ipocloud/clientes", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify(novoCliente) });
      const result = await response.json() as { error?: string; cliente?: Cliente };
      if (!response.ok) throw new Error(result.error || "Não foi possível criar o cliente.");
      setClientes((atuais) => result.cliente ? [result.cliente, ...atuais] : atuais);
      setNovoCliente({ nome: "", slug: "", plano: "Igreja individual", limite_igrejas: "1", primeira_igreja: "" });
      setMensagem("Cliente criado com sucesso. Os dados internos continuam isolados.");
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Não foi possível criar o cliente.");
    } finally {
      setSalvandoCliente(false);
    }
  };

  const enviarConvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setEnviandoConvite(true);
    setMensagem("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada.");
      const response = await fetch(`/api/ipocloud/clientes/${convite.cliente_id}/convite`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ nome: convite.nome, email: convite.email }) });
      const result = await response.json() as { error?: string; cliente?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar o convite.");
      setConvite({ cliente_id: "", nome: "", email: "" });
      setMensagem(`Convite enviado para administrar ${result.cliente || "o cliente"}.`);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Não foi possível enviar o convite.");
    } finally {
      setEnviandoConvite(false);
    }
  };

  if (loading) return <main className="min-h-screen bg-ohel-bg flex items-center justify-center text-gray-300">Carregando IPO CLOUD...</main>;
  if (bloqueado) return <main className="min-h-screen bg-ohel-glow flex items-center justify-center p-4"><Card className="max-w-md text-center"><LockKeyhole className="mx-auto mb-4 h-8 w-8 text-red-300" /><h1 className="text-lg font-bold text-white">Acesso restrito</h1><p className="mt-2 text-sm text-gray-400">Este usuário não possui vínculo de Admin Geral da IPO CLOUD.</p><button onClick={() => void sair()} className="mt-5 text-sm text-ohel-blue hover:underline">Sair</button></Card></main>;

  return (
    <main className="min-h-screen bg-ohel-glow p-4 md:p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 border-b border-gray-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4"><Logo className="h-12 w-24" /><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-ohel-blue">IPO CLOUD</p><h1 className="mt-1 text-2xl font-bold">Olá, {nome}</h1><p className="mt-1 text-sm text-gray-400">Admin Geral da plataforma</p></div></div>
          <button onClick={() => void sair()} className="inline-flex items-center gap-2 self-start rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:border-red-400 hover:text-red-300"><LogOut className="h-4 w-4" /> Sair</button>
        </header>

        <section className="mb-6 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><div><h2 className="text-sm font-semibold text-emerald-200">Privacidade dos clientes protegida</h2><p className="mt-1 text-xs leading-relaxed text-gray-300">Este painel mostra somente dados comerciais e operacionais dos clientes. Você não tem acesso automático a membros, financeiro, orações, eventos, fotos ou conteúdo interno de nenhuma organização.</p></div></div></section>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3"><Card className="border-gray-800"><p className="text-xs uppercase tracking-wider text-gray-500">Clientes</p><p className="mt-2 text-3xl font-bold text-white">{clientes.length}</p><p className="mt-1 text-xs text-gray-400">Organizações na plataforma</p></Card><Card className="border-gray-800"><p className="text-xs uppercase tracking-wider text-gray-500">Ativos</p><p className="mt-2 text-3xl font-bold text-emerald-300">{clientes.filter((cliente) => cliente.status === "ativo").length}</p><p className="mt-1 text-xs text-gray-400">Assinaturas em operação</p></Card><Card className="border-gray-800"><p className="text-xs uppercase tracking-wider text-gray-500">Escala contratada</p><p className="mt-2 text-3xl font-bold text-ohel-blue">{clientes.reduce((total, cliente) => total + cliente.limite_igrejas, 0)}</p><p className="mt-1 text-xs text-gray-400">Igrejas licenciadas</p></Card></div>

        <Card className="mb-6 border-ohel-blue/25"><div className="mb-4 flex items-center gap-3"><div className="rounded-lg bg-ohel-blue/10 p-2"><Plus className="h-5 w-5 text-ohel-blue" /></div><div><h2 className="font-bold text-white">Novo cliente IPO CLOUD</h2><p className="mt-1 text-xs text-gray-400">Crie somente a conta comercial e a primeira igreja. O cliente administrará o próprio conteúdo.</p></div></div><form onSubmit={criarCliente} className="grid grid-cols-1 gap-3 md:grid-cols-5"><input value={novoCliente.nome} onChange={(event) => setNovoCliente({ ...novoCliente, nome: event.target.value })} placeholder="Nome do cliente/organização" required className="input-ohel rounded-lg px-3 py-2 text-sm md:col-span-2" /><input value={novoCliente.slug} onChange={(event) => setNovoCliente({ ...novoCliente, slug: event.target.value })} placeholder="slug-exemplo (opcional)" className="input-ohel rounded-lg px-3 py-2 text-sm" /><input value={novoCliente.primeira_igreja} onChange={(event) => setNovoCliente({ ...novoCliente, primeira_igreja: event.target.value })} placeholder="Primeira igreja" required className="input-ohel rounded-lg px-3 py-2 text-sm" /><input type="number" min="1" value={novoCliente.limite_igrejas} onChange={(event) => setNovoCliente({ ...novoCliente, limite_igrejas: event.target.value })} placeholder="Limite" required className="input-ohel rounded-lg px-3 py-2 text-sm" /><select value={novoCliente.plano} onChange={(event) => setNovoCliente({ ...novoCliente, plano: event.target.value })} className="input-ohel rounded-lg px-3 py-2 text-sm md:col-span-2"><option>Igreja individual</option><option>Rede regional</option><option>Rede episcopal</option><option>Convenção</option></select><button type="submit" disabled={salvandoCliente} className="rounded-lg bg-ohel-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 md:col-span-2">{salvandoCliente ? "Criando..." : "Criar cliente"}</button></form>{mensagem && <p className={`mt-3 text-xs ${mensagem.includes("sucesso") ? "text-emerald-300" : "text-red-300"}`}>{mensagem}</p>}</Card>

        <Card className="mb-6 border-emerald-500/20"><div className="mb-4 flex items-center gap-3"><Mail className="h-5 w-5 text-emerald-300" /><div><h2 className="font-bold text-white">Convidar administrador de cliente</h2><p className="mt-1 text-xs text-gray-400">O convidado administrará apenas a organização escolhida e aceitará por e-mail.</p></div></div><form onSubmit={enviarConvite} className="grid grid-cols-1 gap-3 md:grid-cols-4"><select value={convite.cliente_id} onChange={(event) => setConvite({ ...convite, cliente_id: event.target.value })} required className="input-ohel rounded-lg px-3 py-2 text-sm"><option value="">Selecione o cliente</option>{clientes.filter((cliente) => cliente.status === "ativo").map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}</select><input value={convite.nome} onChange={(event) => setConvite({ ...convite, nome: event.target.value })} placeholder="Nome do bispo/administrador" required className="input-ohel rounded-lg px-3 py-2 text-sm" /><input type="email" value={convite.email} onChange={(event) => setConvite({ ...convite, email: event.target.value })} placeholder="email@cliente.com" required className="input-ohel rounded-lg px-3 py-2 text-sm" /><button type="submit" disabled={enviandoConvite || clientes.length === 0} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{enviandoConvite ? "Enviando..." : "Enviar convite"}</button></form>{mensagem && <p className="mt-3 text-xs text-gray-400">{mensagem}</p>}</Card>

        <Card className="overflow-hidden border-gray-800 p-0"><div className="border-b border-gray-800 p-5"><div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-ohel-blue" /><div><h2 className="font-bold text-white">Clientes da IPO CLOUD</h2><p className="mt-1 text-xs text-gray-400">Somente metadados da conta, plano e limite contratado.</p></div></div></div><div className="divide-y divide-gray-800/70">{clientes.map((cliente) => <div key={cliente.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-white">{cliente.nome}</p><p className="mt-1 text-xs text-gray-500">{cliente.slug}</p></div><div className="flex flex-wrap items-center gap-2 text-xs"><span className="inline-flex items-center gap-1 rounded-full border border-gray-700 px-2.5 py-1 text-gray-300"><CreditCard className="h-3.5 w-3.5" /> {cliente.plano}</span><span className="inline-flex items-center gap-1 rounded-full border border-gray-700 px-2.5 py-1 text-gray-300"><Users className="h-3.5 w-3.5" /> até {cliente.limite_igrejas} igreja{cliente.limite_igrejas === 1 ? "" : "s"}</span><span className={`rounded-full px-2.5 py-1 ${cliente.status === "ativo" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>{cliente.status}</span></div></div>)}{clientes.length === 0 && <p className="p-8 text-center text-sm text-gray-400">Nenhum cliente cadastrado. Execute a migration inicial e cadastre o Admin Geral.</p>}</div></Card>
      </div>
    </main>
  );
}
