"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Bell, Search, LogOut } from "lucide-react";

export function Header() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="h-16 bg-ohel-surface border-b border-gray-800 flex items-center justify-between px-4 md:px-6 pl-16 md:pl-6">
      
      {/* Esquerda: Nome da Igreja */}
      <div className="flex items-center gap-4">
        <span className="text-white font-medium text-sm md:text-base">Igreja Matriz</span>
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

        <button className="p-2 text-gray-400 hover:text-white transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

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
