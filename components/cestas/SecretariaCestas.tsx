"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, Check, ClipboardList, Link2, PackagePlus, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { podeAcessar } from "@/lib/access";
import {
  compromissoPorReserva,
  quantidadePorCestaSegura,
  separarCompromissos,
  type CestaCampanha,
  type CestaItem,
  type CestaReserva,
  type CestaResponsavel,
  type CestaSugestao,
} from "@/lib/cestas";
import { useAccess } from "@/components/layout/AccessShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { Input } from "@/components/ui/Input";

interface CestasResponse {
  cestas?: CestaCampanha[];
  itens?: CestaItem[];
  reservas?: CestaReserva[];
  responsaveis?: CestaResponsavel[];
  sugestoes?: CestaSugestao[];
  error?: string;
}

interface ItemForm {
  nome: string;
  unidade: string;
  quantidadePorCesta: string;
}

const ITEM_VAZIO: ItemForm = { nome: "", unidade: "unidade", quantidadePorCesta: "1" };

export default function SecretariaCestas() {
  const router = useRouter();
  const contexto = useAccess();
  const podeLer = Boolean(contexto && podeAcessar(contexto, "cestas", "ler"));
  const podeCriar = Boolean(contexto && podeAcessar(contexto, "cestas", "criar"));
  const podeEditar = Boolean(contexto && podeAcessar(contexto, "cestas", "editar"));
  const podeExcluir = Boolean(contexto && podeAcessar(contexto, "cestas", "excluir"));
  const [cestas, setCestas] = useState<CestaCampanha[]>([]);
  const [itens, setItens] = useState<CestaItem[]>([]);
  const [reservas, setReservas] = useState<CestaReserva[]>([]);
  const [responsaveis, setResponsaveis] = useState<CestaResponsavel[]>([]);
  const [sugestoes, setSugestoes] = useState<CestaSugestao[]>([]);
  const [cestaSelecionada, setCestaSelecionada] = useState("");
  const [novaCesta, setNovaCesta] = useState({ nome: "Cesta básica - campanha atual", descricao: "", quantidadeCestas: "1" });
  const [edicaoCampanha, setEdicaoCampanha] = useState({ nome: "", descricao: "" });
  const [quantidadeCestas, setQuantidadeCestas] = useState("1");
  const [novoItem, setNovoItem] = useState<ItemForm>(ITEM_VAZIO);
  const [itemEditando, setItemEditando] = useState<string | null>(null);
  const [formItemEditado, setFormItemEditado] = useState<ItemForm>(ITEM_VAZIO);
  const [novoResponsavel, setNovoResponsavel] = useState({ nome: "", telefone: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });
  const requestRef = useRef(false);
  const mountedRef = useRef(true);

  const feedback = (type: "success" | "error", title: string, message: string) => {
    setModal({ isOpen: true, type, title, message });
  };

  const api = async (init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      router.replace("/login");
      throw new Error("Sua sessão expirou. Entre novamente para administrar as cestas.");
    }
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${session.access_token}`);
    if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch("/api/cestas", { ...init, headers, cache: "no-store" });
    const result = await response.json().catch(() => ({})) as CestasResponse;
    if (!response.ok) throw new Error(result.error || "Não foi possível concluir a operação.");
    return result;
  };

  const carregar = async (silencioso = false, campanhaPreferida?: string) => {
    if (requestRef.current) return;
    requestRef.current = true;
    try {
      const result = await api();
      if (!mountedRef.current) return;
      const campanhas = result.cestas || [];
      setCestas(campanhas);
      setItens(result.itens || []);
      setReservas(result.reservas || []);
      setResponsaveis(result.responsaveis || []);
      setSugestoes(result.sugestoes || []);
      const proximaCesta = campanhas.find((cesta) => cesta.id === campanhaPreferida)
        || campanhas.find((cesta) => cesta.id === cestaSelecionada)
        || campanhas[0]
        || null;
      setCestaSelecionada(proximaCesta?.id || "");
      if (proximaCesta) {
        setEdicaoCampanha({ nome: proximaCesta.nome, descricao: proximaCesta.descricao || "" });
        setQuantidadeCestas(String(proximaCesta.quantidade_cestas || 1));
      }
    } catch (error) {
      if (!silencioso) feedback("error", "Não foi possível carregar as cestas", error instanceof Error ? error.message : "Verifique seu acesso e tente novamente.");
    } finally {
      requestRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    const timer = window.setTimeout(() => void carregar(), 0);
    return () => { mountedRef.current = false; window.clearTimeout(timer); };
    // O timer mantém o efeito como sincronização assíncrona da sessão.
    // O painel já controla a sessão e o contexto de acesso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cestaAtual = cestas.find((cesta) => cesta.id === cestaSelecionada) || null;
  const itensAtuais = useMemo(() => itens.filter((item) => item.cesta_id === cestaSelecionada), [itens, cestaSelecionada]);
  const reservasDoItem = (itemId: string) => reservas.filter((reserva) => reserva.item_id === itemId);

  const selecionarCesta = (id: string) => {
    const proximaCesta = cestas.find((cesta) => cesta.id === id);
    setCestaSelecionada(id);
    if (proximaCesta) {
      setEdicaoCampanha({ nome: proximaCesta.nome, descricao: proximaCesta.descricao || "" });
      setQuantidadeCestas(String(proximaCesta.quantidade_cestas || 1));
    }
  };

  const executar = async (operation: () => Promise<void>) => {
    if (saving) return;
    setSaving(true);
    try {
      await operation();
    } catch (error) {
      feedback("error", "Não foi possível salvar", error instanceof Error ? error.message : "Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const criarCesta = async (event: FormEvent) => {
    event.preventDefault();
    if (!podeCriar) return feedback("error", "Permissão necessária", "Seu grupo não pode criar campanhas de cestas.");
    await executar(async () => {
      const result = await api({ method: "POST", body: JSON.stringify({ action: "criar-campanha", ...novaCesta }) });
      const campanha = result.cestas?.[0] || (result as CestasResponse & { campanha?: CestaCampanha }).campanha;
      await carregar(true, campanha?.id);
      feedback("success", "Campanha criada", "Defina os itens por cesta. O total da campanha será calculado automaticamente.");
    });
  };

  const salvarCampanha = async (event: FormEvent) => {
    event.preventDefault();
    if (!cestaAtual || !podeEditar) return;
    await executar(async () => {
      await api({ method: "PATCH", body: JSON.stringify({ action: "editar-campanha", cestaId: cestaAtual.id, ...edicaoCampanha }) });
      await carregar(true);
      feedback("success", "Campanha atualizada", "Nome e mensagem salvos sem alterar reservas.");
    });
  };

  const salvarQuantidadeCestas = async (event: FormEvent) => {
    event.preventDefault();
    if (!cestaAtual || !podeEditar) return;
    await executar(async () => {
      await api({ method: "PATCH", body: JSON.stringify({ action: "quantidade-cestas", cestaId: cestaAtual.id, quantidadeCestas }) });
      await carregar(true);
      feedback("success", "Quantidade de cestas atualizada", "As metas totais dos itens foram recalculadas atomicamente.");
    });
  };

  const adicionarItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!cestaAtual || !podeCriar) return;
    await executar(async () => {
      await api({ method: "POST", body: JSON.stringify({ action: "criar-item", cestaId: cestaAtual.id, ...novoItem }) });
      setNovoItem(ITEM_VAZIO);
      await carregar(true);
      feedback("success", "Item adicionado", "A meta foi calculada usando a quantidade por cesta e a quantidade da campanha.");
    });
  };

  const iniciarEdicaoItem = (item: CestaItem) => {
    setItemEditando(item.id);
    setFormItemEditado({ nome: item.nome, unidade: item.unidade, quantidadePorCesta: String(quantidadePorCestaSegura(item, cestaAtual?.quantidade_cestas || 1) || item.quantidade_necessaria) });
  };

  const salvarItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!itemEditando || !podeEditar) return;
    await executar(async () => {
      await api({ method: "PATCH", body: JSON.stringify({ action: "editar-item", itemId: itemEditando, ...formItemEditado }) });
      setItemEditando(null);
      await carregar(true);
      feedback("success", "Item corrigido", "Nome, unidade e meta foram salvos sem reduzir o que já foi reservado ou entregue.");
    });
  };

  const excluirItemSeguro = async (item: CestaItem) => {
    if (!podeExcluir || saving || !window.confirm(`Excluir o item “${item.nome}”?`)) return;
    await executar(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch(`/api/cestas?itemId=${encodeURIComponent(item.id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível excluir o item.");
      await carregar(true);
      feedback("success", "Item removido", "Nenhuma reserva foi destruída.");
    });
  };

  const adicionarResponsavel = async (event: FormEvent) => {
    event.preventDefault();
    if (!podeCriar) return;
    await executar(async () => {
      await api({ method: "POST", body: JSON.stringify({ action: "criar-responsavel", ...novoResponsavel }) });
      setNovoResponsavel({ nome: "", telefone: "" });
      await carregar(true);
      feedback("success", "Responsável adicionado", "As notificações continuam condicionadas às credenciais e ao template aprovado do WhatsApp.");
    });
  };

  const encerrarCesta = async () => {
    if (!cestaAtual || !podeEditar || saving) return;
    await executar(async () => {
      await api({ method: "PATCH", body: JSON.stringify({ action: "encerrar-campanha", cestaId: cestaAtual.id }) });
      await carregar(true);
      feedback("success", "Campanha encerrada", "As reservas históricas foram preservadas.");
    });
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando cestas...</div>;
  if (!podeLer) return <div className="p-10 text-center text-amber-200">Seu grupo não tem acesso de leitura a Cestas Básicas.</div>;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/dashboard" className="mt-1 text-gray-400 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><PackagePlus className="h-6 w-6 text-emerald-400" /> Cestas Básicas</h1>
            <p className="mt-1 text-sm text-gray-400">Planeje a meta por cesta, publique o que falta e acompanhe reservas sem perder histórico.</p>
          </div>
        </div>
        <Link href="/area-membro/cestas" target="_blank" className="flex items-center gap-1 text-xs text-ohel-blue hover:text-white"><Link2 className="h-3.5 w-3.5" /> Ver área do membro</Link>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5">
          <Card className="border-gray-800 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Plus className="h-4 w-4 text-emerald-400" /> Nova campanha</h2>
            {podeCriar ? <form onSubmit={criarCesta} className="flex flex-col gap-3">
              <Input label="Nome" value={novaCesta.nome} onChange={(event) => setNovaCesta({ ...novaCesta, nome: event.target.value })} required />
              <Input label="Quantidade de cestas" type="number" min="1" max="100000" step="1" value={novaCesta.quantidadeCestas} onChange={(event) => setNovaCesta({ ...novaCesta, quantidadeCestas: event.target.value })} required />
              <p className="text-[11px] leading-4 text-gray-500">Cada item terá uma quantidade por cesta. O total da campanha será quantidade por cesta × cestas.</p>
              <textarea placeholder="Mensagem para os membros" value={novaCesta.descricao} onChange={(event) => setNovaCesta({ ...novaCesta, descricao: event.target.value })} className="input-ohel min-h-20 w-full rounded-md px-3 py-2 text-sm" />
              <Button type="submit" disabled={saving} className="w-full">{saving ? "Criando..." : "Criar campanha"}</Button>
            </form> : <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-200">Seu grupo tem acesso de consulta, mas não de criação.</p>}
          </Card>

          {podeCriar && <Card className="border-gray-800 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Bell className="h-4 w-4 text-yellow-400" /> Responsáveis WhatsApp</h2>
            <form onSubmit={adicionarResponsavel} className="flex flex-col gap-3">
              <Input label="Nome" value={novoResponsavel.nome} onChange={(event) => setNovoResponsavel({ ...novoResponsavel, nome: event.target.value })} required />
              <Input label="WhatsApp" placeholder="(21) 99999-9999" value={novoResponsavel.telefone} onChange={(event) => setNovoResponsavel({ ...novoResponsavel, telefone: event.target.value })} required />
              <Button type="submit" variant="secondary" disabled={saving} className="w-full">Adicionar responsável</Button>
            </form>
            <div className="mt-4 flex flex-col gap-2">{responsaveis.map((responsavel) => <div key={responsavel.id} className="flex items-center justify-between gap-2 border-t border-gray-800 pt-2 text-xs"><span className="text-gray-300">{responsavel.nome}<small className="block text-gray-500">{responsavel.telefone}</small></span><Check className="h-3.5 w-3.5 text-emerald-400" /></div>)}</div>
          </Card>}
        </div>

        <Card className="border-gray-800 p-5 lg:col-span-2">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div><h2 className="text-lg font-bold text-white">Campanhas e itens</h2><p className="text-xs text-gray-500">Meta, reserva e entrega são números diferentes e permanecem explícitos.</p></div>
            <select value={cestaSelecionada} onChange={(event) => selecionarCesta(event.target.value)} className="input-ohel rounded-md px-3 py-2 text-xs">
              {cestas.length === 0 ? <option value="">Crie uma campanha</option> : cestas.map((cesta) => <option key={cesta.id} value={cesta.id}>{cesta.nome} · {cesta.status}</option>)}
            </select>
          </div>

          {cestaAtual && <>
            <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              {podeEditar ? <form onSubmit={salvarCampanha} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Input label="Nome da campanha" value={edicaoCampanha.nome} onChange={(event) => setEdicaoCampanha({ ...edicaoCampanha, nome: event.target.value })} required />
                <Input label="Mensagem" value={edicaoCampanha.descricao} onChange={(event) => setEdicaoCampanha({ ...edicaoCampanha, descricao: event.target.value })} />
                <Button type="submit" variant="secondary" disabled={saving} className="px-3"><Save className="h-4 w-4" /> Salvar</Button>
              </form> : <><p className="text-sm font-semibold text-white">{cestaAtual.nome}</p><p className="mt-1 text-xs text-gray-400">{cestaAtual.descricao || "Campanha de arrecadação"}</p></>}
              <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-emerald-500/10 pt-3">
                <form onSubmit={salvarQuantidadeCestas} className="flex flex-wrap items-end gap-2">
                  <Input label="Cestas nesta campanha" type="number" min="1" max="100000" step="1" value={quantidadeCestas} onChange={(event) => setQuantidadeCestas(event.target.value)} disabled={!podeEditar || cestaAtual.status !== "aberta"} />
                  {podeEditar && cestaAtual.status === "aberta" && <Button type="submit" variant="secondary" disabled={saving} className="px-3">Recalcular metas</Button>}
                </form>
                {cestaAtual.status === "aberta" && podeEditar && <button type="button" onClick={() => void encerrarCesta()} disabled={saving} className="text-[10px] text-yellow-400 hover:text-yellow-300">Encerrar campanha</button>}
              </div>
              <p className="mt-2 text-[11px] leading-4 text-gray-500">Alterar esta quantidade recalcula todas as metas em uma operação atômica. Itens legados precisam ser corrigidos antes; nenhuma reserva é apagada.</p>
            </div>

            {cestaAtual.status === "aberta" && podeCriar && <form onSubmit={adicionarItem} className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-[1.2fr_110px_120px_auto]">
              <div className="flex flex-col gap-2 sm:col-span-2"><Input aria-label="Item" placeholder="Ex.: Arroz" value={novoItem.nome} onChange={(event) => setNovoItem({ ...novoItem, nome: event.target.value })} required /><select aria-label="Sugestões de item" value="" onChange={(event) => { const sugestao = sugestoes.find((item) => `${item.nome}::${item.unidade}` === event.target.value); if (sugestao) setNovoItem({ ...novoItem, nome: sugestao.nome, unidade: sugestao.unidade }); }} className="input-ohel rounded-md px-3 py-2 text-xs"><option value="">Preencher por sugestão da igreja ou catálogo</option>{sugestoes.map((sugestao) => <option key={`${sugestao.nome}::${sugestao.unidade}`} value={`${sugestao.nome}::${sugestao.unidade}`}>{sugestao.nome} · {sugestao.unidade} ({sugestao.origem})</option>)}</select></div>
              <Input aria-label="Quantidade por cesta" type="number" min="1" max="100000" step="1" value={novoItem.quantidadePorCesta} onChange={(event) => setNovoItem({ ...novoItem, quantidadePorCesta: event.target.value })} required />
              <Input aria-label="Unidade" placeholder="unidade" value={novoItem.unidade} onChange={(event) => setNovoItem({ ...novoItem, unidade: event.target.value })} required />
              <Button type="submit" disabled={saving} className="px-3"><Plus className="h-4 w-4" /></Button>
              <p className="text-[11px] text-gray-500 sm:col-span-4">Meta deste item: {Number(novoItem.quantidadePorCesta) > 0 ? Number(novoItem.quantidadePorCesta) * cestaAtual.quantidade_cestas : 0} unidades na campanha ({novoItem.quantidadePorCesta || 0} por cesta × {cestaAtual.quantidade_cestas}).</p>
            </form>}

            <div className="flex flex-col gap-3">
              {itensAtuais.length === 0 ? <p className="py-8 text-center text-xs text-gray-500">Nenhum item cadastrado nesta campanha.</p> : itensAtuais.map((item) => {
                const compromissos = separarCompromissos(reservasDoItem(item.id));
                const comprometido = compromissoPorReserva(reservasDoItem(item.id));
                const porCesta = quantidadePorCestaSegura(item, cestaAtual.quantidade_cestas);
                const editando = itemEditando === item.id;
                return <div key={item.id} className="rounded-lg border border-gray-800 p-3">
                  {editando ? <form onSubmit={salvarItem} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_120px_auto]">
                    <Input aria-label="Nome do item" value={formItemEditado.nome} onChange={(event) => setFormItemEditado({ ...formItemEditado, nome: event.target.value })} required />
                    <Input aria-label="Quantidade por cesta editada" type="number" min="1" max="100000" value={formItemEditado.quantidadePorCesta} onChange={(event) => setFormItemEditado({ ...formItemEditado, quantidadePorCesta: event.target.value })} required />
                    <Input aria-label="Unidade editada" value={formItemEditado.unidade} onChange={(event) => setFormItemEditado({ ...formItemEditado, unidade: event.target.value })} required />
                    <div className="flex gap-2"><Button type="submit" disabled={saving} className="px-3"><Save className="h-4 w-4" /></Button><Button type="button" variant="secondary" disabled={saving} onClick={() => setItemEditando(null)} className="px-3">Cancelar</Button></div>
                    <p className="text-[11px] text-gray-500 sm:col-span-4">Nova meta total: {Number(formItemEditado.quantidadePorCesta) > 0 ? Number(formItemEditado.quantidadePorCesta) * cestaAtual.quantidade_cestas : 0} {formItemEditado.unidade || item.unidade}. O total não pode ficar abaixo de {comprometido} já comprometidos.</p>
                  </form> : <>
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-white">{item.nome}</p><p className="text-xs text-gray-400">Meta: {item.quantidade_necessaria} {item.unidade} no total · {porCesta === null ? <span className="text-amber-300">item legado sem rateio seguro</span> : <>{porCesta} {item.unidade} por cesta × {cestaAtual.quantidade_cestas} cestas</>}</p><p className="mt-1 text-[11px] text-gray-500">Reservado: {compromissos.reservado} · Entregue: {compromissos.entregue} · Total comprometido: {comprometido} · Falta: {Math.max(0, item.quantidade_necessaria - comprometido)}</p></div><div className="flex shrink-0 items-center gap-2">{podeEditar && <button type="button" onClick={() => iniciarEdicaoItem(item)} aria-label={`Editar ${item.nome}`} className="text-gray-500 hover:text-ohel-blue"><Pencil className="h-4 w-4" /></button>}{podeExcluir && <button type="button" onClick={() => void excluirItemSeguro(item)} aria-label={`Excluir ${item.nome}`} className="text-gray-600 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>}</div></div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-800"><div className="h-full bg-emerald-500" style={{ width: `${item.quantidade_necessaria ? Math.min(100, comprometido / item.quantidade_necessaria * 100) : 0}%` }} /></div>
                  </>}
                </div>;
              })}
            </div>
          </>}
        </Card>
      </div>

      <Card className="border-gray-800 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><ClipboardList className="h-4 w-4 text-ohel-blue" /> Reservas recebidas</h2>
        {reservas.length === 0 ? <p className="text-xs text-gray-500">Nenhuma reserva ainda.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead><tr className="border-b border-gray-800 text-gray-500"><th className="p-2">Doador</th><th className="p-2">Item</th><th className="p-2">Qtd.</th><th className="p-2">Status</th><th className="p-2">Data</th><th className="p-2">WhatsApp</th></tr></thead><tbody>{reservas.map((reserva) => <tr key={reserva.id} className="border-b border-gray-800/60"><td className="p-2 text-white">{reserva.nome_doador || "-"}</td><td className="p-2 text-gray-300">{itens.find((item) => item.id === reserva.item_id)?.nome || "-"}</td><td className="p-2 text-gray-300">{reserva.quantidade}</td><td className="p-2 text-gray-400">{reserva.status}</td><td className="p-2 text-gray-500">{new Date(reserva.reservado_em).toLocaleString("pt-BR")}</td><td className="p-2 text-gray-500">{reserva.whatsapp_responsaveis_status || "-"}</td></tr>)}</tbody></table></div>}
      </Card>
    </div>
  );
}
