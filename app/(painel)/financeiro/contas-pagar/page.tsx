"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { getMonthlyDate } from "@/lib/monthlyDate";
import { formatCurrency } from "@/lib/currency";
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

export default function ContasPagarPage() {
  const [loading, setLoading] = useState(true);
  const [contas, setContas] = useState<Conta[]>([]);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  
  // Filtros
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroFornecedor, setFiltroFornecedor] = useState("todos");
  
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  useEffect(() => {
    initPage();
  }, []);

  const initPage = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
      if (user) {
        setIgrejaId(user.igreja_id);
        fetchData(user.igreja_id);
      }
    }
  };

  const fetchData = async (id: string) => {
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
  };

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
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro na Baixa", message: error.message });
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

  // Cálculos dos KPIs
  const hoje = new Date().toISOString().split('T')[0];
  const mesAtual = hoje.slice(0, 7);

  const pendentes = contas.filter(c => c.status === 'Pendente' || c.status === 'Atrasado');
  const atrasadas = contas.filter(c => c.status === 'Atrasado');
  const pagasMes = contas.filter(c => c.status === 'Pago' && c.data_pagamento?.startsWith(mesAtual));

  const totalPendente = pendentes.reduce((acc, c) => acc + Number(c.valor), 0);
  const totalAtrasado = atrasadas.reduce((acc, c) => acc + Number(c.valor), 0);
  const totalPagoMes = pagasMes.reduce((acc, c) => acc + Number(c.valor), 0);
  const totalTitulos = contas.reduce((acc, c) => acc + Number(c.valor), 0);

  const contasFiltradas = contas.filter(c => {
    const matchBusca = c.descricao.toLowerCase().includes(busca.toLowerCase()) || 
                       (c.fornecedores?.razao_social && c.fornecedores.razao_social.toLowerCase().includes(busca.toLowerCase())) ||
                       (c.numero_documento && c.numero_documento.includes(busca));
    const matchStatus = filtroStatus === "todos" || c.status === filtroStatus;
    const matchFornecedor = filtroFornecedor === "todos" || c.fornecedor_id === filtroFornecedor;
    return matchBusca && matchStatus && matchFornecedor;
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

      {/* 4 KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-yellow-500 flex flex-col justify-between bg-ohel-surface border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Total Pendente</p>
            <Clock className="w-4 h-4 text-yellow-500" />
          </div>
          <h2 className="text-xl font-bold text-yellow-500">{formatCurrency(totalPendente)}</h2>
        </Card>
        
        <Card className="p-4 border-l-4 border-l-red-500 flex flex-col justify-between bg-ohel-surface border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Total Vencido</p>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-red-500">{formatCurrency(totalAtrasado)}</h2>
        </Card>

        <Card className="p-4 border-l-4 border-l-green-500 flex flex-col justify-between bg-ohel-surface border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <p className="text-green-400 text-[10px] font-bold uppercase tracking-wider">Pago no Mês</p>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-green-500">{formatCurrency(totalPagoMes)}</h2>
        </Card>

        <Card className="p-4 border-l-4 border-l-ohel-blue flex flex-col justify-between bg-ohel-surface border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <p className="text-ohel-blue text-[10px] font-bold uppercase tracking-wider">Total de Títulos</p>
            <FileText className="w-4 h-4 text-ohel-blue" />
          </div>
          <h2 className="text-xl font-bold text-white">{formatCurrency(totalTitulos)}</h2>
        </Card>
      </div>

      <Card className="p-3 flex flex-col lg:flex-row gap-3 items-center bg-ohel-surface/50 border-gray-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
          <input 
            type="text" 
            placeholder="Buscar por Descrição, Nº Documento ou Fornecedor..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-ohel-bg border border-gray-700 text-xs text-white rounded-md pl-9 pr-3 py-2 focus:border-ohel-blue outline-none"
          />
        </div>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="bg-ohel-bg border border-gray-700 text-xs text-white rounded-md px-3 py-2 outline-none w-full lg:w-40">
          <option value="todos">Todos os Status</option>
          <option value="Pendente">Pendentes</option>
          <option value="Pago">Pagos</option>
          <option value="Atrasado">Atrasados</option>
        </select>
        <select value={filtroFornecedor} onChange={e => setFiltroFornecedor(e.target.value)} className="bg-ohel-bg border border-gray-700 text-xs text-white rounded-md px-3 py-2 outline-none w-full lg:w-48">
          <option value="todos">Todos os Fornecedores</option>
          {fornecedores.map(f => <option key={f.id} value={f.id}>{f.razao_social}</option>)}
        </select>
      </Card>

      <Card className="p-0 overflow-hidden border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#05080f] border-b border-gray-800 text-[9px] uppercase tracking-wider text-gray-400">
              <tr>
                <th className="p-3 text-center w-10"></th>
                <th className="p-3 text-center w-12">Baixar</th>
                <th className="p-3 font-medium">Vencimento 1ª Parcela</th>
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
                <tr><td colSpan={9} className="p-8 text-center text-gray-400">Nenhuma conta encontrada.</td></tr>
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