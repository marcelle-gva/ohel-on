"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Bell, Search, LogOut, Cloud } from "lucide-react";
import Image from "next/image";

interface IgrejaResumo {
  nome: string;
  logo_url: string | null;
}

export function Header() {
  const router = useRouter();
  const [preCadastrosPendentes, setPreCadastrosPendentes] = useState(0);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [igreja, setIgreja] = useState<IgrejaResumo | null>(null);

  useEffect(() => {
    let active = true;
    const loadPending = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: platformAdmin } = await supabase.from("ipocloud_platform_admins").select("auth_user_id").eq("auth_user_id", session.user.id).eq("ativo", true).maybeSingle();
      if (active) setIsPlatformAdmin(Boolean(platformAdmin));
      const { data: usuario } = await supabase.from("usuarios").select("igreja_id").eq("id", session.user.id).maybeSingle();
      if (!usuario?.igreja_id) return;
      const { data: igrejaAtual } = await supabase.from("igrejas").select("nome, logo_url").eq("id", usuario.igreja_id).maybeSingle();
      if (active && igrejaAtual) setIgreja(igrejaAtual as IgrejaResumo);
      const { count } = await supabase.from("membros").select("id", { count: "exact", head: true }).eq("igreja_id", usuario.igreja_id).eq("status", "Pré-Cadastro");
      if (active) setPreCadastrosPendentes(count || 0);
    };
    void loadPending();
    const interval = window.setInterval(() => void loadPending(), 30000);
    const channel = supabase.channel("header-pre-cadastros").on("postgres_changes", { event: "*", schema: "public", table: "membros" }, () => void loadPending()).subscribe();
    return () => { active = false; window.clearInterval(interval); void supabase.removeChannel(channel); };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="h-16 bg-ohel-surface border-b border-gray-800 flex items-center justify-between px-4 md:px-6 pl-16 md:pl-6">
      
      {/* Esquerda: Identidade da Igreja */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-gray-700 bg-ohel-bg flex items-center justify-center">
          {igreja?.logo_url ? <Image src={igreja.logo_url} alt={`Logo ${igreja.nome}`} fill sizes="40px" className="object-contain p-1" /> : <span className="text-xs font-bold text-ohel-blue">ON</span>}
        </div>
        <div className="min-w-0">
          <span className="block truncate text-white font-medium text-sm md:text-base">{igreja?.nome || "Igreja Matriz"}</span>
          <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Igreja</span>
        </div>
        <span className="hidden md:inline-block text-xs bg-ohel-blue/20 text-ohel-blue px-2 py-1 rounded-full border border-ohel-blue/30">
          Plano Mensal
        </span>
      </div>

      {/* Direita: Busca, Notificações e Perfil */}
      <div className="flex items-center gap-2 md:gap-4">
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
          <input 
            type="text" 
            placeholder="Busca global..." 
            className="bg-ohel-bg border border-gray-700 text-sm text-white rounded-md pl-9 pr-4 py-2 focus:border-ohel-blue outline-none transition-colors w-48 lg:w-64"
          />
        </div>

        <button onClick={() => router.push("/secretaria/membros/aprovacao")} aria-label="Ver pré-cadastros pendentes" className="p-2 text-gray-400 hover:text-white transition-colors relative">
          <Bell className="w-5 h-5" />
          {preCadastrosPendentes > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{preCadastrosPendentes > 99 ? "99+" : preCadastrosPendentes}</span>}
        </button>

        {isPlatformAdmin && <button onClick={() => router.push("/ipocloud")} className="hidden items-center gap-1.5 rounded-md border border-ohel-blue/30 bg-ohel-blue/10 px-2.5 py-1.5 text-xs font-medium text-ohel-blue hover:bg-ohel-blue hover:text-white md:flex" title="Dashboard IPO CLOUD"><Cloud className="h-3.5 w-3.5" /> IPO CLOUD</button>}

        <div className="h-8 w-px bg-gray-700 mx-1 md:mx-2"></div>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors p-2"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline">Sair</span>
        </button>
      </div>
    </header>
  );
}
