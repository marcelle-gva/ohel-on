"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Church, Loader2 } from "lucide-react";

interface IgrejaPublica {
  id: string;
  nome: string;
  logo_url: string | null;
}

export function ChurchCarousel() {
  const [igrejas, setIgrejas] = useState<IgrejaPublica[]>([]);
  const [indice, setIndice] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      try {
        const response = await fetch("/api/public/igrejas", { cache: "no-store" });
        const result = await response.json() as { igrejas?: IgrejaPublica[] };
        if (ativo) setIgrejas(result.igrejas || []);
      } finally {
        if (ativo) setCarregando(false);
      }
    };
    void carregar();
    const interval = window.setInterval(() => void carregar(), 60000);
    return () => { ativo = false; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (igrejas.length < 2) return;
    const interval = window.setInterval(() => setIndice((atual) => (atual + 1) % igrejas.length), 5000);
    return () => window.clearInterval(interval);
  }, [igrejas.length]);

  const navegar = (direcao: number) => {
    if (!igrejas.length) return;
    setIndice((atual) => (atual + direcao + igrejas.length) % igrejas.length);
  };

  if (carregando) {
    return <div className="flex min-h-40 items-center justify-center rounded-2xl border border-cyan-300/15 bg-[#061323]/70 text-cyan-200"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (!igrejas.length) {
    return <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-cyan-300/15 bg-[#061323]/70 text-center"><Church className="h-8 w-8 text-cyan-300/70" /><p className="mt-2 text-xs text-gray-400">As igrejas da plataforma aparecerão aqui.</p></div>;
  }

  const igreja = igrejas[indice];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-[#0a2236] to-[#05101c] p-4 shadow-[0_0_35px_rgba(0,117,255,0.18)] sm:p-5">
      <div aria-hidden="true" className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative flex min-h-40 flex-col items-center justify-center text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Igrejas conectadas</p>
        <div className="mt-3 flex h-20 w-36 items-center justify-center rounded-xl border border-white/10 bg-[#020812]/60 p-2 sm:h-24 sm:w-44">
          {igreja.logo_url ? <Image src={igreja.logo_url} alt={`Logo ${igreja.nome}`} width={180} height={96} className="h-full w-full object-contain" /> : <Church className="h-9 w-9 text-cyan-300/70" />}
        </div>
        <h3 className="mt-3 text-sm font-bold text-white">{igreja.nome}</h3>
        {igrejas.length > 1 && <p className="mt-1 text-[10px] text-gray-500">{indice + 1} de {igrejas.length} igrejas na plataforma</p>}
      </div>
      {igrejas.length > 1 && <><button type="button" onClick={() => navegar(-1)} aria-label="Igreja anterior" className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-300/20 bg-[#061323]/80 text-cyan-200 transition hover:bg-cyan-300/15"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => navegar(1)} aria-label="Próxima igreja" className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-300/20 bg-[#061323]/80 text-cyan-200 transition hover:bg-cyan-300/15"><ChevronRight className="h-4 w-4" /></button><div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">{igrejas.map((item, itemIndex) => <button type="button" key={item.id} onClick={() => setIndice(itemIndex)} aria-label={`Mostrar ${item.nome}`} className={`h-1.5 rounded-full transition-all ${itemIndex === indice ? "w-6 bg-cyan-300" : "w-1.5 bg-white/30"}`} />)}</div></>}
    </div>
  );
}
