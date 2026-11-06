"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRound, LogOut, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { ContextoAcesso } from "@/lib/access";

export function MemberHeader({ contexto }: { contexto: ContextoAcesso }) {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);
  const [erro, setErro] = useState("");
  const sair = async () => {
    setSaindo(true);
    setErro("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/login-membro");
    } catch {
      setErro("Não foi possível sair. Tente novamente.");
      setSaindo(false);
    }
  };
  return (
    <header className="relative flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-gray-800 bg-ohel-surface py-2 pl-16 pr-3 md:px-6">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {contexto.igrejaNome}
        </p>
        <p className="text-[10px] text-emerald-300">Área do Membro</p>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        <Link
          href="/area-membro/perfil"
          aria-label="Editar meu perfil e foto"
          title="Editar meu perfil e foto"
          className="flex items-center gap-2 rounded-lg p-1.5 text-gray-300 hover:bg-white/5 hover:text-white"
        >
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-gray-700 bg-ohel-bg">
            {contexto.membro?.foto_url ? (
              <img
                src={contexto.membro.foto_url}
                alt="Minha foto"
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound className="m-2 h-5 w-5 text-gray-400" />
            )}
          </div>
          <span className="hidden max-w-32 sm:block">
            <span className="block truncate text-xs font-semibold">
              {contexto.membro?.nome || "Meu perfil"}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <Pencil className="h-3 w-3" /> Editar perfil
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => void sair()}
          disabled={saindo}
          aria-label="Sair da Área do Membro"
          className="flex min-h-10 items-center gap-1 rounded-lg p-2 text-xs text-gray-300 hover:text-red-300 disabled:opacity-50"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>{saindo ? "Saindo..." : "Sair"}</span>
        </button>
      </div>
      {erro && (
        <p
          role="alert"
          className="absolute right-3 top-full z-50 max-w-[90vw] rounded-lg border border-red-500/30 bg-ohel-surface p-3 text-xs text-red-300"
        >
          {erro}
        </p>
      )}
    </header>
  );
}
