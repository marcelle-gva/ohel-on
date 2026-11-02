"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Heart, Loader2, Package, Plus, CheckCircle2 } from "lucide-react";

interface Cesta { id: string; nome: string; descricao: string | null; status: string; }
interface Item { id: string; cesta_id: string; nome: string; quantidade_necessaria: number; unidade: string; }
interface Reserva { id: string; item_id: string; quantidade: number; status: string; reservado_em: string; }

export default function AreaMembroCestasPage() {
  const router = useRouter();
  const [cestas, setCestas] = useState<Cesta[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [reservando, setReservando] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const carregar = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login-membro"); return; }
    const [cestasRes, itensRes, reservasRes] = await Promise.all([
      supabase.from("cestas_basicas").select("id, nome, descricao, status").eq("status", "aberta").order("created_at", { ascending: false }),
      supabase.from("cesta_itens").select("id, cesta_id, nome, quantidade_necessaria, unidade").order("created_at"),
      supabase.from("cesta_doacoes").select("id, item_id, quantidade, status, reservado_em").order("reservado_em", { ascending: false }),
    ]);
    if (cestasRes.error || itensRes.error || reservasRes.error) throw cestasRes.error || itensRes.error || reservasRes.error;
    setCestas((cestasRes.data || []) as Cesta[]); setItens((itensRes.data || []) as Item[]); setReservas((reservasRes.data || []) as Reserva[]);
  };

  // O carregamento inicial sincroniza a sessão autenticada e os dados do Supabase.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void carregar().catch((error) => setModal({ isOpen: true, type: "error", title: "Área indisponível", message: error instanceof Error ? error.message : "A secretaria ainda não publicou uma cesta." })).finally(() => setLoading(false)); }, []);

  const reservado = (itemId: string) => reservas.filter((reserva) => reserva.item_id === itemId && reserva.status !== "cancelado").reduce((sum, reserva) => sum + reserva.quantidade, 0);
  const itensPorCesta = useMemo(() => new Map(cestas.map((cesta) => [cesta.id, itens.filter((item) => item.cesta_id === cesta.id)])), [cestas, itens]);

  const reservar = async (item: Item) => {
    const quantidade = quantidades[item.id] || 1;
    setReservando(item.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch("/api/cestas/reservar", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ itemId: item.id, quantidade }) });
      const result = await response.json() as { error?: string; notificacoes?: unknown };
      if (!response.ok) throw new Error(result.error || "Não foi possível reservar o item.");
      await carregar();
      setModal({ isOpen: true, type: "success", title: "Obrigado pela doação", message: "Sua reserva foi registrada. A secretaria recebeu a informação; se o WhatsApp estiver configurado, as notificações também foram enviadas." });
    } catch (error) { setModal({ isOpen: true, type: "error", title: "Não foi possível reservar", message: error instanceof Error ? error.message : "Tente novamente." }); }
    finally { setReservando(null); }
  };

  if (loading) return <main className="min-h-screen bg-ohel-glow flex items-center justify-center text-gray-300"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando campanhas...</main>;
  return <main className="min-h-screen bg-ohel-glow p-4 md:p-8"><FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} /><div className="max-w-4xl mx-auto"><div className="flex items-start gap-3 mb-6"><Link href="/area-membro" className="text-gray-400 hover:text-white mt-1"><ArrowLeft className="w-5 h-5" /></Link><div><p className="text-xs text-emerald-300 uppercase tracking-wider font-semibold">Área do Membro</p><h1 className="text-2xl font-bold text-white mt-1 flex items-center gap-2"><Heart className="w-6 h-6 text-emerald-400" /> Cestas básicas</h1><p className="text-sm text-gray-400 mt-1">Escolha um item que você pode doar. A quantidade restante é atualizada para todos.</p></div></div>{cestas.length === 0 ? <Card className="text-center border-gray-800"><Package className="w-10 h-10 mx-auto text-gray-600 mb-3" /><p className="text-gray-300">Nenhuma campanha aberta no momento.</p><p className="text-xs text-gray-500 mt-2">A secretaria poderá publicar uma nova cesta quando necessário.</p></Card> : <div className="flex flex-col gap-5">{cestas.map((cesta) => <Card key={cesta.id} className="border-gray-800"><h2 className="text-lg font-bold text-white">{cesta.nome}</h2><p className="text-sm text-gray-400 mt-1 mb-5">{cesta.descricao || "Ajude a completar esta cesta para uma família."}</p><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{(itensPorCesta.get(cesta.id) || []).map((item) => { const total = reservado(item.id); const falta = Math.max(0, item.quantidade_necessaria - total); const quantidade = quantidades[item.id] || 1; return <div key={item.id} className="border border-gray-800 rounded-xl p-4 bg-ohel-bg"><div className="flex justify-between gap-3"><div><p className="text-sm font-semibold text-white">{item.nome}</p><p className="text-xs text-gray-500 mt-1">{falta > 0 ? `Faltam ${falta} ${item.unidade}` : "Item completo"}</p></div>{falta === 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <span className="text-xs text-emerald-300">{total}/{item.quantidade_necessaria}</span>}</div><div className="h-1.5 bg-gray-800 rounded-full mt-3 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, total / item.quantidade_necessaria * 100)}%` }} /></div>{falta > 0 && <div className="flex gap-2 mt-4"><input aria-label={`Quantidade de ${item.nome}`} type="number" min="1" max={falta} value={quantidade} onChange={(event) => setQuantidades({ ...quantidades, [item.id]: Math.min(falta, Math.max(1, Number(event.target.value) || 1)) })} className="input-ohel w-20 px-3 py-2 rounded-md text-sm" /><Button type="button" onClick={() => void reservar(item)} disabled={reservando === item.id} className="flex-1 text-xs">{reservando === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> Marcar que vou doar</>}</Button></div>}</div>; })}</div></Card>)}</div>}</div></main>;
}
