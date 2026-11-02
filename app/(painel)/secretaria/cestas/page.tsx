"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Bell, Check, ClipboardList, Link2, PackagePlus, Plus, Trash2 } from "lucide-react";

interface Cesta { id: string; nome: string; descricao: string | null; status: string; created_at: string; }
interface Item { id: string; cesta_id: string; nome: string; quantidade_necessaria: number; unidade: string; }
interface Reserva { id: string; item_id: string; nome_doador: string; quantidade: number; status: string; reservado_em: string; whatsapp_doador_status: string; whatsapp_responsaveis_status: string; }
interface Responsavel { id: string; nome: string; telefone: string; ativo: boolean; notificar_reserva: boolean; }

export default function CestasPage() {
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [cestas, setCestas] = useState<Cesta[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [cestaSelecionada, setCestaSelecionada] = useState("");
  const [novoItem, setNovoItem] = useState({ nome: "", quantidade_necessaria: "1", unidade: "unidade" });
  const [novaCesta, setNovaCesta] = useState({ nome: "Cesta básica - campanha atual", descricao: "" });
  const [novoResponsavel, setNovoResponsavel] = useState({ nome: "", telefone: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const carregar = async (id: string) => {
    const [cestasRes, itensRes, reservasRes, responsaveisRes] = await Promise.all([
      supabase.from("cestas_basicas").select("id, nome, descricao, status, created_at").eq("igreja_id", id).order("created_at", { ascending: false }),
      supabase.from("cesta_itens").select("id, cesta_id, nome, quantidade_necessaria, unidade").eq("igreja_id", id).order("created_at"),
      supabase.from("cesta_doacoes").select("id, item_id, nome_doador, quantidade, status, reservado_em, whatsapp_doador_status, whatsapp_responsaveis_status").eq("igreja_id", id).order("reservado_em", { ascending: false }),
      supabase.from("cestas_responsaveis").select("id, nome, telefone, ativo, notificar_reserva").eq("igreja_id", id).order("nome"),
    ]);
    const error = cestasRes.error || itensRes.error || reservasRes.error || responsaveisRes.error;
    if (error) throw error;
    const lista = (cestasRes.data || []) as Cesta[];
    setCestas(lista); setItens((itensRes.data || []) as Item[]); setReservas((reservasRes.data || []) as Reserva[]); setResponsaveis((responsaveisRes.data || []) as Responsavel[]);
    if (!cestaSelecionada && lista[0]) setCestaSelecionada(lista[0].id);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: user } = await supabase.from("usuarios").select("igreja_id").eq("id", session.user.id).maybeSingle();
        if (!user?.igreja_id) return;
        setIgrejaId(user.igreja_id); await carregar(user.igreja_id);
      } catch (error) { setModal({ isOpen: true, type: "error", title: "Não foi possível carregar", message: error instanceof Error ? error.message : "Execute a migration das cestas." }); }
      finally { setLoading(false); }
    };
    void init();
    // O carregamento ocorre apenas uma vez para a igreja da sessão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cestaAtual = cestas.find((cesta) => cesta.id === cestaSelecionada) || null;
  const itensAtuais = useMemo(() => itens.filter((item) => item.cesta_id === cestaSelecionada), [itens, cestaSelecionada]);
  const reservasDoItem = (itemId: string) => reservas.filter((reserva) => reserva.item_id === itemId && reserva.status !== "cancelado").reduce((total, reserva) => total + reserva.quantidade, 0);

  const criarCesta = async (event: React.FormEvent) => {
    event.preventDefault(); if (!igrejaId || !novaCesta.nome.trim()) return; setSaving(true);
    const { data, error } = await supabase.from("cestas_basicas").insert({ igreja_id: igrejaId, nome: novaCesta.nome.trim(), descricao: novaCesta.descricao.trim() || null, created_by: (await supabase.auth.getUser()).data.user?.id }).select("id, nome, descricao, status, created_at").single();
    setSaving(false); if (error) return setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
    await carregar(igrejaId); setCestaSelecionada(data.id); setModal({ isOpen: true, type: "success", title: "Cesta criada", message: "Agora adicione os itens que faltam." });
  };

  const adicionarItem = async (event: React.FormEvent) => {
    event.preventDefault(); if (!igrejaId || !cestaSelecionada || !novoItem.nome.trim()) return; setSaving(true);
    const { error } = await supabase.from("cesta_itens").insert({ igreja_id: igrejaId, cesta_id: cestaSelecionada, nome: novoItem.nome.trim(), quantidade_necessaria: Number(novoItem.quantidade_necessaria), unidade: novoItem.unidade.trim() || "unidade" });
    setSaving(false); if (error) return setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
    setNovoItem({ nome: "", quantidade_necessaria: "1", unidade: "unidade" }); await carregar(igrejaId);
  };

  const adicionarResponsavel = async (event: React.FormEvent) => {
    event.preventDefault(); if (!igrejaId || !novoResponsavel.nome.trim() || !novoResponsavel.telefone.trim()) return; setSaving(true);
    const { error } = await supabase.from("cestas_responsaveis").insert({ igreja_id: igrejaId, nome: novoResponsavel.nome.trim(), telefone: novoResponsavel.telefone.trim(), ativo: true, notificar_reserva: true });
    setSaving(false); if (error) return setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
    setNovoResponsavel({ nome: "", telefone: "" }); await carregar(igrejaId);
  };

  const excluirItem = async (id: string) => { if (!igrejaId) return; await supabase.from("cesta_itens").delete().eq("id", id).eq("igreja_id", igrejaId); await carregar(igrejaId); };
  const encerrarCesta = async () => { if (!igrejaId || !cestaAtual) return; await supabase.from("cestas_basicas").update({ status: "encerrada" }).eq("id", cestaAtual.id).eq("igreja_id", igrejaId); await carregar(igrejaId); };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando cestas...</div>;
  return <div className="max-w-7xl mx-auto flex flex-col gap-5 pb-10"><FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />
    <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><Link href="/dashboard" className="text-gray-400 hover:text-white mt-1"><ArrowLeft className="w-5 h-5" /></Link><div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><PackagePlus className="w-6 h-6 text-emerald-400" /> Cestas Básicas</h1><p className="text-gray-400 text-sm mt-1">Publique o que falta e acompanhe quem se comprometeu a doar.</p></div></div><Link href="/area-membro/cestas" target="_blank" className="text-xs text-ohel-blue hover:text-white flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Ver área do membro</Link></div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5"><div className="flex flex-col gap-5"><Card className="p-5 border-gray-800"><h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Plus className="w-4 h-4 text-emerald-400" /> Nova campanha</h2><form onSubmit={criarCesta} className="flex flex-col gap-3"><Input label="Nome" value={novaCesta.nome} onChange={(event) => setNovaCesta({ ...novaCesta, nome: event.target.value })} required /><textarea placeholder="Mensagem para os membros" value={novaCesta.descricao} onChange={(event) => setNovaCesta({ ...novaCesta, descricao: event.target.value })} className="input-ohel w-full px-3 py-2 rounded-md text-sm min-h-20" /><Button type="submit" disabled={saving} className="w-full">Criar cesta</Button></form></Card><Card className="p-5 border-gray-800"><h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Bell className="w-4 h-4 text-yellow-400" /> Responsáveis WhatsApp</h2><form onSubmit={adicionarResponsavel} className="flex flex-col gap-3"><Input label="Nome" value={novoResponsavel.nome} onChange={(event) => setNovoResponsavel({ ...novoResponsavel, nome: event.target.value })} required /><Input label="WhatsApp" placeholder="(21) 99999-9999" value={novoResponsavel.telefone} onChange={(event) => setNovoResponsavel({ ...novoResponsavel, telefone: event.target.value })} required /><Button type="submit" variant="secondary" disabled={saving} className="w-full">Adicionar responsável</Button></form><div className="flex flex-col gap-2 mt-4">{responsaveis.map((responsavel) => <div key={responsavel.id} className="flex items-center justify-between gap-2 text-xs border-t border-gray-800 pt-2"><span className="text-gray-300">{responsavel.nome}<small className="block text-gray-500">{responsavel.telefone}</small></span><Check className="w-3.5 h-3.5 text-emerald-400" /></div>)}</div></Card></div>
      <Card className="lg:col-span-2 p-5 border-gray-800"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5"><div><h2 className="text-lg font-bold text-white">Itens da cesta</h2><p className="text-xs text-gray-500">Cada reserva reduz automaticamente o que ainda falta.</p></div><select value={cestaSelecionada} onChange={(event) => setCestaSelecionada(event.target.value)} className="input-ohel px-3 py-2 rounded-md text-xs">{cestas.length === 0 ? <option value="">Crie uma cesta</option> : cestas.map((cesta) => <option key={cesta.id} value={cesta.id}>{cesta.nome} · {cesta.status}</option>)}</select></div>{cestaAtual && <div className="flex items-start justify-between gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 mb-4"><div><p className="text-sm text-white font-semibold">{cestaAtual.nome}</p><p className="text-xs text-gray-400 mt-1">{cestaAtual.descricao || "Campanha de arrecadação"}</p></div>{cestaAtual.status === "aberta" && <button type="button" onClick={encerrarCesta} className="text-[10px] text-yellow-400 hover:text-yellow-300">Encerrar</button>}</div>}{cestaAtual?.status === "aberta" && <form onSubmit={adicionarItem} className="grid grid-cols-1 sm:grid-cols-[1fr_110px_120px_auto] gap-2 mb-5"><Input aria-label="Item" placeholder="Ex: Arroz 5kg" value={novoItem.nome} onChange={(event) => setNovoItem({ ...novoItem, nome: event.target.value })} required /><Input aria-label="Quantidade" type="number" min="1" value={novoItem.quantidade_necessaria} onChange={(event) => setNovoItem({ ...novoItem, quantidade_necessaria: event.target.value })} required /><Input aria-label="Unidade" placeholder="unidade" value={novoItem.unidade} onChange={(event) => setNovoItem({ ...novoItem, unidade: event.target.value })} required /><Button type="submit" disabled={saving} className="px-3"><Plus className="w-4 h-4" /></Button></form>}<div className="flex flex-col gap-3">{itensAtuais.length === 0 ? <p className="text-xs text-gray-500 py-8 text-center">Nenhum item cadastrado nesta cesta.</p> : itensAtuais.map((item) => { const reservado = reservasDoItem(item.id); const falta = Math.max(0, item.quantidade_necessaria - reservado); return <div key={item.id} className="border border-gray-800 rounded-lg p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm text-white font-semibold">{item.nome}</p><p className="text-xs text-gray-500">{reservado} de {item.quantidade_necessaria} {item.unidade} comprometidos · <span className={falta ? "text-yellow-400" : "text-emerald-400"}>{falta ? `faltam ${falta}` : "completo"}</span></p></div><button type="button" onClick={() => void excluirItem(item.id)} className="text-gray-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button></div><div className="h-1.5 bg-gray-800 rounded-full mt-3 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, reservado / item.quantidade_necessaria * 100)}%` }} /></div></div>; })}</div></Card></div>
    <Card className="p-5 border-gray-800"><h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4"><ClipboardList className="w-4 h-4 text-ohel-blue" /> Reservas recebidas</h2>{reservas.length === 0 ? <p className="text-xs text-gray-500">Nenhuma reserva ainda.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="text-gray-500 border-b border-gray-800"><th className="p-2">Doador</th><th className="p-2">Item</th><th className="p-2">Qtd.</th><th className="p-2">Data</th><th className="p-2">WhatsApp</th></tr></thead><tbody>{reservas.map((reserva) => <tr key={reserva.id} className="border-b border-gray-800/60"><td className="p-2 text-white">{reserva.nome_doador}</td><td className="p-2 text-gray-300">{itens.find((item) => item.id === reserva.item_id)?.nome || "-"}</td><td className="p-2 text-gray-300">{reserva.quantidade}</td><td className="p-2 text-gray-500">{new Date(reserva.reservado_em).toLocaleString("pt-BR")}</td><td className="p-2 text-gray-500">{reserva.whatsapp_responsaveis_status}</td></tr>)}</tbody></table></div>}</Card>
  </div>;
}
