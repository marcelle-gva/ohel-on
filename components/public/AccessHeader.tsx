import Link from "next/link";
import { LockKeyhole, UsersRound } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export function AccessHeader({ current }: { current: "admin" | "membro" }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-cyan-300/10 bg-[#020812]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Voltar ao início"><Logo className="h-10 w-24 sm:h-11 sm:w-28" /></Link>
        <nav className="flex items-center gap-2 text-xs sm:gap-3">
          <Link href="/" className="hidden rounded-full px-3 py-2 text-gray-400 transition hover:bg-white/5 hover:text-cyan-200 sm:inline-flex">Início</Link>
          <Link href="/login" aria-current={current === "admin" ? "page" : undefined} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 font-semibold transition ${current === "admin" ? "border-cyan-200/70 bg-cyan-400/10 text-white" : "border-cyan-200/30 text-cyan-100 hover:bg-cyan-400/10"}`}><LockKeyhole className="h-3.5 w-3.5 text-cyan-300" /><span className="hidden sm:inline">Acessar sistema · </span>Admin</Link>
          <Link href="/login-membro" aria-current={current === "membro" ? "page" : undefined} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 font-semibold transition ${current === "membro" ? "border-cyan-200/70 bg-cyan-400/10 text-white" : "border-cyan-200/30 text-cyan-100 hover:bg-cyan-400/10"}`}><UsersRound className="h-3.5 w-3.5 text-cyan-300" /><span className="hidden sm:inline">Acessar sistema · </span>Membros</Link>
        </nav>
      </div>
    </header>
  );
}
