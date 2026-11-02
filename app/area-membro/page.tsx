"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CalendarCheck, Heart, Loader2, LogOut, UserRound } from "lucide-react";

interface MembroArea {
  nome: string;
  email: string | null;
  status: string;
}

export default function AreaMembroPage() {
  const router = useRouter();
  const [membro, setMembro] = useState<MembroArea | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user.email) {
        router.replace("/login-membro");
        return;
      }

      const { data, error } = await supabase
        .from("membros")
        .select("nome, email, status")
        .eq("email", session.user.email.toLowerCase())
        .eq("status", "Ativo")
        .maybeSingle();

      if (error || !data) {
        await supabase.auth.signOut();
        setErro("Não encontramos um membro ativo para este e-mail.");
        setLoading(false);
        return;
      }

      setMembro(data);
      setLoading(false);
    };
    void load();
  }, [router]);

  const sair = async () => {
    await supabase.auth.signOut();
    router.replace("/login-membro");
  };

  if (loading) return <main className="min-h-screen bg-ohel-glow flex items-center justify-center text-gray-300"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando sua área...</main>;

  if (erro) return <main className="min-h-screen bg-ohel-glow flex items-center justify-center p-4"><Card className="max-w-md text-center"><p className="text-sm text-red-200">{erro}</p><Link href="/login-membro" className="inline-block mt-4 text-sm text-ohel-blue hover:underline">Voltar ao acesso do membro</Link></Card></main>;

  return (
    <main className="min-h-screen bg-ohel-glow p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div><p className="text-xs text-emerald-300 uppercase tracking-wider font-semibold">Área do Membro</p><h1 className="text-2xl font-bold text-white mt-1">Olá, {membro?.nome}</h1><p className="text-sm text-gray-400 mt-1">Seu cadastro na igreja</p></div>
          <button onClick={() => void sair()} className="text-gray-400 hover:text-white text-xs flex items-center gap-1.5"><LogOut className="w-4 h-4" /> Sair</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-gray-800"><div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4"><UserRound className="w-5 h-5 text-emerald-300" /></div><h2 className="text-white font-bold">Meu cadastro</h2><p className="text-gray-400 text-xs mt-2">Seu cadastro está ativo na igreja. Para alterar seus dados, procure a secretaria.</p><p className="text-gray-500 text-xs mt-3">{membro?.email}</p></Card>
          <Card className="border-gray-800"><div className="w-10 h-10 rounded-full bg-ohel-blue/10 flex items-center justify-center mb-4"><CalendarCheck className="w-5 h-5 text-ohel-blue" /></div><h2 className="text-white font-bold">Check-in</h2><p className="text-gray-400 text-xs mt-2">Faça seu check-in quando houver um evento disponível.</p><Link href="/checkin" className="block mt-4"><Button variant="primary" className="w-full text-xs">Abrir Check-in</Button></Link></Card>
          <Card className="border-gray-800"><div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4"><Heart className="w-5 h-5 text-emerald-300" /></div><h2 className="text-white font-bold">Cestas básicas</h2><p className="text-gray-400 text-xs mt-2">Veja o que está faltando e marque os itens que você pode doar.</p><Link href="/area-membro/cestas" className="block mt-4"><Button variant="secondary" className="w-full text-xs">Ver itens faltantes</Button></Link></Card>
        </div>
      </div>
    </main>
  );
}
