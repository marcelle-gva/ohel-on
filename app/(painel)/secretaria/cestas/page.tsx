"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAccess } from "@/components/layout/AccessShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { Input } from "@/components/ui/Input";
import { podeAcessar } from "@/lib/access";
import { ArrowLeft, Bell, Check, ClipboardList, Link2, PackagePlus, Plus, Trash2 } from "lucide-react";

interface Cesta {
  id: string;
  nome: string;
  descricao: string | null;
  status: string;
  created_at: string;
}

interface Item {
  id: string;
  cesta_id: string;
  nome: string;
  quantidade_necessaria: number;
  unidade: string;
}

interface Reserva {
  id: string;
  item_id: string;
  nome_doador: string;
  quantidade: number;
  status: string;
  reservado_em: string;
  whatsapp_doador_status: string;
  whatsapp_responsaveis_status: string;
}

interface Responsavel {
  id: string;
  nome: string;
  telefone: string;
  ativo: boolean;
  notificar_reserva: boolean;
}

export default function CestasPage() {
  const contexto = useAccess();
  const podeCriarCampanha = contexto ? podeAcessar(contexto, "cestas", "criar") : false;
  const podeEditarCampanha = contexto ? podeAcessar(contexto, "cestas", "editar") : false;
  const podeExcluirItens = contexto ? podeAcessar(contexto, "cestas", "excluir") : false;
  const podeGerirResponsaveis = podeCriarCampanha;

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

  const carregar = async (id: string, incluirResponsaveis: boolean) => {
    const [cestasRes, itensRes, reservasRes] = await Promise.all([
      supabase.from("cestas_basicas").select("id, nome, descricao, status, created_at").eq("igreja_id", id).order("created_at", { ascending: false }),
      supabase.from("cesta_itens").select("id, cesta_id, nome, quantidade_necessaria, unidade").eq("igreja_id", id).order("created_at"),
      supabase.from("cesta_doacoes").select("id, item_id, nome_doador, quantidade, status, reservado_em, whatsapp_doador_status, whatsapp_responsaveis_status").eq("igreja_id", id).order("reservado_em", { ascending: false }),
    ]);
    const error = cestasRes.error || itensRes.error || reservasRes.error;
    if (error) throw error;

    const lista = (cestasRes.data || []) as Cesta[];
    setCestas(lista);
    setItens((itensRes.data || []) as Item[]);
    setReservas((reservasRes.data || []) as Reserva[]);
    if (!cestaSelecionada && lista[0]) setCestaSelecionada(lista[0].id);

    // Telefones seguem o escopo de permissões de Cestas; não consultamos esse dado
    // para quem não pode criar/gerenciar a campanha.
    if (incluirResponsaveis) {
      const { data, error: responsaveisError } = await supabase
        .from("cestas_responsaveis")
        .select("id, nome, telefone, ativo, notificar_reserva")
        .eq("igreja_id", id)
        .order("nome");
      if (responsaveisError) throw responsaveisError;
      setResponsaveis((data || []) as Responsavel[]);
    } else {
      setResponsaveis([]);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: user, error: userError } = await supabase
          .from("usuarios")
          .select("igreja_id")
          .eq("id", session.user.id)
          .maybeSingle();
        if (userError) throw userError;
        if (!user?.igreja_id) throw new Error("Sua conta não está vinculada a uma igreja.");
        setIgrejaId(user.igreja_id);
        await carregar(user.igreja_id, podeGerirResponsaveis);
      } catch (error) {
        setModal({
          isOpen: true,
          type: "error",
          title: "Não foi possível carregar as cestas",
          message: error instanceof Error ? error.message : "Verifique seu acesso e a configuração das cestas.",
        });
      } finally {
        setLoading(false);
      }
    };
    void init();
    // O contexto de acesso é carregado antes de o painel exibir esta página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cestaAtual = cestas.find((cesta) => cesta.id === cestaSelecionada) || null;
  const itensAtuais = useMemo(() => itens.filter((item) => item.cesta_id === cestaSelecionada), [itens, cestaSelecionada]);
  const reservasDoItem = (itemId: string) => reservas
    .filter((reserva) => reserva.item_id === itemId && reserva.status !== "cancelado")
    .reduce((total, reserva) => total + reserva.quantidade, 0);

  const criarCesta = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!podeCriarCampanha) {
      setModal({ isOpen: true, type: "error", title: "Permissão necessária", message: "Peça ao administrador para conceder ao seu grupo acesso de leitura e criação no módulo Cestas Básicas." });
      return;
    }
    if (!igrejaId || !novaCesta.nome.trim()) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("cestas_basicas")
        .insert({
          igreja_id: igrejaId,
          nome: novaCesta.nome.trim(),
          descricao: novaCesta.descricao.trim() || null,
          created_by: user?.id || null,
        })
        .select("id, nome, descricao, status, created_at")
        .single();
      if (error) {
        if (error.code === "42501") {
          throw new Error("Sua conta não tem permissão para criar campanhas. Peça ao administrador acesso de leitura e criação em Cestas Básicas.");
        }
        throw error;
      }

      setCestas((atuais) => [data as Cesta, ...atuais.filter((cesta) => cesta.id !== data.id)]);
      setCestaSelecionada(data.id);
      try {
        await carregar(igrejaId, podeGerirResponsaveis);
      } catch {
        setModal({ isOpen: true, type: "success", title: "Campanha criada", message: "A campanha foi salva, mas não foi possível atualizar a lista. Recarregue a página para ver os dados mais recentes." });
        return;
      }
      setModal({ isOpen: true, type: "success", title: "Campanha criada", message: "Agora adicione os itens que faltam." });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível criar a campanha", message: error instanceof Error ? error.message : "Verifique sua conexão e tente novamente." });
    } finally {
      setSaving(false);
    }
  };

  const adicionarItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!podeCriarCampanha || !igrejaId || !cestaSelecionada || !novoItem.nome.trim()) return;
    const quantidade = Number(novoItem.quantidade_necessaria);
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      setModal({ isOpen: true, type: "error", title: "Quantidade inválida", message: "Informe uma quantidade inteira maior que zero." });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("cesta_itens").insert({
        igreja_id: igrejaId,
        cesta_id: cestaSelecionada,
        nome: novoItem.nome.trim(),
        quantidade_necessaria: quantidade,
        unidade: novoItem.unidade.trim() || "unidade",
      });
      if (error) throw error;
      setNovoItem({ nome: "", quantidade_necessaria: "1", unidade: "unidade" });
      await carregar(igrejaId, podeGerirResponsaveis);
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível adicionar o item", message: error instanceof Error ? error.message : "Verifique os dados e tente novamente." });
    } finally {
      setSaving(false);
    }
  };

  const adicionarResponsavel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!podeGerirResponsaveis || !igrejaId || !novoResponsavel.nome.trim() || !novoResponsavel.telefone.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("cestas_responsaveis").insert({
        igreja_id: igrejaId,
        nome: novoResponsavel.nome.trim(),
        telefone: novoResponsavel.telefone.trim(),
        ativo: true,
        notificar_reserva: true,
      });
      if (error) throw error;
      setNovoResponsavel({ nome: "", telefone: "" });
      await carregar(igrejaId, podeGerirResponsaveis);
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível adicionar o responsável", message: error instanceof Error ? error.message : "Verifique os dados e tente novamente." });
    } finally {
      setSaving(false);
    }
  };

  const excluirItem = async (id: string) => {
    if (!igrejaId || !podeExcluirItens) return;
    const { error } = await supabase.from("cesta_itens").delete().eq("id", id).eq("igreja_id", igrejaId);
    if (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível excluir", message: error.message });
      return;
    }
    await carregar(igrejaId, podeGerirResponsaveis);
  };

  const encerrarCesta = async () => {
    if (!igrejaId || !cestaAtual || !podeEditarCampanha) return;
    const { error } = await supabase.from("cestas_basicas").update({ status: "encerrada" }).eq("id", cestaAtual.id).eq("igreja_id", igrejaId);
    if (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível encerrar", message: error.message });
      return;
    }
    await carregar(igrejaId, podeGerirResponsaveis);
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando cestas...</div>;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/dashboard" className="mt-1 text-gray-400 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><PackagePlus className="h-6 w-6 text-emerald-400" /> Cestas Básicas</h1>
            <p className="mt-1 text-sm text-gray-400">Publique o que falta e acompanhe quem se comprometeu a doar.</p>
          </div>
        </div>
        <Link href="/area-membro/cestas" target="_blank" className="flex items-center gap-1 text-xs text-ohel-blue hover:text-white"><Link2 className="h-3.5 w-3.5" /> Ver área do membro</Link>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5">
          <Card className="border-gray-800 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Plus className="h-4 w-4 text-emerald-400" /> Nova campanha</h2>
            {podeCriarCampanha ? (
              <form onSubmit={criarCesta} className="flex flex-col gap-3">
                <Input label="Nome" value={novaCesta.nome} onChange={(event) => setNovaCesta({ ...novaCesta, nome: event.target.value })} required />
                <textarea placeholder="Mensagem para os membros" value={novaCesta.descricao} onChange={(event) => setNovaCesta({ ...novaCesta, descricao: event.target.value })} className="input-ohel min-h-20 w-full rounded-md px-3 py-2 text-sm" />
                <Button type="submit" disabled={saving} className="w-full">{saving ? "Criando..." : "Criar cesta"}</Button>
              </form>
            ) : (
              <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-200">Seu grupo tem acesso de consulta, mas não de criação. Peça ao administrador para habilitar “Criar” em Cestas Básicas.</p>
            )}
          </Card>

          {podeGerirResponsaveis && (
            <Card className="border-gray-800 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Bell className="h-4 w-4 text-yellow-400" /> Responsáveis WhatsApp</h2>
              <form onSubmit={adicionarResponsavel} className="flex flex-col gap-3">
                <Input label="Nome" value={novoResponsavel.nome} onChange={(event) => setNovoResponsavel({ ...novoResponsavel, nome: event.target.value })} required />
                <Input label="WhatsApp" placeholder="(21) 99999-9999" value={novoResponsavel.telefone} onChange={(event) => setNovoResponsavel({ ...novoResponsavel, telefone: event.target.value })} required />
                <Button type="submit" variant="secondary" disabled={saving} className="w-full">Adicionar responsável</Button>
              </form>
              <div className="mt-4 flex flex-col gap-2">
                {responsaveis.map((responsavel) => (
                  <div key={responsavel.id} className="flex items-center justify-between gap-2 border-t border-gray-800 pt-2 text-xs">
                    <span className="text-gray-300">{responsavel.nome}<small className="block text-gray-500">{responsavel.telefone}</small></span>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <Card className="border-gray-800 p-5 lg:col-span-2">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div><h2 className="text-lg font-bold text-white">Itens da cesta</h2><p className="text-xs text-gray-500">Cada reserva reduz automaticamente o que ainda falta.</p></div>
            <select value={cestaSelecionada} onChange={(event) => setCestaSelecionada(event.target.value)} className="input-ohel rounded-md px-3 py-2 text-xs">
              {cestas.length === 0 ? <option value="">Crie uma cesta</option> : cestas.map((cesta) => <option key={cesta.id} value={cesta.id}>{cesta.nome} · {cesta.status}</option>)}
            </select>
          </div>
          {cestaAtual && (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div><p className="text-sm font-semibold text-white">{cestaAtual.nome}</p><p className="mt-1 text-xs text-gray-400">{cestaAtual.descricao || "Campanha de arrecadação"}</p></div>
              {cestaAtual.status === "aberta" && podeEditarCampanha && <button type="button" onClick={() => void encerrarCesta()} className="text-[10px] text-yellow-400 hover:text-yellow-300">Encerrar</button>}
            </div>
          )}
          {cestaAtual?.status === "aberta" && podeCriarCampanha && (
            <form onSubmit={adicionarItem} className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px_120px_auto]">
              <Input aria-label="Item" placeholder="Ex: Arroz 5kg" value={novoItem.nome} onChange={(event) => setNovoItem({ ...novoItem, nome: event.target.value })} required />
              <Input aria-label="Quantidade" type="number" min="1" step="1" value={novoItem.quantidade_necessaria} onChange={(event) => setNovoItem({ ...novoItem, quantidade_necessaria: event.target.value })} required />
              <Input aria-label="Unidade" placeholder="unidade" value={novoItem.unidade} onChange={(event) => setNovoItem({ ...novoItem, unidade: event.target.value })} required />
              <Button type="submit" disabled={saving} className="px-3"><Plus className="h-4 w-4" /></Button>
            </form>
          )}
          <div className="flex flex-col gap-3">
            {itensAtuais.length === 0 ? <p className="py-8 text-center text-xs text-gray-500">Nenhum item cadastrado nesta cesta.</p> : itensAtuais.map((item) => {
              const reservado = reservasDoItem(item.id);
              const falta = Math.max(0, item.quantidade_necessaria - reservado);
              return (
                <div key={item.id} className="rounded-lg border border-gray-800 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0"><p className="text-sm font-semibold text-white">{item.nome}</p><p className="text-xs text-gray-500">{reservado} de {item.quantidade_necessaria} {item.unidade} comprometidos · <span className={falta ? "text-yellow-400" : "text-emerald-400"}>{falta ? `faltam ${falta}` : "completo"}</span></p></div>
                    {podeExcluirItens && <button type="button" onClick={() => void excluirItem(item.id)} aria-label={`Excluir ${item.nome}`} className="text-gray-600 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-800"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, reservado / item.quantidade_necessaria * 100)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="border-gray-800 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><ClipboardList className="h-4 w-4 text-ohel-blue" /> Reservas recebidas</h2>
        {reservas.length === 0 ? <p className="text-xs text-gray-500">Nenhuma reserva ainda.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-gray-800 text-gray-500"><th className="p-2">Doador</th><th className="p-2">Item</th><th className="p-2">Qtd.</th><th className="p-2">Data</th><th className="p-2">WhatsApp</th></tr></thead><tbody>
            {reservas.map((reserva) => <tr key={reserva.id} className="border-b border-gray-800/60"><td className="p-2 text-white">{reserva.nome_doador}</td><td className="p-2 text-gray-300">{itens.find((item) => item.id === reserva.item_id)?.nome || "-"}</td><td className="p-2 text-gray-300">{reserva.quantidade}</td><td className="p-2 text-gray-500">{new Date(reserva.reservado_em).toLocaleString("pt-BR")}</td><td className="p-2 text-gray-500">{reserva.whatsapp_responsaveis_status}</td></tr>)}
          </tbody></table></div>
        )}
      </Card>
    </div>
  );
}
