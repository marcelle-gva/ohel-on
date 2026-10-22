"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Users, UserPlus, HeartHandshake, Church, DollarSign, CalendarDays, CheckSquare, Bell, MonitorPlay, ArrowRight } from "lucide-react";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [nomeUsuario, setNomeUsuario] = useState("Líder");
  
  // KPIs Secretaria
  const [totalMembros, setTotalMembros] = useState(0);
  const [totalCongregados, setTotalCongregados] = useState(0);
  const [totalVisitantes, setTotalVisitantes] = useState(0);
  const [totalCongregacoes, setTotalCongregacoes] = useState(0);
  
  // KPIs Financeiros e Operacionais
  const [saldoFinanceiro, setSaldoFinanceiro] = useState(0);
  const [pedidosOracao, setPedidosOracao] = useState(0);
  const [aniversariantes, setAniversariantes] = useState(0);
  const [preCadastros, setPreCadastros] = useState(0);
  const [totalAvisos, setTotalAvisos] = useState(0);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: userData } = await supabase.from("usuarios").select("nome").eq("id", session.user.id).maybeSingle();
        if (userData?.nome) setNomeUsuario(userData.nome.split(" ")[0]);

        const hoje = new Date();
        const mesRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        const diaHoje = hoje.getDate();
        const mesHoje = hoje.getMonth() + 1;

        // Executando todas as consultas em paralelo para performance
        const [
          membrosRes, congregadosRes, visitantesRes, congregacoesRes,
          transacoesRes, oracoesRes, preCadastrosRes, muralRes, membrosNascRes
        ] = await Promise.all([
          supabase.from("membros").select("*", { count: "exact", head: true }),
          supabase.from("congregados").select("*", { count: "exact", head: true }),
          supabase.from("visitantes").select("*", { count: "exact", head: true }),
          supabase.from("congregacoes").select("*", { count: "exact", head: true }),
          
          // Transações do mês atual para calcular saldo
          supabase.from("transacoes").select("tipo, valor").eq("mes_referencia", mesRef),
          
          // Orações pendentes
          supabase.from("pedidos_oracao").select("*", { count: "exact", head: true }).in('status', ['Pendente', 'Em Oração']),
          
          // Pré-cadastros pendentes
          supabase.from("membros").select("*", { count: "exact", head: true }).eq("status", "Pré-Cadastro"),
          
          // Avisos no mural
          supabase.from("comunicacoes").select("*", { count: "exact", head: true }),
          
          // Buscar todas as datas de nascimento para filtrar no JS (mais leve que RPC)
          supabase.from("membros").select("data_nascimento").eq("status", "Ativo")
        ]);

        setTotalMembros(membrosRes.count || 0);
        setTotalCongregados(congregadosRes.count || 0);
        setTotalVisitantes(visitantesRes.count || 0);
        setTotalCongregacoes(congregacoesRes.count || 0);
        
        setPedidosOracao(oracoesRes.count || 0);
        setPreCadastros(preCadastrosRes.count || 0);
        setTotalAvisos(muralRes.count || 0);

        // Cálculo do Saldo Financeiro
        if (transacoesRes.data) {
          const receitas = transacoesRes.data.filter(t => t.tipo === 'Receita').reduce((acc, t) => acc + Number(t.valor), 0);
          const despesas = transacoesRes.data.filter(t => t.tipo === 'Despesa').reduce((acc, t) => acc + Number(t.valor), 0);
          setSaldoFinanceiro(receitas - despesas);
        }

        // Cálculo de Aniversariantes
        if (membrosNascRes.data) {
          const aniversariantesCount = membrosNascRes.data.filter(m => {
            if (!m.data_nascimento) return false;
            const data = new Date(`${m.data_nascimento}T12:00:00`);
            return data.getDate() === diaHoje && (data.getMonth() + 1) === mesHoje;
          }).length;
          setAniversariantes(aniversariantesCount);
        }

      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  return (
    <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto pb-10">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">A Paz do Senhor, {loading ? "..." : nomeUsuario}! 🙏</h1>
          <p className="text-gray-400 text-xs mt-0.5">Aqui está o resumo da sua igreja hoje.</p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-xs text-gray-500">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* MONITOR DE MÍDIA */}
      <Link href="/monitor-midia" className="block outline-none">
        <Card className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-ohel-blue/20 to-ohel-surface border-ohel-blue/40 hover:border-ohel-blue transition-all duration-300 cursor-pointer group shadow-[0_0_20px_rgba(0,123,255,0.15)]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ohel-blue flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <MonitorPlay className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Monitor de Mídia</h2>
              <p className="text-gray-300 text-xs mt-0.5">Acesso rápido a visitantes, louvores, mural, orações e escalas.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-ohel-blue font-bold text-sm bg-ohel-blue/10 px-4 py-2 rounded-lg group-hover:bg-ohel-blue group-hover:text-white transition-colors">
            Acessar Painel <ArrowRight className="w-4 h-4" />
          </div>
        </Card>
      </Link>

      {/* LINHA 1 DE KPIs (SECRETARIA) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/secretaria/membros" className="block outline-none">
          <Card className="p-4 flex flex-col justify-between group hover:border-ohel-blue/50 hover:scale-[1.02] transition-all cursor-pointer h-full shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Membros</p>
              <div className="w-8 h-8 rounded-full bg-ohel-blue/10 flex items-center justify-center"><Users className="w-4 h-4 text-ohel-blue" /></div>
            </div>
            <h2 className="text-2xl font-bold text-white">{loading ? "-" : totalMembros}</h2>
          </Card>
        </Link>
        <Link href="/secretaria/congregados" className="block outline-none">
          <Card className="p-4 flex flex-col justify-between group hover:border-green-500/50 hover:scale-[1.02] transition-all cursor-pointer h-full shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Congregados</p>
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center"><UserPlus className="w-4 h-4 text-green-500" /></div>
            </div>
            <h2 className="text-2xl font-bold text-white">{loading ? "-" : totalCongregados}</h2>
          </Card>
        </Link>
        <Link href="/secretaria/visitantes" className="block outline-none">
          <Card className="p-4 flex flex-col justify-between group hover:border-purple-500/50 hover:scale-[1.02] transition-all cursor-pointer h-full shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Visitantes</p>
              <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center"><HeartHandshake className="w-4 h-4 text-purple-500" /></div>
            </div>
            <h2 className="text-2xl font-bold text-white">{loading ? "-" : totalVisitantes}</h2>
          </Card>
        </Link>
        <Link href="/secretaria/congregacoes" className="block outline-none">
          <Card className="p-4 flex flex-col justify-between group hover:border-yellow-500/50 hover:scale-[1.02] transition-all cursor-pointer h-full shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Congregações</p>
              <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center"><Church className="w-4 h-4 text-yellow-500" /></div>
            </div>
            <h2 className="text-2xl font-bold text-white">{loading ? "-" : totalCongregacoes}</h2>
          </Card>
        </Link>
      </div>

      {/* LINHA 2 DE KPIs (OPERACIONAL / FINANCEIRO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/financeiro/movimento" className="block outline-none">
          <Card className="p-4 flex flex-col justify-between group hover:border-green-500/50 hover:scale-[1.02] transition-all cursor-pointer h-full bg-ohel-surface/40">
            <div className="flex justify-between items-start mb-2">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Saldo do Mês</p>
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center"><DollarSign className="w-4 h-4 text-green-500" /></div>
            </div>
            <h2 className={`text-2xl font-bold ${saldoFinanceiro >= 0 ? 'text-white' : 'text-red-500'}`}>
              {loading ? "-" : `R$ ${saldoFinanceiro.toFixed(2).replace('.', ',')}`}
            </h2>
          </Card>
        </Link>

        <Link href="/secretaria/oracoes" className="block outline-none">
          <Card className="p-4 flex flex-col justify-between group hover:border-red-500/50 hover:scale-[1.02] transition-all cursor-pointer h-full bg-ohel-surface/40">
            <div className="flex justify-between items-start mb-2">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Pedidos de Oração</p>
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center"><HeartHandshake className="w-4 h-4 text-red-500" /></div>
            </div>
            <h2 className="text-2xl font-bold text-white">{loading ? "-" : pedidosOracao}</h2>
          </Card>
        </Link>
        
        <Card className="p-4 flex flex-col justify-between h-full bg-ohel-surface/40 border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Aniversariantes</p>
            <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center"><CalendarDays className="w-4 h-4 text-orange-500" /></div>
          </div>
          <h2 className="text-2xl font-bold text-white">{loading ? "-" : aniversariantes}</h2>
        </Card>

        <Link href="/secretaria/membros/aprovacao" className="block outline-none">
          <Card className="p-4 flex flex-col justify-between group hover:border-blue-500/50 hover:scale-[1.02] transition-all cursor-pointer h-full bg-ohel-surface/40">
            <div className="flex justify-between items-start mb-2">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Pré-Cadastros</p>
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><CheckSquare className="w-4 h-4 text-blue-500" /></div>
            </div>
            <h2 className="text-2xl font-bold text-white">{loading ? "-" : preCadastros}</h2>
          </Card>
        </Link>
      </div>

      {/* ÁREA DE GRÁFICOS / MURAL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
        
        <Link href="/financeiro" className="block outline-none">
          <Card className="p-5 flex flex-col min-h-[250px] group hover:border-green-500/50 hover:scale-[1.01] transition-all cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center"><DollarSign className="w-3.5 h-3.5 text-green-500" /></div><h3 className="text-sm font-bold text-white">Resumo Financeiro</h3></div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <p className="text-xs">Acesse o módulo financeiro para ver o extrato completo.</p>
            </div>
          </Card>
        </Link>

        <Link href="/secretaria/mural" className="block outline-none">
          <Card className="p-5 flex flex-col min-h-[250px] group hover:border-teal-500/50 hover:scale-[1.01] transition-all cursor-pointer">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-teal-500/10 flex items-center justify-center"><Bell className="w-3.5 h-3.5 text-teal-500" /></div>
              <h3 className="text-sm font-bold text-white">Mural / Avisos</h3>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <p className="text-xs">Há {loading ? "-" : totalAvisos} avisos publicados no mural.</p>
            </div>
          </Card>
        </Link>

      </div>

    </div>
  );
}