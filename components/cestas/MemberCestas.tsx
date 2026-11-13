"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Heart, Loader2, Package, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { quantidadePorCestaSegura, type CestaCampanha, type CestaItem, type CestaReserva } from "@/lib/cestas";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/ui/FeedbackModal";

interface MemberCestasResponse {
  cestas?: CestaCampanha[];
  itens?: Array<CestaItem & { quantidade_reservada: number }>;
  reservas?: CestaReserva[];
  error?: string;
}

export default function MemberCestas() {
  const router = useRouter();
  const [cestas, setCestas] = useState<CestaCampanha[]>([]);
  const [itens, setItens] = useState<Array<CestaItem & { quantidade_reservada: number }>>([]);
  const [, setReservas] = useState<CestaReserva[]>([]);
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [reservando, setReservando] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });
  const requestRef = useRef(false);
  const mountedRef = useRef(true);

  const carregar = async () => {
    if (requestRef.current) return;
    requestRef.current = true;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login-membro"); return; }
      const response = await fetch("/api/membros/cestas", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const result = await response.json() as MemberCestasResponse;
      if (!response.ok) throw new Error(result.error || "Não foi possível consultar as campanhas.");
      if (!mountedRef.current) return;
      setCestas(result.cestas || []);
      setItens(result.itens || []);
      setReservas(result.reservas || []);
    } finally {
      requestRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    void carregar().catch((error) => {
      if (mountedRef.current) setModal({ isOpen: true, type: "error", title: "Área indisponível", message: error instanceof Error ? error.message : "A secretaria ainda não publicou uma cesta." });
    });
    return () => { mountedRef.current = false; };
    // A página deve carregar uma vez por entrada e manter a sessão do membro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itensPorCesta = useMemo(() => new Map(cestas.map((cesta) => [cesta.id, itens.filter((item) => item.cesta_id === cesta.id)])), [cestas, itens]);

  const reservar = async (item: CestaItem & { quantidade_reservada: number }) => {
    if (reservando) return;
    const quantidade = quantidades[item.id] || 1;
    setReservando(item.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch("/api/cestas/reservar", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ itemId: item.id, quantidade }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível reservar o item.");
      await carregar();
      setQuantidades((atuais) => ({ ...atuais, [item.id]: 1 }));
      setModal({ isOpen: true, type: "success", title: "Obrigado pela doação", message: "Sua reserva foi registrada. A secretaria recebeu a informação; se o WhatsApp estiver configurado, as notificações também foram enviadas." });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível reservar", message: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setReservando(null);
    }
  };

  if (loading) return <main className="bg-ohel-glow flex items-center justify-center text-gray-300"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando campanhas...</main>;
  return <main className="bg-ohel-glow p-0"><FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} /><div className="mx-auto max-w-4xl"><div className="mb-6 flex items-start gap-3"><Link href="/area-membro" className="mt-1 text-gray-400 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Área do Membro</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-white"><Heart className="h-6 w-6 text-emerald-400" /> Cestas básicas</h1><p className="mt-1 text-sm text-gray-400">Escolha a quantidade que você pretende doar. A meta total da campanha não é a mesma coisa que o já reservado.</p></div></div>{cestas.length === 0 ? <Card className="border-gray-800 text-center"><Package className="mx-auto mb-3 h-10 w-10 text-gray-600" /><p className="text-gray-300">Nenhuma campanha aberta no momento.</p><p className="mt-2 text-xs text-gray-500">A secretaria poderá publicar uma nova cesta quando necessário.</p></Card> : <div className="flex flex-col gap-5">{cestas.map((cesta) => <Card key={cesta.id} className="border-gray-800"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><h2 className="text-lg font-bold text-white">{cesta.nome}</h2><p className="mt-1 text-sm text-gray-400">{cesta.descricao || "Ajude a completar esta cesta para uma família."}</p></div><span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs text-emerald-200">Meta: {cesta.quantidade_cestas} {cesta.quantidade_cestas === 1 ? "cesta" : "cestas"}</span></div><div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">{(itensPorCesta.get(cesta.id) || []).map((item) => { const total = item.quantidade_reservada || 0; const falta = Math.max(0, item.quantidade_necessaria - total); const quantidade = quantidades[item.id] || 1; const porCesta = quantidadePorCestaSegura(item, cesta.quantidade_cestas); return <div key={item.id} className="rounded-xl border border-gray-800 bg-ohel-bg p-4"><div className="flex justify-between gap-3"><div><p className="text-sm font-semibold text-white">{item.nome}</p><p className="mt-1 text-xs text-gray-400">Meta da campanha: {item.quantidade_necessaria} {item.unidade}{porCesta === null ? " · item legado" : ` · ${porCesta} ${item.unidade} por cesta × ${cesta.quantidade_cestas}`}</p><p className="mt-1 text-xs text-gray-500">Já reservado: {total} {item.unidade} · falta: {falta} {item.unidade}</p></div>{falta === 0 ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /> : <span className="text-xs text-emerald-300">{total}/{item.quantidade_necessaria}</span>}</div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-800"><div className="h-full bg-emerald-500" style={{ width: `${item.quantidade_necessaria ? Math.min(100, total / item.quantidade_necessaria * 100) : 0}%` }} /></div>{falta > 0 && <div className="mt-4 flex gap-2"><input aria-label={`Quantidade de ${item.nome}`} type="number" min="1" max={falta} value={quantidade} onChange={(event) => setQuantidades((atuais) => ({ ...atuais, [item.id]: Math.min(falta, Math.max(1, Number(event.target.value) || 1)) }))} className="input-ohel w-20 rounded-md px-3 py-2 text-sm" /><Button type="button" onClick={() => void reservar(item)} disabled={reservando !== null} className="flex-1 text-xs">{reservando === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 h-4 w-4" /> Marcar que vou doar</>}</Button></div>}</div>; })}</div></Card>)}</div>}</div></main>;
}
