"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileUp,
  Landmark,
  Loader2,
  Settings2,
  Wallet,
} from "lucide-react";

type Transacao = {
  id: string;
  descricao: string | null;
  data: string;
  tipo: "Receita" | "Despesa";
  valor: number | string;
};

type ContaPagar = {
  id: string;
  descricao: string | null;
  data_vencimento: string;
  status: string;
  valor: number | string;
};

type Caixa = {
  id: string;
  nome: string;
  tipo: string | null;
  saldo_inicial: number | string | null;
};

const monthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(`${value}T12:00:00`),
  );

export default function FinanceiroPage() {
  const [month, setMonth] = useState(monthValue);
  const [transactions, setTransactions] = useState<Transacao[]>([]);
  const [bills, setBills] = useState<ContaPagar[]>([]);
  const [cashAccounts, setCashAccounts] = useState<Caixa[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) throw new Error("Sua sessão expirou. Entre novamente.");

        const { data: user, error: userError } = await supabase
          .from("usuarios")
          .select("igreja_id")
          .eq("id", authData.user.id)
          .single();
        if (userError) throw userError;
        if (!user?.igreja_id) throw new Error("Não foi possível identificar a igreja do usuário.");
        if (cancelled) return;

        const [{ data: txData, error: txError }, { data: billsData, error: billsError }, { data: cashData, error: cashError }] =
          await Promise.all([
            supabase
              .from("transacoes")
              .select("id, descricao, data, tipo, valor")
              .eq("igreja_id", user.igreja_id)
              .eq("mes_referencia", month)
              .order("data", { ascending: false }),
            supabase
              .from("contas_pagar")
              .select("id, descricao, data_vencimento, status, valor")
              .eq("igreja_id", user.igreja_id)
              .neq("status", "Pago")
              .order("data_vencimento", { ascending: true })
              .limit(8),
            supabase
              .from("caixas")
              .select("id, nome, tipo, saldo_inicial")
              .eq("igreja_id", user.igreja_id)
              .order("nome"),
          ]);
        if (txError) throw txError;
        if (billsError) throw billsError;
        if (cashError) throw cashError;
        if (cancelled) return;

        setTransactions((txData ?? []) as Transacao[]);
        setBills((billsData ?? []) as ContaPagar[]);
        setCashAccounts((cashData ?? []) as Caixa[]);
      } catch (error) {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar o financeiro.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [month]);

  const totals = useMemo(
    () =>
      transactions.reduce(
        (result, transaction) => {
          const value = Number(transaction.valor) || 0;
          if (transaction.tipo === "Receita") result.income += value;
          if (transaction.tipo === "Despesa") result.expenses += value;
          return result;
        },
        { income: 0, expenses: 0 },
      ),
    [transactions],
  );

  const weeklyTotals = useMemo(() => {
    const weeks = [0, 0, 0, 0, 0];
    for (const transaction of transactions) {
      const day = Number(transaction.data.slice(8, 10));
      const index = Math.min(Math.floor((day - 1) / 7), 4);
      weeks[index] += (transaction.tipo === "Receita" ? 1 : -1) * (Number(transaction.valor) || 0);
    }
    const max = Math.max(...weeks.map(Math.abs), 1);
    return weeks.map((value) => ({ value, height: Math.max((Math.abs(value) / max) * 100, 3) }));
  }, [transactions]);

  const unpaidTotal = bills.reduce((sum, bill) => sum + (Number(bill.valor) || 0), 0);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(new Date(`${month}-15T12:00:00`));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 pb-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Financeiro</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">Painel financeiro</h1>
          <p className="mt-1 text-sm text-gray-400">Acompanhe o movimento e as obrigações da igreja.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-gray-300">
            <CalendarDays className="h-4 w-4 text-gray-500" />
            <input
              aria-label="Mês de referência"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="bg-transparent text-sm text-white outline-none [color-scheme:dark]"
            />
          </label>
          <Link href="/financeiro/movimento/novo" className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-black transition hover:bg-emerald-400">
            <ArrowUpRight className="h-4 w-4" /> Lançar movimento
          </Link>
          <Link href="/financeiro/movimento/importar" className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-700 px-3 text-sm font-semibold text-gray-300 transition hover:border-gray-500 hover:text-white">
            <FileUp className="h-4 w-4" /> Importar OFX
          </Link>
        </div>
      </header>

      {errorMessage && (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo do mês">
        <Card className="border-gray-800 bg-gray-900/70 p-5">
          <div className="flex items-center justify-between text-gray-400"><span className="text-sm">Receitas</span><span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400"><ArrowDownRight className="h-4 w-4" /></span></div>
          <p className="mt-4 text-2xl font-bold text-white">{loading ? "—" : formatCurrency(totals.income)}</p>
          <p className="mt-1 text-xs text-gray-500">Entradas em {monthLabel}</p>
        </Card>
        <Card className="border-gray-800 bg-gray-900/70 p-5">
          <div className="flex items-center justify-between text-gray-400"><span className="text-sm">Despesas</span><span className="rounded-lg bg-rose-500/10 p-2 text-rose-400"><ArrowUpRight className="h-4 w-4" /></span></div>
          <p className="mt-4 text-2xl font-bold text-white">{loading ? "—" : formatCurrency(totals.expenses)}</p>
          <p className="mt-1 text-xs text-gray-500">Saídas em {monthLabel}</p>
        </Card>
        <Card className="border-gray-800 bg-gray-900/70 p-5">
          <div className="flex items-center justify-between text-gray-400"><span className="text-sm">Resultado do mês</span><span className="rounded-lg bg-sky-500/10 p-2 text-sky-400"><CircleDollarSign className="h-4 w-4" /></span></div>
          <p className={`mt-4 text-2xl font-bold ${totals.income - totals.expenses >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{loading ? "—" : formatCurrency(totals.income - totals.expenses)}</p>
          <p className="mt-1 text-xs text-gray-500">Receitas menos despesas lançadas</p>
        </Card>
        <Card className="border-gray-800 bg-gray-900/70 p-5">
          <div className="flex items-center justify-between text-gray-400"><span className="text-sm">Próximas contas a pagar</span><span className="rounded-lg bg-amber-500/10 p-2 text-amber-300"><Clock3 className="h-4 w-4" /></span></div>
          <p className="mt-4 text-2xl font-bold text-white">{loading ? "—" : formatCurrency(unpaidTotal)}</p>
          <p className="mt-1 text-xs text-gray-500">Soma das {bills.length} próximas contas</p>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border-gray-800 bg-gray-900/70 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="font-semibold text-white">Movimentação do mês</h2><p className="mt-1 text-xs text-gray-500">Saldo líquido por semana de competência</p></div>
            <BarChart3 className="h-5 w-5 text-gray-500" />
          </div>
          <div className="mt-7 flex h-40 items-end gap-3 border-b border-gray-800 pb-3">
            {weeklyTotals.map((week, index) => (
              <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className={`text-[10px] ${week.value < 0 ? "text-rose-300" : "text-gray-500"}`}>
                  {loading ? "" : formatCurrency(week.value).replace(",00", "")}
                </span>
                <div className="flex h-24 w-full items-end justify-center">
                  <div className={`w-full max-w-12 rounded-t-md ${week.value < 0 ? "bg-rose-500/70" : "bg-emerald-500/70"}`} style={{ height: `${loading ? 3 : week.height}%` }} />
                </div>
                <span className="text-[10px] text-gray-500">Sem. {index + 1}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-500">
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" />Saldo positivo</span>
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-400" />Saldo negativo</span>
            <span className="ml-auto">{transactions.length} lançamentos</span>
          </div>
        </Card>

        <Card className="border-gray-800 bg-gray-900/70 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="font-semibold text-white">Caixas e contas</h2><p className="mt-1 text-xs text-gray-500">Cadastros financeiros disponíveis</p></div>
            <Landmark className="h-5 w-5 text-gray-500" />
          </div>
          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>
            ) : cashAccounts.length ? cashAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-3">
                <div className="flex items-center gap-3"><span className="rounded-md bg-gray-800 p-2 text-gray-400"><Wallet className="h-4 w-4" /></span><div><p className="text-sm font-medium text-gray-200">{account.nome}</p><p className="text-xs text-gray-500">{account.tipo || "Caixa"}</p></div></div>
                <span className="text-xs text-gray-500">Saldo inicial {formatCurrency(Number(account.saldo_inicial) || 0)}</span>
              </div>
            )) : <p className="py-6 text-center text-sm text-gray-500">Nenhum caixa cadastrado.</p>}
          </div>
          <Link href="/financeiro/caixas" className="mt-4 flex items-center justify-between border-t border-gray-800 pt-4 text-sm font-medium text-emerald-300 hover:text-emerald-200">
            Gerenciar caixas <ChevronRight className="h-4 w-4" />
          </Link>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border-gray-800 bg-gray-900/70 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="font-semibold text-white">Últimos movimentos</h2><p className="mt-1 text-xs text-gray-500">Transações de {monthLabel}</p></div>
            <Link href="/financeiro/movimento" className="text-xs font-semibold text-emerald-300 hover:text-emerald-200">Ver todas</Link>
          </div>
          <div className="divide-y divide-gray-800">
            {loading ? <p className="py-7 text-center text-sm text-gray-500">Carregando movimentos…</p> : transactions.slice(0, 6).map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-gray-200">{transaction.descricao || "Movimento sem descrição"}</p><p className="mt-1 text-xs text-gray-500">{formatDate(transaction.data)}</p></div>
                <span className={`shrink-0 text-sm font-semibold ${transaction.tipo === "Receita" ? "text-emerald-300" : "text-rose-300"}`}>{transaction.tipo === "Receita" ? "+" : "−"} {formatCurrency(Number(transaction.valor) || 0)}</span>
              </div>
            ))}
            {!loading && transactions.length === 0 && <p className="py-7 text-center text-sm text-gray-500">Nenhum movimento lançado neste mês.</p>}
          </div>
        </Card>

        <Card className="border-gray-800 bg-gray-900/70 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Contas a pagar</h2><p className="mt-1 text-xs text-gray-500">Próximas contas pendentes</p></div><Link href="/financeiro/contas-pagar" className="text-xs font-semibold text-emerald-300 hover:text-emerald-200">Ver todas</Link></div>
          <div className="space-y-3">
            {loading ? <p className="py-7 text-center text-sm text-gray-500">Carregando contas…</p> : bills.slice(0, 5).map((bill) => (
              <div key={bill.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-gray-200">{bill.descricao || "Conta a pagar"}</p><p className="mt-1 text-xs text-gray-500">Vence em {formatDate(bill.data_vencimento)}</p></div>
                <span className="shrink-0 text-sm font-semibold text-amber-200">{formatCurrency(Number(bill.valor) || 0)}</span>
              </div>
            ))}
            {!loading && bills.length === 0 && <p className="py-7 text-center text-sm text-gray-500">Nenhuma conta em aberto.</p>}
          </div>
        </Card>
      </section>

      <section>
        <Card className="flex flex-col justify-center border-gray-800 bg-gray-900/70 p-5 sm:px-6">
          <div className="flex items-center gap-3"><span className="rounded-lg bg-gray-800 p-2 text-gray-300"><Settings2 className="h-5 w-5" /></span><div><h2 className="font-semibold text-white">Cadastros financeiros</h2><p className="text-xs text-gray-500">Acesso rápido às tabelas mestras</p></div></div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/configuracoes/cadastros-financeiros" className="rounded-md border border-gray-800 px-3 py-2 text-xs font-medium text-gray-300 hover:border-emerald-500/40 hover:text-emerald-200">Categorias e formas</Link>
            <Link href="/financeiro/caixas" className="rounded-md border border-gray-800 px-3 py-2 text-xs font-medium text-gray-300 hover:border-emerald-500/40 hover:text-emerald-200">Caixas</Link>
            <Link href="/financeiro/fornecedores" className="rounded-md border border-gray-800 px-3 py-2 text-xs font-medium text-gray-300 hover:border-emerald-500/40 hover:text-emerald-200">Fornecedores</Link>
          </div>
        </Card>
      </section>
    </div>
  );
}
