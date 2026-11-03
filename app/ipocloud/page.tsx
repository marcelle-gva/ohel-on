"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CreditCard, LockKeyhole, LogOut, ShieldCheck, Users } from "lucide-react";
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

        <Card className="overflow-hidden border-gray-800 p-0"><div className="border-b border-gray-800 p-5"><div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-ohel-blue" /><div><h2 className="font-bold text-white">Clientes da IPO CLOUD</h2><p className="mt-1 text-xs text-gray-400">Somente metadados da conta, plano e limite contratado.</p></div></div></div><div className="divide-y divide-gray-800/70">{clientes.map((cliente) => <div key={cliente.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-white">{cliente.nome}</p><p className="mt-1 text-xs text-gray-500">{cliente.slug}</p></div><div className="flex flex-wrap items-center gap-2 text-xs"><span className="inline-flex items-center gap-1 rounded-full border border-gray-700 px-2.5 py-1 text-gray-300"><CreditCard className="h-3.5 w-3.5" /> {cliente.plano}</span><span className="inline-flex items-center gap-1 rounded-full border border-gray-700 px-2.5 py-1 text-gray-300"><Users className="h-3.5 w-3.5" /> até {cliente.limite_igrejas} igreja{cliente.limite_igrejas === 1 ? "" : "s"}</span><span className={`rounded-full px-2.5 py-1 ${cliente.status === "ativo" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>{cliente.status}</span></div></div>)}{clientes.length === 0 && <p className="p-8 text-center text-sm text-gray-400">Nenhum cliente cadastrado. Execute a migration inicial e cadastre o Admin Geral.</p>}</div></Card>
      </div>
    </main>
  );
}
