"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { ArrowRightLeft, Search } from "lucide-react";

type Asset = { id: string; descricao: string; codigo: string | null };
type Movement = {
  id: string;
  bem_id: string;
  tipo_movimentacao: string;
  responsavel: string | null;
  local_destino: string | null;
  data_movimentacao: string;
  observacao: string | null;
};

export default function MovimentacoesPatrimonioPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) throw new Error("Sua sessão expirou. Entre novamente.");
        const { data: profile, error: profileError } = await supabase.from("usuarios")
          .select("igreja_id").eq("id", authData.user.id).single();
        if (profileError) throw profileError;
        if (!profile.igreja_id) throw new Error("Igreja do usuário não identificada.");
        const [{ data: assetRows, error: assetsError }, { data: movementRows, error: movementsError }] = await Promise.all([
          supabase.from("patrimonio_bens").select("id, descricao, codigo").eq("igreja_id", profile.igreja_id),
          supabase.from("patrimonio_movimentacoes").select("id, bem_id, tipo_movimentacao, responsavel, local_destino, data_movimentacao, observacao").eq("igreja_id", profile.igreja_id).order("data_movimentacao", { ascending: false }),
        ]);
        if (assetsError) throw assetsError;
        if (movementsError) throw movementsError;
        if (cancelled) return;
        setAssets((assetRows ?? []) as Asset[]);
        setMovements((movementRows ?? []) as Movement[]);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o histórico.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const assetMap = useMemo(() => new Map(assets.map(asset => [asset.id, asset])), [assets]);
  const filtered = movements.filter(movement => {
    const asset = assetMap.get(movement.bem_id);
    return `${movement.tipo_movimentacao} ${movement.responsavel ?? ""} ${movement.local_destino ?? ""} ${asset?.descricao ?? ""} ${asset?.codigo ?? ""}`
      .toLocaleLowerCase().includes(search.toLocaleLowerCase());
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 pb-10">
      <header className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-sky-500/10 p-3 text-sky-300"><ArrowRightLeft className="h-6 w-6" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Patrimônio</p><h1 className="text-2xl font-bold text-white">Histórico de movimentações</h1><p className="mt-1 text-sm text-gray-400">Transferências, empréstimos, devoluções e manutenções.</p></div></div><Link href="/patrimonio" className="text-sm font-semibold text-sky-300 hover:text-sky-200">Voltar ao inventário</Link></header>
      {error && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      <Card className="border-gray-800 bg-gray-900/70 p-5">
        <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-gray-400">{movements.length} registros</p><label className="flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2"><Search className="h-4 w-4 text-gray-500" /><input aria-label="Buscar movimentação" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar bem ou destino" className="w-40 bg-transparent text-sm text-white outline-none" /></label></div>
        {loading ? <p className="py-12 text-center text-sm text-gray-400">Carregando movimentações…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-gray-800 text-xs uppercase text-gray-500"><tr><th className="px-3 py-3">Bem</th><th className="px-3 py-3">Movimentação</th><th className="px-3 py-3">Destino</th><th className="px-3 py-3">Responsável</th><th className="px-3 py-3">Data</th><th className="px-3 py-3">Observação</th></tr></thead><tbody className="divide-y divide-gray-800">{filtered.map(movement => { const asset = assetMap.get(movement.bem_id); return <tr key={movement.id} className="text-gray-300"><td className="px-3 py-3"><p className="font-medium text-gray-100">{asset?.descricao ?? "Bem indisponível"}</p>{asset?.codigo && <p className="mt-1 text-[10px] text-gray-500">{asset.codigo}</p>}</td><td className="px-3 py-3">{movement.tipo_movimentacao}</td><td className="px-3 py-3">{movement.local_destino || "—"}</td><td className="px-3 py-3">{movement.responsavel || "—"}</td><td className="px-3 py-3">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(`${movement.data_movimentacao}T12:00:00`))}</td><td className="max-w-48 truncate px-3 py-3" title={movement.observacao ?? ""}>{movement.observacao || "—"}</td></tr>; })}</tbody></table>{!filtered.length && <p className="py-12 text-center text-sm text-gray-500">Nenhuma movimentação encontrada.</p>}</div>}
      </Card>
    </div>
  );
}
