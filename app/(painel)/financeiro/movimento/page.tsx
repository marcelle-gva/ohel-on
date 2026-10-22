"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Plus, TrendingUp, TrendingDown, Wallet, Search, Edit, ArrowRightLeft } from "lucide-react";

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
            <h2 className="text-3xl font-bold text-green-500">R$ {totalReceitas.toFixed(2).replace('.', ',')}</h2>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-green-500" /></div>
        </Card>
        <Card className="p-5 border-gray-800 flex justify-between items-center bg-ohel-surface">
          <div>
            <p className="text-gray-400 text-xs font-bold uppercase mb-1">Despesas</p>
            <h2 className="text-3xl font-bold text-red-500">R$ {totalDespesas.toFixed(2).replace('.', ',')}</h2>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-red-500" /></div>
        </Card>
        <Card className="p-5 border-ohel-blue/50 flex justify-between items-center bg-ohel-blue/5">
          <div>
            <p className="text-ohel-blue text-xs font-bold uppercase mb-1">Saldo Acumulado</p>
            <h2 className={`text-3xl font-bold ${saldo >= 0 ? 'text-ohel-blue' : 'text-red-500'}`}>R$ {saldo.toFixed(2).replace('.', ',')}</h2>
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
                        Rec: R$ {itemsArray.filter((i: Transacao) => i.tipo === 'Receita').reduce((a: number, b: Transacao) => a + Number(b.valor), 0).toFixed(2)}
                      </span>
                      <span className="text-red-400">
                        Desp: R$ {itemsArray.filter((i: Transacao) => i.tipo === 'Despesa').reduce((a: number, b: Transacao) => a + Number(b.valor), 0).toFixed(2)}
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
                          <td className="p-3"><button className="text-gray-500 hover:text-ohel-blue"><Edit className="w-4 h-4"/></button></td>
                          <td className="p-3 text-gray-400">{new Date(`${t.data}T12:00:00`).toLocaleDateString('pt-BR')}</td>
                          <td className="p-3">
                            <p className="text-white font-bold">{t.categorias_financeiras?.nome}</p>
                            <p className="text-gray-500 text-[10px]">{t.descricao || '-'}</p>
                          </td>
                          <td className="p-3 text-gray-300">{t.membros?.nome || t.origem_nome_manual || '-'}</td>
                          <td className="p-3 text-right text-green-400 font-medium">{t.tipo === 'Receita' ? `R$ ${Number(t.valor).toFixed(2)}` : '-'}</td>
                          <td className="p-3 text-right text-red-400 font-medium">{t.tipo === 'Despesa' ? `R$ ${Number(t.valor).toFixed(2)}` : '-'}</td>
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
    </div>
  );
}