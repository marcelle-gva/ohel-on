"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, Plus, Search, Calendar, CheckCircle2, XCircle, Clock, User } from "lucide-react";

interface Atendimento {
  id: string;
  membro_id: string;
  nome_visitante: string;
  membros?: { nome: string };
  pastor_responsavel: string;
  data_atendimento: string;
  hora_atendimento: string;
  tipo: string;
  status: string;
}

export default function AtendimentosPage() {
  const [loading, setLoading] = useState(true);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  useEffect(() => {
    fetchAtendimentos();
  }, []);

  const fetchAtendimentos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('atendimentos_pastorais')
      .select('*, membros(nome)')
      .order('data_atendimento', { ascending: false })
      .order('hora_atendimento', { ascending: false });
    
    if (data) setAtendimentos(data as Atendimento[]);
    setLoading(false);
  };

  const hoje = new Date().toISOString().split('T')[0];
  const agendados = atendimentos.filter(a => a.status === 'Agendado').length;
  const realizados = atendimentos.filter(a => a.status === 'Realizado').length;
  const doDia = atendimentos.filter(a => a.data_atendimento === hoje && a.status === 'Agendado').length;

  const filtrados = atendimentos.filter(a => {
    const nomePessoa = a.membros?.nome || a.nome_visitante || "";
    const matchBusca = nomePessoa.toLowerCase().includes(busca.toLowerCase()) || 
                       a.pastor_responsavel.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === "todos" || a.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const formatarData = (dataStr: string) => {
    return new Date(`${dataStr}T12:00:00`).toLocaleDateString('pt-BR');
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-5 pb-10">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/gabinete" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Calendar className="w-5 h-5 text-ohel-blue" /> Atendimentos Pastorais
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Gerencie os aconselhamentos, orações e visitas pastorais.</p>
          </div>
        </div>
        <Link href="/gabinete/atendimentos/novo" className="w-auto px-5 py-2 text-xs bg-ohel-blue hover:bg-blue-600 text-white rounded-md flex items-center gap-2 font-medium transition-colors shadow-[0_0_15px_rgba(0,123,255,0.2)]">
          <Plus className="w-3.5 h-3.5" /> Novo Atendimento
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-yellow-500 flex flex-col justify-between bg-ohel-surface border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Agendados</p>
            <Clock className="w-4 h-4 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-bold text-yellow-500">{agendados}</h2>
        </Card>
        
        <Card className="p-4 border-l-4 border-l-green-500 flex flex-col justify-between bg-ohel-surface border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <p className="text-green-400 text-[10px] font-bold uppercase tracking-wider">Realizados</p>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-green-500">{realizados}</h2>
        </Card>

        <Card className="p-4 border-l-4 border-l-ohel-blue flex flex-col justify-between bg-ohel-surface border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <p className="text-ohel-blue text-[10px] font-bold uppercase tracking-wider">Atendimentos Hoje</p>
            <Calendar className="w-4 h-4 text-ohel-blue" />
          </div>
          <h2 className="text-2xl font-bold text-white">{doDia}</h2>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-3 flex flex-col lg:flex-row gap-3 items-center bg-ohel-surface/50 border-gray-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
          <input 
            type="text" 
            placeholder="Buscar por pessoa ou pastor..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-ohel-bg border border-gray-700 text-xs text-white rounded-md pl-9 pr-3 py-2 focus:border-ohel-blue outline-none"
          />
        </div>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="bg-ohel-bg border border-gray-700 text-xs text-white rounded-md px-3 py-2 outline-none w-full lg:w-40">
          <option value="todos">Todos os Status</option>
          <option value="Agendado">Agendados</option>
          <option value="Realizado">Realizados</option>
          <option value="Cancelado">Cancelados</option>
        </select>
      </Card>

      {/* Tabela */}
      <Card className="p-0 overflow-hidden border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#05080f] border-b border-gray-800 text-[9px] uppercase tracking-wider text-gray-400">
              <tr>
                <th className="p-3 font-medium">Data / Hora</th>
                <th className="p-3 font-medium">Pessoa Atendida</th>
                <th className="p-3 font-medium">Pastor</th>
                <th className="p-3 font-medium">Tipo</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Carregando atendimentos...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhum atendimento encontrado.</td></tr>
              ) : (
                filtrados.map((atend) => (
                  <tr key={atend.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3">
                      <p className="text-white font-bold">{formatarData(atend.data_atendimento)}</p>
                      <p className="text-[10px] text-gray-500">{atend.hora_atendimento || "Horário não definido"}</p>
                    </td>
                    <td className="p-3 text-white font-medium flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-ohel-blue" /> 
                      {atend.membros?.nome || atend.nome_visitante || "Não informado"}
                    </td>
                    <td className="p-3 text-gray-300">{atend.pastor_responsavel}</td>
                    <td className="p-3 text-gray-400">{atend.tipo}</td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider
                        ${atend.status === "Realizado" ? "bg-green-500/10 text-green-500 border-green-500/20" : 
                          atend.status === "Agendado" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : 
                          "bg-red-500/10 text-red-500 border-red-500/20"}`}>
                        {atend.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <Link href={`/gabinete/atendimentos/editar/${atend.id}`} className="text-ohel-blue hover:text-blue-400 font-medium text-[11px]">
                        Ver / Editar
                      </Link>
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