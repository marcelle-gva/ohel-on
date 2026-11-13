"use client";

import Link from "next/link";
import { ArrowRight, House, ShieldCheck } from "lucide-react";

export function CultoLarDashboardCard() {
  return (
    <section aria-labelledby="culto-lar-dashboard-title" className="rounded-2xl border border-blue-400/20 bg-ohel-surface p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-blue-400/10 p-3 text-blue-300" aria-hidden="true"><House size={22} /></span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">Fé compartilhada em casa</p>
            <h2 id="culto-lar-dashboard-title" className="mt-1 text-lg font-bold text-white">Culto no Lar</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-gray-400">Compartilhe a Palavra ministrada, a data e uma foto do encontro. Conheça também os cultos nos lares da sua igreja.</p>
          </div>
        </div>
        <Link href="/area-membro/culto-no-lar" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-ohel-blue px-4 py-3 text-sm font-semibold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">Abrir mural e enviar <ArrowRight size={16} /></Link>
      </div>
      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-gray-400"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-green-400" />Seu envio e sua foto só serão compartilhados com os outros membros após aprovação da liderança.</p>
    </section>
  );
}
