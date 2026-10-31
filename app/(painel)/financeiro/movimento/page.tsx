"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Plus, TrendingUp, TrendingDown, Wallet, Search, Edit, ArrowRightLeft, X, Save } from "lucide-react";
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";

// DEFININDO OS TIPOS PARA O TYPESCRIPT NÃO RECLAMAR
interface Transacao {
  id: string;
  tipo: 'Receita' | 'Despesa';
  valor: number;
  data: string;
  descricao?: string;
  origem_nome_manual?: string;
  congregacoes?: { nome: string };
  categorias_financeiras?: { nome: string };
  membros?: { nome: string };
}

export default function MovimentoPage() {
  const [loading, setLoading] = useState(true);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [congregacoes, setCongregacoes] = useState<any[]>([]);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [transacaoEditando, setTransacaoEditando] = useState<Transacao | null>(null);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });
  const [formEdicao, setFormEdicao] = useState({ data: "", descricao: "", valor: "" });
  
  const dataAtual = new Date();
  const [mesRef, setMesRef] = useState(`${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`);
  const [filtroTipo, setFiltroTipo] = useState("todas");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    fetchData();
  }, [mesRef]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
      if (!user) return;
      setIgrejaId(user.igreja_id);

      const [transRes, congRes] = await Promise.all([
        supabase.from('transacoes')
          .select('*, categorias_financeiras(nome), caixas(nome), membros(nome), congregacoes(nome)')
          .eq('igreja_id', user.igreja_id)
          .eq('mes_referencia', mesRef)
          .order('data', { ascending: false }),
        supabase.from('congregacoes').select('*').eq('igreja_id', user.igreja_id)
      ]);

      if (transRes.data) setTransacoes(transRes.data as Transacao[]);
      if (congRes.data) setCongregacoes(congRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const abrirEdicao = (transacao: Transacao) => {
    setTransacaoEditando(transacao);
    setFormEdicao({
      data: transacao.data,
      descricao: transacao.descricao || "",
      valor: formatCurrencyInput(String(Math.round(Number(transacao.valor) * 100))),
    });
  };

  const handleSalvarEdicao = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!transacaoEditando || !igrejaId) return;

    const valor = parseCurrencyInput(formEdicao.valor);
    if (!Number.isFinite(valor) || valor <= 0 || !formEdicao.data) {
      setModal({ isOpen: true, type: "error", title: "Dados inválidos", message: "Informe uma data e um valor maior que zero." });
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
      if (erroMes) throw erroMes;
      if (mesFechado) throw new Error("Não é possível alterar uma transação para um mês fechado.");

      const { data, error } = await supabase.from("transacoes").update({
        data: formEdicao.data,
        mes_referencia: mesReferencia,
        descricao: formEdicao.descricao.trim(),
        valor,
      }).eq("id", transacaoEditando.id).eq("igreja_id", igrejaId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Transação não encontrada ou sem permissão para atualizar.");

      setTransacaoEditando(null);
      if (mesReferencia === mesRef) {
        await fetchData();
      } else {
        setMesRef(mesReferencia);
      }
      setModal({ isOpen: true, type: "success", title: "Transação atualizada", message: "As alterações foram salvas." });
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

  // Cálculos dos KPIs
  const totalReceitas = transacoes.filter(t => t.tipo === 'Receita').reduce((acc, t) => acc + Number(t.valor), 0);
  const totalDespesas = transacoes.filter(t => t.tipo === 'Despesa').reduce((acc, t) => acc + Number(t.valor), 0);
  const saldo = totalReceitas - totalDespesas;

  // Filtragem
  const transFiltradas = transacoes.filter(t => {
    const matchTipo = filtroTipo === "todas" || t.tipo === filtroTipo;
    const matchBusca = (t.descricao && t.descricao.toLowerCase().includes(busca.toLowerCase())) || 
                       (t.categorias_financeiras?.nome && t.categorias_financeiras.nome.toLowerCase().includes(busca.toLowerCase()));
    return matchTipo && matchBusca;
  });

  // Agrupamento por Congregação (TIPADO CORRETAMENTE)
  const agrupado = transFiltradas.reduce((acc: Record<string, Transacao[]>, t: Transacao) => {
    const congNome = t.congregacoes?.nome || "Sem Congregação";
    if (!acc[congNome]) acc[congNome] = [];
    acc[congNome].push(t);
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-5 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Financeiro</h1>
          <p className="text-gray-400 text-xs mt-0.5">Gestão de dízimos, ofertas, contas a pagar e conciliação.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/financeiro/movimento/novo" className="bg-ohel-blue hover:bg-blue-600 text-white font-medium py-2.5 px-6 rounded-md transition-all shadow-[0_0_15px_rgba(0,123,255,0.2)] flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Transação
          </Link>
        </div>
      </div>

      {/* Filtro de Período */}
      <Card className="p-4 flex flex-col md:flex-row items-center justify-between bg-ohel-surface border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-ohel-bg border border-gray-700 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5 text-ohel-blue" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-bold">Período de Referência</p>
            <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} className="bg-transparent text-white font-bold text-lg outline-none cursor-pointer" />
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 border-gray-800 flex justify-between items-center bg-ohel-surface">
          <div>
            <p className="text-gray-400 text-xs font-bold uppercase mb-1">Receitas</p>
            <h2 className="text-3xl font-bold text-green-500">{formatCurrency(totalReceitas)}</h2>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-green-500" /></div>
        </Card>
        <Card className="p-5 border-gray-800 flex justify-between items-center bg-ohel-surface">
          <div>
            <p className="text-gray-400 text-xs font-bold uppercase mb-1">Despesas</p>
            <h2 className="text-3xl font-bold text-red-500">{formatCurrency(totalDespesas)}</h2>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-red-500" /></div>
        </Card>
        <Card className="p-5 border-ohel-blue/50 flex justify-between items-center bg-ohel-blue/5">
          <div>
            <p className="text-ohel-blue text-xs font-bold uppercase mb-1">Saldo Acumulado</p>
            <h2 className={`text-3xl font-bold ${saldo >= 0 ? 'text-ohel-blue' : 'text-red-500'}`}>{formatCurrency(saldo)}</h2>
          </div>
          <div className="w-10 h-10 rounded-full bg-ohel-blue/20 flex items-center justify-center"><Wallet className="w-5 h-5 text-ohel-blue" /></div>
        </Card>
      </div>

      {/* Extrato */}
      <Card className="border-gray-800 bg-ohel-surface overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="text-sm font-bold text-white">Extrato de Transações</h3>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
              <input type="text" placeholder="Pesquisar por descrição..." value={busca} onChange={e => setBusca(e.target.value)} className="w-full bg-ohel-bg border border-gray-700 text-xs text-white rounded pl-9 pr-3 py-2 outline-none focus:border-ohel-blue" />
            </div>
            <div className="flex bg-ohel-bg border border-gray-700 rounded p-1">
              <button onClick={() => setFiltroTipo("todas")} className={`px-3 py-1 text-xs font-bold rounded ${filtroTipo === 'todas' ? 'bg-ohel-blue text-white' : 'text-gray-400 hover:text-white'}`}>Todas</button>
              <button onClick={() => setFiltroTipo("Receita")} className={`px-3 py-1 text-xs font-bold rounded ${filtroTipo === 'Receita' ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'}`}>Receitas</button>
              <button onClick={() => setFiltroTipo("Despesa")} className={`px-3 py-1 text-xs font-bold rounded ${filtroTipo === 'Despesa' ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-white'}`}>Despesas</button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center text-gray-400">Carregando extrato...</div>
          ) : Object.keys(agrupado).length === 0 ? (
            <div className="p-10 text-center text-gray-400">Nenhuma transação encontrada neste mês.</div>
          ) : (
            Object.entries(agrupado).map(([congNome, items]) => {
              // TIPAGEM EXPLÍCITA AQUI TAMBÉM
              const itemsArray = items as Transacao[];
              return (
                <div key={congNome} className="mb-4">
                  <div className="bg-ohel-bg/50 px-4 py-2 border-y border-gray-800 flex justify-between items-center sticky top-0">
                    <p className="text-xs font-bold text-ohel-blue flex items-center gap-2"><Wallet className="w-3.5 h-3.5"/> {congNome}</p>
                    <div className="flex gap-4 text-[10px] font-bold">
                      <span className="text-green-400">
                        Rec: {formatCurrency(itemsArray.filter((i: Transacao) => i.tipo === 'Receita').reduce((a: number, b: Transacao) => a + Number(b.valor), 0))}
                      </span>
                      <span className="text-red-400">
                        Desp: {formatCurrency(itemsArray.filter((i: Transacao) => i.tipo === 'Despesa').reduce((a: number, b: Transacao) => a + Number(b.valor), 0))}
                      </span>
                    </div>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-ohel-surface text-[10px] text-gray-500 uppercase border-b border-gray-800/50">
                      <tr>
                        <th className="p-3">Ações</th>
                        <th className="p-3">Data</th>
                        <th className="p-3">Categoria / Descrição</th>
                        <th className="p-3">Membro / Origem</th>
                        <th className="p-3 text-right text-green-500">Receita</th>
                        <th className="p-3 text-right text-red-500">Despesa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/30">
                      {itemsArray.map((t: Transacao) => (
                        <tr key={t.id} className="hover:bg-white/[0.02]">
                          <td className="p-3"><button type="button" onClick={() => abrirEdicao(t)} className="text-gray-500 hover:text-ohel-blue" title="Editar transação" aria-label={`Editar ${t.descricao || "transação"}`}><Edit className="w-4 h-4"/></button></td>
                          <td className="p-3 text-gray-400">{new Date(`${t.data}T12:00:00`).toLocaleDateString('pt-BR')}</td>
                          <td className="p-3">
                            <p className="text-white font-bold">{t.categorias_financeiras?.nome}</p>
                            <p className="text-gray-500 text-[10px]">{t.descricao || '-'}</p>
                          </td>
                          <td className="p-3 text-gray-300">{t.membros?.nome || t.origem_nome_manual || '-'}</td>
                          <td className="p-3 text-right text-green-400 font-medium">{t.tipo === 'Receita' ? formatCurrency(t.valor) : '-'}</td>
                          <td className="p-3 text-right text-red-400 font-medium">{t.tipo === 'Despesa' ? formatCurrency(t.valor) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {transacaoEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-800 bg-ohel-surface p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-sm font-bold text-white">Editar transação</h2>
              <button type="button" onClick={() => setTransacaoEditando(null)} className="text-gray-500 hover:text-white" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-xs text-gray-400">Tipo: {transacaoEditando.tipo}. A categoria, o caixa e os vínculos permanecem iguais.</p>
            <form onSubmit={handleSalvarEdicao} className="flex flex-col gap-4">
              <Input label="Data *" type="date" value={formEdicao.data} onChange={(event) => setFormEdicao((current) => ({ ...current, data: event.target.value }))} required />
              <Input label="Descrição" value={formEdicao.descricao} onChange={(event) => setFormEdicao((current) => ({ ...current, descricao: event.target.value }))} />
              <CurrencyInput label="Valor (R$) *" name="valor" value={formEdicao.valor} onChange={(valor) => setFormEdicao((current) => ({ ...current, valor }))} required />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setTransacaoEditando(null)} className="w-auto">Cancelar</Button>
                <Button type="submit" disabled={saving} className="w-auto">{saving ? "Salvando..." : <><Save className="h-4 w-4" /> Salvar</>}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}