"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { getMonthlyDate } from "@/lib/monthlyDate";
import { formatCurrency } from "@/lib/currency";
import { MESES_DO_ANO } from "@/lib/financeiro/resumoMensal";
import { ResumoContasPagar } from "@/components/financeiro/ResumoContasPagar";
import { 
  ArrowLeft, Plus, Search, Clock, AlertTriangle, CheckCircle2,
  FileText, Edit, Trash2, ChevronDown, Check, DollarSign, Layers
} from "lucide-react";
import Link from "next/link";

// Atualizamos a Interface para incluir os campos que precisamos para gerar a transação
interface Conta {
  id: string;
  descricao: string;
  fornecedor_id: string | null;
  fornecedores?: { razao_social: string };
  numero_documento: string;
  total_parcelas: number;
  recorrente: boolean;
  valor: number;
  data_vencimento: string;
  status: string;
  data_pagamento: string;
  caixa_id: string | null;
  categoria_id: string | null;
  forma_pagamento_id: string | null;
  congregacao_id: string | null;
  dia_vencimento_mensal?: number | null;
  data_emissao?: string | null;
  observacoes?: string | null;
}

interface Fornecedor {
  id: string;
  razao_social: string;
}

export default function ContasPagarPage() {
  const [loading, setLoading] = useState(true);
  const [contas, setContas] = useState<Conta[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  
  // Filtros de pesquisa e período
  const [buscaDescricao, setBuscaDescricao] = useState("");
  const [buscaDocumento, setBuscaDocumento] = useState("");
  const [buscaFornecedor, setBuscaFornecedor] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroFornecedor, setFiltroFornecedor] = useState("todos");
  const [filtroMes, setFiltroMes] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  });
  
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const fetchData = useCallback(async (id: string) => {
    setLoading(true);
    const [contasRes, fornRes] = await Promise.all([
      supabase.from('contas_pagar').select('*, fornecedores(razao_social)').eq('igreja_id', id).order('data_vencimento', { ascending: true }),
      supabase.from('fornecedores').select('id, razao_social').eq('igreja_id', id).order('razao_social')
    ]);
    
    if (contasRes.data) {
      const hoje = new Date().toISOString().split('T')[0];
      const contasAtualizadas = contasRes.data.map(c => {
        if (c.status === 'Pendente' && c.data_vencimento < hoje) {
          return { ...c, status: 'Atrasado' };
        }
        return c;
      });
      setContas(contasAtualizadas as Conta[]);
    }
    if (fornRes.data) setFornecedores(fornRes.data);
    setLoading(false);
  }, []);

  const initPage = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
      if (user) {
        setIgrejaId(user.igreja_id);
        await fetchData(user.igreja_id);
      }
    }
  }, [fetchData]);

  useEffect(() => {
    // As atualizações de estado acontecem somente após as consultas assíncronas de sessão e dados.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void initPage();
  }, [initPage]);

  // INTEGRAÇÃO AQUI: Baixa do título gera transação no financeiro
  const handleBaixarTitulo = async (conta: Conta) => {
    if (!igrejaId) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada. Entre novamente no sistema." });
      return;
    }
    if (!confirm(`Deseja marcar a conta "${conta.descricao}" como PAGA?\n\nIsso gerará automaticamente uma Despesa no Movimento Financeiro.`)) return;
    
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const mesAtual = hoje.slice(0, 7);

      // 1. Cria a transação de despesa no Movimento Financeiro
      const { error: transError } = await supabase.from('transacoes').insert([{
        igreja_id: igrejaId,
        tipo: 'Despesa',
        data: hoje,
        mes_referencia: mesAtual,
        valor: Number(conta.valor),
        caixa_id: conta.caixa_id || null,
        categoria_id: conta.categoria_id || null,
        forma_pagamento_id: conta.forma_pagamento_id || null,
        congregacao_id: conta.congregacao_id || null,
        origem_nome_manual: conta.fornecedores?.razao_social || "Fornecedor Não Informado",
        descricao: `Baixa de título: ${conta.descricao} (Doc: ${conta.numero_documento || 'S/N'})`,
        conciliado: true
      }]);

      if (transError) throw transError;

      // 2. Atualiza o status da conta a pagar para Pago
      const { error: contaError } = await supabase.from('contas_pagar').update({
        status: 'Pago',
        data_pagamento: hoje
      }).eq('id', conta.id).eq('igreja_id', igrejaId);

      if (contaError) throw contaError;

      if (conta.recorrente) {
        const dueDay = conta.dia_vencimento_mensal || Number(conta.data_vencimento.split("-")[2]);
        const nextDueDate = getMonthlyDate(conta.data_vencimento, 1, dueDay);
        const { error: recurrenceError } = await supabase.from("contas_pagar").insert([{
          igreja_id: igrejaId,
          fornecedor_id: conta.fornecedor_id,
          descricao: conta.descricao,
          numero_documento: null,
          tipo_conta: "Recorrente",
          total_parcelas: 1,
          parcela: "1/1",
          recorrente: true,
          valor: Number(conta.valor),
          data_emissao: null,
          data_vencimento: nextDueDate > hoje ? nextDueDate : getMonthlyDate(hoje, 1, dueDay),
          dia_vencimento_mensal: dueDay,
          categoria_id: conta.categoria_id,
          caixa_id: conta.caixa_id,
          forma_pagamento_id: conta.forma_pagamento_id,
          congregacao_id: conta.congregacao_id,
          observacoes: conta.observacoes || null,
          status: "Pendente",
        }]);

        if (recurrenceError) {
          await fetchData(igrejaId);
          setModal({
            isOpen: true,
            type: "error",
            title: "Conta paga; recorrência não agendada",
            message: `A baixa foi registrada, mas não foi possível criar o próximo vencimento. Cadastre o próximo mês manualmente. ${recurrenceError.message}`,
          });
          return;
        }
      }

      await fetchData(igrejaId);
      setModal({
        isOpen: true,
        type: "success",
        title: "Baixa Realizada",
        message: conta.recorrente
          ? "Conta paga. O próximo vencimento foi criado com o valor atual; ajuste o valor quando receber a próxima fatura."
          : "Título pago com sucesso! A despesa já foi lançada no Movimento.",
      });
    } catch (error: unknown) {
      setModal({ isOpen: true, type: "error", title: "Erro na Baixa", message: error instanceof Error ? error.message : "Não foi possível baixar a conta." });
    }
  };

  const handleExcluirConta = async (conta: Conta) => {
    if (!igrejaId || conta.status === "Pago") return;
    if (!confirm(`Excluir a conta "${conta.descricao}"? Esta ação não pode ser desfeita.`)) return;

    try {
      const { data, error } = await supabase
        .from("contas_pagar")
        .delete()
        .eq("id", conta.id)
        .eq("igreja_id", igrejaId)
        .neq("status", "Pago")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("A conta não foi encontrada, já foi paga ou não pode ser excluída.");
      await fetchData(igrejaId);
    } catch (error) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Não foi possível excluir",
        message: error instanceof Error ? error.message : "Erro ao excluir conta.",
      });
    }
  };

  // Cálculos da visão mensal. O filtro contém ano e mês (AAAA-MM).
  const [anoSelecionado, mesSelecionado] = filtroMes.split("-");
  const nomeMesSelecionado = MESES_DO_ANO.find(mes => mes.numero === mesSelecionado)?.nome || "Mês";
  const anosDisponiveis = Array.from(new Set([
    String(new Date().getFullYear()),
    ...contas.map(conta => conta.data_vencimento?.slice(0, 4)).filter((ano): ano is string => Boolean(ano)),
  ])).sort((a, b) => Number(b) - Number(a));
  const contasFiltradas = contas.filter(c => {
    const matchDescricao = c.descricao.toLowerCase().includes(buscaDescricao.trim().toLowerCase());
    const matchDocumento = (c.numero_documento || "").toLowerCase().includes(buscaDocumento.trim().toLowerCase());
    const matchBuscaFornecedor = (c.fornecedores?.razao_social || "").toLowerCase().includes(buscaFornecedor.trim().toLowerCase());
    const matchMes = c.data_vencimento?.startsWith(filtroMes);
    const matchStatus = filtroStatus === "todos" || c.status === filtroStatus;
    const matchFornecedor = filtroFornecedor === "todos" || c.fornecedor_id === filtroFornecedor;
    return matchMes && matchDescricao && matchDocumento && matchBuscaFornecedor && matchStatus && matchFornecedor;
  });

  const formatarData = (dataStr: string | null) => {
    if (!dataStr) return "-";
    return new Date(`${dataStr}T12:00:00`).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pago': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'Pendente': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'Atrasado': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getDateColor = (status: string) => {
    if (status === 'Pago') return 'text-green-500';
    if (status === 'Atrasado') return 'bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30';
    return 'bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/30';
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-5 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/financeiro" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-ohel-blue" /> Contas a Pagar
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Gestão de compromissos financeiros, parcelamento e liquidação de contas a pagar.</p>
          </div>
        </div>
        
        <Link href="/financeiro/contas-pagar/nova" className="w-auto px-5 py-2 text-xs bg-ohel-blue hover:bg-blue-600 text-white rounded-md flex items-center gap-2 font-medium transition-colors shadow-[0_0_15px_rgba(0,123,255,0.2)]">
          <Plus className="w-3.5 h-3.5" /> Nova Conta a Pagar
        </Link>
      </div>

      <Card className="border-gray-800 bg-ohel-surface/60 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-ohel-blue" />
          <div>
            <h2 className="text-sm font-bold text-white">Pesquisa e filtros</h2>
            <p className="text-[10px] text-gray-500">Refine os lançamentos por descrição, documento, fornecedor ou status.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="flex min-w-0 flex-col gap-1.5 text-[10px] font-semibold text-gray-400">
            Descrição
            <input type="search" placeholder="Buscar descrição" value={buscaDescricao} onChange={event => setBuscaDescricao(event.target.value)} className="w-full rounded-md border border-gray-700 bg-ohel-bg px-3 py-2 text-xs text-white outline-none focus:border-ohel-blue" />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-[10px] font-semibold text-gray-400">
            Número do documento
            <input type="search" placeholder="Buscar número" value={buscaDocumento} onChange={event => setBuscaDocumento(event.target.value)} className="w-full rounded-md border border-gray-700 bg-ohel-bg px-3 py-2 text-xs text-white outline-none focus:border-ohel-blue" />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-[10px] font-semibold text-gray-400">
            Busca por fornecedor
            <input type="search" placeholder="Digite o fornecedor" value={buscaFornecedor} onChange={event => setBuscaFornecedor(event.target.value)} className="w-full rounded-md border border-gray-700 bg-ohel-bg px-3 py-2 text-xs text-white outline-none focus:border-ohel-blue" />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-[10px] font-semibold text-gray-400">
            Status
            <select value={filtroStatus} onChange={event => setFiltroStatus(event.target.value)} className="w-full rounded-md border border-gray-700 bg-ohel-bg px-3 py-2 text-xs text-white outline-none focus:border-ohel-blue">
              <option value="todos">Todos os status</option>
              <option value="Pendente">Pendentes</option>
              <option value="Pago">Pagos</option>
              <option value="Atrasado">Atrasados</option>
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-[10px] font-semibold text-gray-400">
            Filtrar fornecedor
            <select value={filtroFornecedor} onChange={event => setFiltroFornecedor(event.target.value)} className="w-full rounded-md border border-gray-700 bg-ohel-bg px-3 py-2 text-xs text-white outline-none focus:border-ohel-blue">
              <option value="todos">Todos os fornecedores</option>
              {fornecedores.map(f => <option key={f.id} value={f.id}>{f.razao_social}</option>)}
            </select>
          </label>
        </div>
      </Card>

      <ResumoContasPagar
        contas={contas}
        periodo={filtroMes}
        anos={anosDisponiveis}
        onChangePeriodo={setFiltroMes}
        loading={loading}
      />

      <Card className="overflow-hidden border-gray-800 p-0">
        <div className="flex flex-col gap-1 border-b border-gray-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Lançamentos do período</h2>
            <p className="mt-0.5 text-[10px] text-gray-500">{mesSelecionado} — {nomeMesSelecionado} / {anoSelecionado}</p>
          </div>
          <span className="text-[10px] font-medium text-gray-400">{contasFiltradas.length} {contasFiltradas.length === 1 ? "lançamento" : "lançamentos"}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#05080f] border-b border-gray-800 text-[9px] uppercase tracking-wider text-gray-400">
              <tr>
                <th className="p-3 text-center w-10"></th>
                <th className="p-3 text-center w-12">Baixar</th>
                <th className="p-3 font-medium">Vencimento</th>
                <th className="p-3 font-medium">Descrição / Fornecedor</th>
                <th className="p-3 font-medium">Nº Documento</th>
                <th className="p-3 font-medium text-center">Parcelas</th>
                <th className="p-3 font-medium text-right">Valor Total</th>
                <th className="p-3 font-medium text-center">Status</th>
                <th className="p-3 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {loading ? (
                <tr><td colSpan={9} className="p-8 text-center text-gray-400">Carregando contas...</td></tr>
              ) : contasFiltradas.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-gray-400">Nenhuma conta encontrada para o mês e filtros selecionados.</td></tr>
              ) : (
                contasFiltradas.map((conta) => (
                  <tr key={conta.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-3 text-center text-gray-600"><ChevronDown className="w-3 h-3 inline" /></td>
                    
                    <td className="p-3 text-center">
                      {conta.status !== 'Pago' ? (
                        <button onClick={() => handleBaixarTitulo(conta)} className="w-6 h-6 rounded bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white flex items-center justify-center transition-colors mx-auto" title="Dar Baixa e Gerar Despesa">
                          <DollarSign className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <div className="w-6 h-6 rounded bg-green-500 flex items-center justify-center mx-auto text-white" title="Título Pago"><Check className="w-3.5 h-3.5"/></div>
                      )}
                    </td>

                    <td className="p-3">
                      <span className={`inline-block text-[10px] font-bold ${getDateColor(conta.status)}`}>
                        {formatarData(conta.data_vencimento)}
                      </span>
                    </td>
                    
                    <td className="p-3">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-white font-bold">{conta.descricao}</p>
                        {conta.recorrente && <span className="bg-purple-500/20 text-purple-400 text-[8px] px-1.5 py-0.5 rounded border border-purple-500/30 uppercase tracking-wider">Recorrente</span>}
                        {!conta.recorrente && conta.total_parcelas === 1 && <span className="bg-gray-500/20 text-gray-400 text-[8px] px-1.5 py-0.5 rounded border border-gray-500/30 uppercase tracking-wider">Única</span>}
                      </div>
                      <p className="text-[10px] text-gray-500 italic flex items-center gap-1">
                        <Layers className="w-2.5 h-2.5" /> {conta.fornecedores?.razao_social || "Sem fornecedor vinculado"}
                      </p>
                    </td>

                    <td className="p-3 text-gray-400">{conta.numero_documento || "-"}</td>
                    
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center gap-1 bg-ohel-blue/10 text-ohel-blue border border-ohel-blue/20 px-2 py-0.5 rounded text-[9px] font-bold">
                        {conta.total_parcelas}x
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      <p className="text-white font-bold">{formatCurrency(conta.valor)}</p>
                      {conta.status === 'Pago' && <p className="text-[9px] text-green-500">Pago: {formatCurrency(conta.valor)}</p>}
                    </td>

                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${getStatusColor(conta.status)}`}>
                        {conta.status === 'Pago' && <CheckCircle2 className="w-3 h-3" />}
                        {conta.status === 'Pendente' && <Clock className="w-3 h-3" />}
                        {conta.status === 'Atrasado' && <AlertTriangle className="w-3 h-3" />}
                        {conta.status}
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-2">
                        {conta.status !== "Pago" && (
                          <>
                            <Link href={`/financeiro/contas-pagar/editar/${conta.id}`} className="text-ohel-blue hover:text-blue-400" title="Editar conta" aria-label={`Editar ${conta.descricao}`}><Edit className="w-3.5 h-3.5" /></Link>
                            <button type="button" onClick={() => handleExcluirConta(conta)} className="text-red-500 hover:text-red-400" title="Excluir conta" aria-label={`Excluir ${conta.descricao}`}><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
