"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { Wallet, TrendingUp, TrendingDown, Landmark, FileText, Users2, PieChart, Upload, Lock, Unlock } from "lucide-react";

export default function FinanceiroHubPage() {
  const [loading, setLoading] = useState(true);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [mesAtual, setMesAtual] = useState(new Date().toISOString().slice(0, 7));
  const [isMesFechado, setIsMesFechado] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) {
          setIgrejaId(user.igreja_id);
          checkMesFechado(user.igreja_id);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const checkMesFechado = async (id: string) => {
    const { data } = await supabase.from('meses_fechados').select('*').eq('igreja_id', id).eq('mes_referencia', mesAtual).maybeSingle();
    setIsMesFechado(!!data);
  };

  const toggleFechamento = async () => {
    if (!igrejaId) return;
    try {
      if (isMesFechado) {
        await supabase.from('meses_fechados').delete().eq('igreja_id', igrejaId).eq('mes_referencia', mesAtual);
        setIsMesFechado(false);
        setModal({ isOpen: true, type: "success", title: "Mês Reaberto", message: "Agora é possível lançar transações neste mês." });
      } else {
        await supabase.from('meses_fechados').insert([{ igreja_id: igrejaId, mes_referencia: mesAtual }]);
        setIsMesFechado(true);
        setModal({ isOpen: true, type: "success", title: "Mês Fechado", message: "Novas transações para este mês estão bloqueadas." });
      }
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
    }
  };

  const modulos = [
    { name: "Movimento Financeiro", desc: "Lançamentos de receitas e despesas.", icon: Wallet, href: "/financeiro/movimento", color: "text-blue-400", bg: "bg-blue-500/10" },
    { name: "Caixas e Bancos", desc: "Contas, saldos e transferências.", icon: Landmark, href: "/financeiro/caixas", color: "text-green-400", bg: "bg-green-500/10" },
    { name: "Contas a Pagar", desc: "Boletos, fornecedores e vencimentos.", icon: FileText, href: "/financeiro/contas-pagar", color: "text-red-400", bg: "bg-red-500/10" },
    { name: "Fornecedores", desc: "Cadastro de empresas e prestadores.", icon: Users2, href: "/financeiro/fornecedores", color: "text-purple-400", bg: "bg-purple-500/10" },
    { name: "Relatórios", desc: "Extratos, balancetes e dízimos.", icon: PieChart, href: "/financeiro/relatorios", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  ];

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando...</div>;

  return (
    <div className="flex flex-col gap-5 w-full max-w-6xl mx-auto pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-ohel-blue flex items-center justify-center shadow-[0_0_15px_rgba(0,123,255,0.4)]">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Visão Geral Financeira</h1>
            <p className="text-gray-400 text-xs mt-0.5">Gerencie as finanças, contas e relatórios da igreja.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/financeiro/movimento/importar" className="bg-ohel-surface border border-gray-700 hover:border-ohel-blue text-white font-medium py-2 px-4 rounded-md text-xs flex items-center gap-2 transition-colors">
            <Upload className="w-3.5 h-3.5" /> Importar OFX
          </Link>
        </div>
      </div>

      {/* PAINEL DE FECHAMENTO */}
      <Card className={`p-5 border-l-4 ${isMesFechado ? 'border-l-red-500 bg-red-500/5' : 'border-l-green-500 bg-green-500/5'} flex flex-col md:flex-row justify-between items-center gap-4`}>
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            {isMesFechado ? <Lock className="w-4 h-4 text-red-500" /> : <Unlock className="w-4 h-4 text-green-500" />}
            Fechamento Contábil - {new Date(`${mesAtual}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </h3>
          <p className="text-[11px] text-gray-400 mt-1">
            {isMesFechado ? "O mês está fechado. Não é possível lançar novas transações." : "O mês está aberto para lançamentos."}
          </p>
        </div>
        <Button onClick={toggleFechamento} className={`w-auto px-5 py-2 text-xs text-white ${isMesFechado ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
          {isMesFechado ? "Reabrir Mês" : "Fechar Mês"}
        </Button>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modulos.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link key={mod.name} href={mod.href} className="block outline-none h-full">
              <Card className="p-5 flex flex-col h-full bg-ohel-surface border border-gray-800 transition-all duration-300 hover:scale-[1.02] hover:border-ohel-blue/50 group">
                <div className={`w-10 h-10 rounded-lg ${mod.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 ${mod.color}`} />
                </div>
                <h4 className="text-sm font-bold text-white mb-1">{mod.name}</h4>
                <p className="text-[11px] text-gray-400 leading-relaxed">{mod.desc}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}