"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Edit, Landmark, Plus, Save, Search, TrendingDown, TrendingUp, Wallet, X } from "lucide-react";
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";
import { centavosParaReais } from "@/lib/financeiro/dinheiro";
import { obterPeriodoAtualSaoPaulo } from "@/lib/financeiro/resumoMensal";

interface Movimentacao {
  id: string;
  tipo: "Receita" | "Despesa" | string;
  data: string;
  mesReferencia: string;
  valorCentavos: number;
  caixaId: string | null;
  caixaNome: string | null;
  categoriaNome: string | null;
  congregacaoNome: string | null;
  origemNome: string | null;
  descricao: string | null;
}

interface ContaFinanceira {
  id: string;
  nome: string;
  tipo: string;
  saldoInicialCentavos: number;
  movimentoCentavos: number;
  saldoAtualCentavos: number;
}

interface ResumoApi {
  periodo: string;
  receitasCentavos: number;
  despesasCentavos: number;
  saldoMovimentoCentavos: number;
  saldoContasCentavos: number;
  transacoesSemConta: number;
  linhasIgnoradas: number;
  contas: ContaFinanceira[];
  contasPagarResumo: {
    previstoCentavos: number;
    pagoCentavos: number;
    emAbertoCentavos: number;
    canceladoCentavos: number;
  };
  movimentacoes: Movimentacao[];
}

function moeda(centavos: number) {
  return formatCurrency(centavosParaReais(centavos));
}

function formatarData(data: string) {
  return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR");
}

export default function MovimentoPage() {
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState<ResumoApi | null>(null);
  const [erro, setErro] = useState("");
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [mesRef, setMesRef] = useState(obterPeriodoAtualSaoPaulo);
  const [filtroTipo, setFiltroTipo] = useState("todas");
  const [filtroCaixa, setFiltroCaixa] = useState("todos");
  const [busca, setBusca] = useState("");
  const [transacaoEditando, setTransacaoEditando] = useState<Movimentacao | null>(null);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({
    isOpen: false,
    type: "success" as "success" | "error",
    title: "",
    message: "",
  });
  const [formEdicao, setFormEdicao] = useState({ data: "", descricao: "", valor: "" });

  const carregarResumo = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente para consultar o financeiro.");

      const { data: user, error: usuarioError } = await supabase
        .from("usuarios")
        .select("igreja_id")
        .eq("id", session.user.id)
        .maybeSingle();
      if (usuarioError) throw new Error("Não foi possível identificar a igreja do acesso financeiro.");
      if (!user?.igreja_id) throw new Error("Sua conta não possui uma igreja financeira autorizada.");
      setIgrejaId(user.igreja_id);

      const response = await fetch(
        `/api/financeiro/resumo?periodo=${encodeURIComponent(mesRef)}&modo=movimento`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        },
      );
      const body = (await response.json().catch(() => ({}))) as Partial<ResumoApi> & { error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar o movimento financeiro.");
      if (!Array.isArray(body.contas) || !Array.isArray(body.movimentacoes)) {
        throw new Error("O resumo financeiro retornou uma resposta incompleta.");
      }
      setResumo(body as ResumoApi);
    } catch (error) {
      setResumo(null);
      setErro(error instanceof Error ? error.message : "Não foi possível carregar o movimento financeiro.");
    } finally {
      setLoading(false);
    }
  }, [mesRef]);

  useEffect(() => {
    // A consulta é a sincronização intencional com a API server-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregarResumo();
  }, [carregarResumo]);

  const abrirEdicao = (transacao: Movimentacao) => {
    setTransacaoEditando(transacao);
    setFormEdicao({
      data: transacao.data,
      descricao: transacao.descricao || "",
      valor: formatCurrencyInput(String(transacao.valorCentavos)),
    });
  };

  const handleSalvarEdicao = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!transacaoEditando || !igrejaId) return;

    const valor = parseCurrencyInput(formEdicao.valor);
    if (!Number.isFinite(valor) || valor <= 0 || !formEdicao.data) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Dados inválidos",
        message: "Informe uma data e um valor maior que zero.",
      });
      return;
    }

    setSaving(true);
    try {
      const mesReferencia = formEdicao.data.slice(0, 7);
      const { data: mesFechado, error: erroMes } = await supabase
        .from("meses_fechados")
        .select("id")
        .eq("igreja_id", igrejaId)
        .eq("mes_referencia", mesReferencia)
        .maybeSingle();
      if (erroMes) throw new Error("Não foi possível conferir o fechamento do mês.");
      if (mesFechado) throw new Error("Não é possível alterar uma transação para um mês fechado.");

      const { data, error } = await supabase
        .from("transacoes")
        .update({
          data: formEdicao.data,
          mes_referencia: mesReferencia,
          descricao: formEdicao.descricao.trim(),
          valor,
        })
        .eq("id", transacaoEditando.id)
        .eq("igreja_id", igrejaId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error("Não foi possível salvar a transação.");
      if (!data) throw new Error("Transação não encontrada ou sem permissão para atualizar.");

      setTransacaoEditando(null);
      setModal({
        isOpen: true,
        type: "success",
        title: "Transação atualizada",
        message: "As alterações foram salvas.",
      });
      if (mesReferencia !== mesRef) setMesRef(mesReferencia);
      else await carregarResumo();
    } catch (error) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Não foi possível salvar",
        message: error instanceof Error ? error.message : "Erro ao atualizar transação.",
      });
    } finally {
      setSaving(false);
    }
  };

  const transacoes = useMemo(() => resumo?.movimentacoes || [], [resumo]);
  const transacoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return transacoes.filter((transacao) => {
      const matchTipo = filtroTipo === "todas" || transacao.tipo === filtroTipo;
      const matchCaixa = filtroCaixa === "todos" || transacao.caixaId === filtroCaixa;
      const texto = [
        transacao.descricao,
        transacao.categoriaNome,
        transacao.origemNome,
        transacao.caixaNome,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchTipo && matchCaixa && (!termo || texto.includes(termo));
    });
  }, [busca, filtroCaixa, filtroTipo, transacoes]);

  const agrupado = useMemo(
    () => transacoesFiltradas.reduce<Record<string, Movimentacao[]>>((acc, transacao) => {
      const nome = transacao.congregacaoNome || "Sem Congregação";
      (acc[nome] ||= []).push(transacao);
      return acc;
    }, {}),
    [transacoesFiltradas],
  );

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-5 pb-10">
      <FeedbackModal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        type={modal.type}
        title={modal.title}
        message={modal.message}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/financeiro" className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Movimento financeiro</h1>
            <p className="text-gray-400 text-xs mt-0.5">Receitas, despesas e saldo real das contas da igreja.</p>
          </div>
        </div>
        <Link
          href="/financeiro/movimento/novo"
          className="bg-ohel-blue hover:bg-blue-600 text-white font-medium py-2.5 px-6 rounded-md transition-all shadow-[0_0_15px_rgba(0,123,255,0.2)] flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Nova Transação
        </Link>
      </div>

      <Card className="p-4 flex flex-col md:flex-row items-center justify-between bg-ohel-surface border-gray-800 gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-lg bg-ohel-bg border border-gray-700 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-ohel-blue" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-bold">Período de referência</p>
            <input
              type="month"
              value={mesRef}
              onChange={(event) => setMesRef(event.target.value)}
              className="bg-transparent text-white font-bold text-lg outline-none cursor-pointer"
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <select
            value={filtroCaixa}
            onChange={(event) => setFiltroCaixa(event.target.value)}
            className="bg-ohel-bg border border-gray-700 text-xs text-white rounded px-3 py-2 outline-none focus:border-ohel-blue"
            aria-label="Filtrar por caixa ou conta"
          >
            <option value="todos">Todas as contas</option>
            {(resumo?.contas || []).map((conta) => <option key={conta.id} value={conta.id}>{conta.nome}</option>)}
          </select>
          <div className="relative min-w-56">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
            <input
              type="search"
              placeholder="Pesquisar movimento..."
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              className="w-full bg-ohel-bg border border-gray-700 text-xs text-white rounded pl-9 pr-3 py-2 outline-none focus:border-ohel-blue"
            />
          </div>
        </div>
      </Card>

      {erro ? (
        <Card className="border-red-500/40 bg-red-500/5 p-5">
          <p role="alert" className="text-sm font-semibold text-red-300">{erro}</p>
          <p className="mt-1 text-xs text-red-200/70">Os valores não foram substituídos por zero. Tente novamente ou procure um administrador.</p>
          <Button type="button" onClick={() => void carregarResumo()} className="mt-4 w-auto px-4 py-2 text-xs">Tentar novamente</Button>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 border-gray-800 flex justify-between items-center bg-ohel-surface">
          <div>
            <p className="text-gray-400 text-xs font-bold uppercase mb-1">Receitas do mês</p>
            <h2 className="text-3xl font-bold text-green-500">{loading || !resumo ? "—" : moeda(resumo.receitasCentavos)}</h2>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-green-500" /></div>
        </Card>
        <Card className="p-5 border-gray-800 flex justify-between items-center bg-ohel-surface">
          <div>
            <p className="text-gray-400 text-xs font-bold uppercase mb-1">Despesas do mês</p>
            <h2 className="text-3xl font-bold text-red-500">{loading || !resumo ? "—" : moeda(resumo.despesasCentavos)}</h2>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-red-500" /></div>
        </Card>
        <Card className="p-5 border-ohel-blue/50 flex justify-between items-center bg-ohel-blue/5">
          <div>
            <p className="text-ohel-blue text-xs font-bold uppercase mb-1">Saldo do movimento</p>
            <h2 className={`text-3xl font-bold ${!resumo || resumo.saldoMovimentoCentavos >= 0 ? "text-ohel-blue" : "text-red-500"}`}>
              {loading || !resumo ? "—" : moeda(resumo.saldoMovimentoCentavos)}
            </h2>
          </div>
          <div className="w-10 h-10 rounded-full bg-ohel-blue/20 flex items-center justify-center"><Wallet className="w-5 h-5 text-ohel-blue" /></div>
        </Card>
      </div>

      <Card className="p-5 border-gray-800 bg-ohel-surface">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-white"><Landmark className="w-4 h-4 text-ohel-blue" /> Saldos por caixa e conta</h2>
            <p className="text-[10px] text-gray-500 mt-1">O saldo atual considera o saldo inicial cadastrado e somente lançamentos vinculados à conta.</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase font-bold">Saldo total disponível</p>
            <p className="text-lg font-bold text-white">{loading || !resumo ? "—" : moeda(resumo.saldoContasCentavos)}</p>
          </div>
        </div>
        {loading ? <p className="py-5 text-center text-xs text-gray-500">Carregando contas...</p> : !resumo ? null : resumo.contas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-700 p-5 text-center text-xs text-gray-500">Nenhum caixa ou conta bancária cadastrado.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {resumo.contas.map((conta) => (
              <div key={conta.id} className="rounded-lg border border-gray-800 bg-ohel-bg/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">{conta.nome}</p>
                    <p className="mt-1 text-[9px] uppercase tracking-wide text-gray-500">{conta.tipo}</p>
                  </div>
                  <p className={`text-sm font-bold ${conta.saldoAtualCentavos >= 0 ? "text-green-400" : "text-red-400"}`}>{moeda(conta.saldoAtualCentavos)}</p>
                </div>
                <div className="mt-3 flex justify-between border-t border-gray-800 pt-2 text-[10px]">
                  <span className="text-gray-500">Inicial: <b className="text-gray-300">{moeda(conta.saldoInicialCentavos)}</b></span>
                  <span className="text-gray-500">Mov.: <b className={conta.movimentoCentavos >= 0 ? "text-green-300" : "text-red-300"}>{moeda(conta.movimentoCentavos)}</b></span>
                </div>
              </div>
            ))}
          </div>
        )}
        {resumo && (resumo.transacoesSemConta > 0 || resumo.linhasIgnoradas > 0) ? (
          <p className="mt-3 text-[10px] text-yellow-300/80">
            {resumo.transacoesSemConta > 0 ? `${resumo.transacoesSemConta} lançamento(s) não vinculado(s) a uma conta não altera(m) o saldo por conta.` : ""}
            {resumo.transacoesSemConta > 0 && resumo.linhasIgnoradas > 0 ? " " : ""}
            {resumo.linhasIgnoradas > 0 ? `${resumo.linhasIgnoradas} linha(s) de tipo não reconhecido foram ignoradas para evitar duplicidade.` : ""}
          </p>
        ) : null}
      </Card>

      {resumo ? (
        <Card className="p-4 border-gray-800 bg-ohel-surface/70">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div><p className="text-[10px] uppercase font-bold text-gray-500">Contas previstas no mês</p><p className="mt-1 font-bold text-white">{moeda(resumo.contasPagarResumo.previstoCentavos)}</p></div>
            <div><p className="text-[10px] uppercase font-bold text-gray-500">Contas pagas</p><p className="mt-1 font-bold text-green-400">{moeda(resumo.contasPagarResumo.pagoCentavos)}</p></div>
            <div><p className="text-[10px] uppercase font-bold text-gray-500">Contas em aberto</p><p className="mt-1 font-bold text-yellow-400">{moeda(resumo.contasPagarResumo.emAbertoCentavos)}</p></div>
          </div>
          <p className="mt-3 text-[10px] text-gray-500">Contas a pagar não entram no movimento de caixa até a baixa gerar a despesa liquidada.</p>
        </Card>
      ) : null}

      <Card className="border-gray-800 bg-ohel-surface overflow-hidden p-0">
        <div className="p-4 border-b border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-sm font-bold text-white">Extrato de transações</h3>
            <p className="text-[10px] text-gray-500 mt-1">{resumo ? `${transacoesFiltradas.length} de ${transacoes.length} lançamento(s) em ${mesRef}` : ""}</p>
          </div>
          <div className="flex bg-ohel-bg border border-gray-700 rounded p-1">
            <button onClick={() => setFiltroTipo("todas")} className={`px-3 py-1 text-xs font-bold rounded ${filtroTipo === "todas" ? "bg-ohel-blue text-white" : "text-gray-400 hover:text-white"}`}>Todas</button>
            <button onClick={() => setFiltroTipo("Receita")} className={`px-3 py-1 text-xs font-bold rounded ${filtroTipo === "Receita" ? "bg-green-500 text-white" : "text-gray-400 hover:text-white"}`}>Receitas</button>
            <button onClick={() => setFiltroTipo("Despesa")} className={`px-3 py-1 text-xs font-bold rounded ${filtroTipo === "Despesa" ? "bg-red-500 text-white" : "text-gray-400 hover:text-white"}`}>Despesas</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? <div className="p-10 text-center text-gray-400">Carregando extrato...</div> : erro ? null : Object.keys(agrupado).length === 0 ? (
            <div className="p-10 text-center text-gray-400">Nenhuma transação encontrada neste mês e filtros.</div>
          ) : Object.entries(agrupado).map(([congregacaoNome, items]) => (
            <div key={congregacaoNome} className="mb-4">
              <div className="bg-ohel-bg/50 px-4 py-2 border-y border-gray-800 flex justify-between items-center sticky top-0">
                <p className="text-xs font-bold text-ohel-blue flex items-center gap-2"><Wallet className="w-3.5 h-3.5" /> {congregacaoNome}</p>
                <div className="flex gap-4 text-[10px] font-bold">
                  <span className="text-green-400">Rec: {moeda(items.filter((item) => item.tipo === "Receita").reduce((total, item) => total + item.valorCentavos, 0))}</span>
                  <span className="text-red-400">Desp: {moeda(items.filter((item) => item.tipo === "Despesa").reduce((total, item) => total + item.valorCentavos, 0))}</span>
                </div>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-ohel-surface text-[10px] text-gray-500 uppercase border-b border-gray-800/50">
                  <tr>
                    <th className="p-3">Ações</th><th className="p-3">Data</th><th className="p-3">Conta</th><th className="p-3">Categoria / Descrição</th><th className="p-3">Origem</th><th className="p-3 text-right text-green-500">Receita</th><th className="p-3 text-right text-red-500">Despesa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/30">
                  {items.map((transacao) => (
                    <tr key={transacao.id} className="hover:bg-white/[0.02]">
                      <td className="p-3"><button type="button" onClick={() => abrirEdicao(transacao)} className="text-gray-500 hover:text-ohel-blue" title="Editar transação" aria-label={`Editar ${transacao.descricao || "transação"}`}><Edit className="w-4 h-4" /></button></td>
                      <td className="p-3 text-gray-400">{formatarData(transacao.data)}</td>
                      <td className="p-3 text-gray-300">{transacao.caixaNome || "Sem conta"}</td>
                      <td className="p-3"><p className="text-white font-bold">{transacao.categoriaNome || "Sem categoria"}</p><p className="text-gray-500 text-[10px]">{transacao.descricao || "-"}</p></td>
                      <td className="p-3 text-gray-300">{transacao.origemNome || "-"}</td>
                      <td className="p-3 text-right text-green-400 font-medium">{transacao.tipo === "Receita" ? moeda(transacao.valorCentavos) : "-"}</td>
                      <td className="p-3 text-right text-red-400 font-medium">{transacao.tipo === "Despesa" ? moeda(transacao.valorCentavos) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </Card>

      {transacaoEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-800 bg-ohel-surface p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-sm font-bold text-white">Editar transação</h2>
              <button type="button" onClick={() => setTransacaoEditando(null)} className="text-gray-500 hover:text-white" aria-label="Fechar"><X className="h-4 w-4" /></button>
            </div>
            <p className="mb-4 text-xs text-gray-400">Tipo: {transacaoEditando.tipo}. A conta, categoria e vínculos permanecem iguais.</p>
            <form onSubmit={handleSalvarEdicao} className="flex flex-col gap-4">
              <Input label="Data *" type="date" value={formEdicao.data} onChange={(event) => setFormEdicao((current) => ({ ...current, data: event.target.value }))} required />
              <Input label="Descrição" value={formEdicao.descricao} onChange={(event) => setFormEdicao((current) => ({ ...current, descricao: event.target.value }))} />
              <CurrencyInput label="Valor (R$) *" name="valor" value={formEdicao.valor} onChange={(valor) => setFormEdicao((current) => ({ ...current, valor }))} required />
              <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setTransacaoEditando(null)} className="w-auto">Cancelar</Button><Button type="submit" disabled={saving} className="w-auto">{saving ? "Salvando..." : <><Save className="h-4 w-4" /> Salvar</>}</Button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
