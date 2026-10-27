"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, HeartPulse, Search, User } from "lucide-react";

interface RegistroEmocional {
  id: string;
  membro_id: string;
  membros: { nome: string };
  emoji: string;
  observacao: string;
  created_at: string;
}

export default function EmocionalPage() {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<RegistroEmocional[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("mes");
  const [erro, setErro] = useState("");

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    setErro("");
    
    const hoje = new Date();
    let dataCorte = new Date();
    
    if (filtroPeriodo === 'semana') dataCorte.setDate(hoje.getDate() - 7);
    if (filtroPeriodo === 'mes') dataCorte.setMonth(hoje.getMonth() - 1);
    if (filtroPeriodo === 'ano') dataCorte.setFullYear(hoje.getFullYear() - 1);
    if (filtroPeriodo === 'total') dataCorte = new Date(2000, 0, 1); // Sem limite

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error("Sua sessão expirou. Entre novamente.");
      const { data: user, error: userError } = await supabase.from("usuarios").select("igreja_id").eq("id", session.user.id).maybeSingle();
      if (userError) throw userError;
      if (!user?.igreja_id) throw new Error("Não foi possível identificar a igreja do usuário.");

      const { data, error } = await supabase
        .from("acompanhamento_emocional")
        .select("*, membros!inner(nome, igreja_id)")
        .eq("membros.igreja_id", user.igreja_id)
        .gte("created_at", dataCorte.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRegistros((data ?? []) as RegistroEmocional[]);
    } catch (fetchError) {
      setRegistros([]);
      setErro(fetchError instanceof Error ? fetchError.message : "Não foi possível carregar os registros emocionais.");
    } finally {
      setLoading(false);
    }
  }, [filtroPeriodo]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchRegistros(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchRegistros]);

  const registrosFiltrados = registros.filter(r => 
    (r.membros?.nome || "").toLowerCase().includes(busca.toLowerCase()) ||
    (r.emoji || "").toLowerCase().includes(busca.toLowerCase())
  );

  // Cálculo para o Gráfico de Barras
  const totalRegistros = registrosFiltrados.length;
  const contagemPorEmocao = Array.from(new Set(registrosFiltrados.map(registro => registro.emoji).filter(Boolean))).map((nome, index) => {
    const count = registrosFiltrados.filter(r => r.emoji === nome).length;
    const porcentagem = totalRegistros > 0 ? (count / totalRegistros) * 100 : 0;
    const cor = ["bg-green-500", "bg-emerald-400", "bg-teal-400", "bg-yellow-500", "bg-orange-500", "bg-red-500", "bg-purple-600"][index % 7];
    const texto = ["text-green-500", "text-emerald-400", "text-teal-400", "text-yellow-500", "text-orange-500", "text-red-500", "text-purple-600"][index % 7];
    return { nome, count, porcentagem, cor, texto };
  }).sort((a, b) => b.count - a.count); // Ordena da mais frequente para a menos

  const formatarData = (dataStr: string) => {
    const d = new Date(dataStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-5 pb-10">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/gabinete" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-pink-500" /> Acompanhamento Emocional
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Monitore como os membros estão se sentindo para oferecer acolhimento.</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-3 flex flex-col lg:flex-row gap-3 items-center bg-ohel-surface/50 border-gray-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou emoção..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-ohel-bg border border-gray-700 text-xs text-white rounded-md pl-9 pr-3 py-2 focus:border-ohel-blue outline-none"
          />
        </div>
        <div className="flex bg-ohel-bg border border-gray-700 rounded-md p-1 w-full lg:w-auto">
          {['semana', 'mes', 'ano', 'total'].map(p => (
            <button 
              key={p}
              onClick={() => setFiltroPeriodo(p)}
              className={`px-4 py-1.5 text-xs font-bold rounded capitalize flex-1 lg:flex-none transition-colors ${filtroPeriodo === p ? 'bg-ohel-blue text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {p === 'mes' ? 'Mês' : p === 'semana' ? 'Semana' : p === 'ano' ? 'Ano' : 'Tudo'}
            </button>
          ))}
        </div>
      </Card>
      {erro && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">Falha ao consultar o acompanhamento emocional: {erro}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Gráfico de Emoções */}
        <Card className="p-5 border-gray-800 bg-ohel-surface lg:col-span-1 flex flex-col">
          <h3 className="text-sm font-bold text-white mb-4 border-b border-gray-800 pb-2">Visão Geral (Porcentagem)</h3>
          
          <div className="flex flex-col gap-4 flex-1 justify-center">
            {loading ? (
              <p className="text-center text-xs text-gray-500 py-4">Carregando registros...</p>
            ) : totalRegistros === 0 ? (
              <p className="text-center text-xs text-gray-500 py-4">Nenhum registro neste período.</p>
            ) : contagemPorEmocao.map(em => (
              <div key={em.nome}>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-gray-300 font-medium">{em.nome}</span>
                  <span className={`font-bold ${em.texto}`}>{em.count} ({em.porcentagem.toFixed(0)}%)</span>
                </div>
                <div className="w-full bg-ohel-bg rounded-full h-2">
                  <div className={`h-2 rounded-full ${em.cor}`} style={{ width: `${em.porcentagem}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Lista de Registros */}
        <Card className="p-0 border-gray-800 bg-ohel-surface lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-sm font-bold text-white">Registros Recentes</h3>
            <span className="bg-pink-500/10 text-pink-500 text-[10px] font-bold px-2 py-1 rounded border border-pink-500/20">{totalRegistros} registros</span>
          </div>
          
          <div className="overflow-y-auto flex-1 max-h-[600px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#05080f] border-b border-gray-800 text-[9px] uppercase tracking-wider text-gray-400 sticky top-0">
                <tr>
                  <th className="p-3 font-medium">Data</th>
                  <th className="p-3 font-medium">Pessoa</th>
                  <th className="p-3 font-medium">Emoção</th>
                  <th className="p-3 font-medium">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/30">
                {loading ? (
                  <tr><td colSpan={4} className="p-8 text-center text-gray-400">Carregando registros...</td></tr>
                ) : registrosFiltrados.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-gray-400">Nenhum registro encontrado.</td></tr>
                ) : (
                  registrosFiltrados.map((reg) => (
                    <tr key={reg.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3 text-gray-400">{formatarData(reg.created_at)}</td>
                      <td className="p-3 text-white font-medium flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-ohel-blue" /> {reg.membros?.nome}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold border border-gray-700 bg-ohel-bg text-white">
                          {reg.emoji}
                        </span>
                      </td>
                      <td className="p-3 text-gray-300 max-w-[200px] truncate" title={reg.observacao}>{reg.observacao || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}