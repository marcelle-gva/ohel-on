"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Gift, Plus, Search, CalendarDays, Ticket, ArrowUpRight, ListChecks } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { obterOrigemPublica } from "@/lib/public-site";

type SorteioLista = {
  id: string;
  nome: string;
  descricao: string | null;
  status: string;
  data_sorteio: string | null;
  total_numeros: number;
  valor_bilhete: number;
  sorteio_participantes?: Array<{ count: number }>;
  inscritos_total: number;
};

export default function SorteiosPage() {
  const [sorteios, setSorteios] = useState<SorteioLista[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  const fetchSorteios = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("sorteios")
        .select("*, sorteio_participantes(count)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSorteios(((data || []) as SorteioLista[]).map((item) => ({
        ...item,
        inscritos_total: item.sorteio_participantes?.[0]?.count || 0,
      })));
    } catch (error) {
      console.error("Erro ao buscar sorteios:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchSorteios(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchSorteios]);

  const sorteiosFiltrados = sorteios.filter((item) => {
    const text = `${item.nome} ${item.descricao || ""}`.toLowerCase();
    return text.includes(busca.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Sorteios</h1>
          <p className="text-sm text-gray-400">Gestão de rifas, reservadas por número e acompanhamento de pagamento.</p>
        </div>

        <Link href="/sorteios/novo" className="inline-flex items-center gap-2 rounded-md bg-ohel-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600 transition-colors">
          <Plus className="w-4 h-4" /> Novo Sorteio
        </Link>
      </div>

      <Card className="p-4 bg-ohel-surface/60">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar sorteio..."
            className="w-full rounded-md border border-gray-700 bg-ohel-bg pl-9 pr-4 py-2.5 text-sm text-white focus:border-ohel-blue outline-none"
          />
        </div>
      </Card>

      {loading ? (
        <div className="p-8 text-center text-gray-400">Carregando sorteios...</div>
      ) : sorteiosFiltrados.length === 0 ? (
        <Card className="p-8 text-center text-gray-400">Nenhum sorteio encontrado.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sorteiosFiltrados.map((item) => {
            const linkPublico = `${obterOrigemPublica()}/sorteio/${item.id}`;
            return (
              <Card key={item.id} className="p-0 overflow-hidden border-gray-800 bg-ohel-surface">
                <div className="h-28 bg-gradient-to-br from-violet-500/20 via-ohel-surface to-ohel-bg flex items-center justify-center">
                  <Gift className="w-12 h-12 text-violet-400" />
                </div>

                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-white">{item.nome}</h2>
                    <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-bold uppercase text-violet-300 border border-violet-500/20">{item.status}</span>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{item.data_sorteio || "Sem data"}</span>
                    <span className="inline-flex items-center gap-1"><Ticket className="w-3.5 h-3.5" />{item.total_numeros || 0} números</span>
                  </div>

                  <div className="rounded-lg border border-gray-800 bg-ohel-bg/60 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Reservados</span>
                      <span className="font-semibold text-white">{item.inscritos_total}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-gray-400">Valor do bilhete</span>
                      <span className="font-semibold text-white">R$ {Number(item.valor_bilhete || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-auto">
                    <Link href={`/sorteios/${item.id}`} className="flex-1 min-w-[10rem] rounded-md bg-ohel-blue px-3 py-2 text-center text-sm text-white hover:bg-blue-600 flex items-center justify-center gap-2">
                      <ListChecks className="w-3.5 h-3.5" /> Números e vendedores
                    </Link>
                    <Link href={`/sorteios/novo?editar=${item.id}`} className="rounded-md border border-gray-700 px-3 py-2 text-center text-sm text-gray-200 hover:border-ohel-blue">Editar</Link>
                    <a href={linkPublico} target="_blank" rel="noreferrer" className="flex-1 rounded-md bg-ohel-blue px-3 py-2 text-center text-sm text-white hover:bg-blue-600 flex items-center justify-center gap-2">
                      Abrir <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
