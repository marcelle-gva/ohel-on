"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Search, Plus, Edit, Trash2, AlertTriangle, CalendarCheck, Clock, CheckCircle2, XCircle } from "lucide-react";

interface Visita {
  id: string; pessoa_visitada: string; tipo: string; data_prevista: string; hora_prevista: string; status: string; responsavel: string; vinculo_tipo: string;
}

export default function VisitasPage() {
  const router = useRouter();
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [busca, setBusca] = useState("");
  const [filtroVinculo, setFiltroVinculo] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroResponsavel, setFiltroResponsavel] = useState("todos");

  const [visitaToDelete, setVisitaToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchVisitas();
  }, []);

  const fetchVisitas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("visitas")
        .select("*")
        .order("data_prevista", { ascending: true });
        
      if (error) throw error;
      setVisitas(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!visitaToDelete) return;
    setIsDeleting(true);
    try {
      await supabase.from("visitas").delete().eq("id", visitaToDelete);
      setVisitas(visitas.filter((v) => v.id !== visitaToDelete));
      setVisitaToDelete(null);
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatarData = (data: string | null) => {
    if (!data) return "-";
    return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  const totalVisitas = visitas.length;
  const agendadas = visitas.filter(v => v.status === "Agendada").length;
  const realizadas = visitas.filter(v => v.status === "Realizada").length;
  const atrasadas = visitas.filter(v => v.status === "Atrasada").length;

  const visitasFiltradas = visitas.filter((v) => {
    const matchBusca = v.pessoa_visitada.toLowerCase().includes(busca.toLowerCase()) || (v.responsavel && v.responsavel.toLowerCase().includes(busca.toLowerCase()));
    const matchVinculo = filtroVinculo === "todos" || v.vinculo_tipo === filtroVinculo;
    const matchTipo = filtroTipo === "todos" || v.tipo === filtroTipo;
    const matchResponsavel = filtroResponsavel === "todos" || v.responsavel === filtroResponsavel;
    return matchBusca && matchVinculo && matchTipo && matchResponsavel;
  });

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto relative">
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Visitas Pastorais</h1>
          <p className="text-gray-400 text-sm mt-1">Gestão de acompanhamento e acolhimento aos membros.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/secretaria/visitas/novo" className="bg-ohel-blue hover:bg-blue-600 text-white font-medium py-2.5 px-6 rounded-md transition-all shadow-[0_0_15px_rgba(0,123,255,0.2)] flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Visita
          </Link>
        </div>
      </div>

      {/* GRID DE KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5 border-l-4 border-l-ohel-blue flex flex-col justify-between">
          <div className="flex justify-between items-start"><p className="text-gray-400 text-sm font-medium">Total de Visitas</p><CalendarCheck className="w-5 h-5 text-ohel-blue" /></div>
          <h2 className="text-3xl font-bold text-white mt-2">{totalVisitas}</h2><p className="text-xs text-gray-500 mt-1">Registros no sistema</p>
        </Card>
        <Card className="p-5 border-l-4 border-l-yellow-500 flex flex-col justify-between">
          <div className="flex justify-between items-start"><p className="text-gray-400 text-sm font-medium">Agendadas</p><Clock className="w-5 h-5 text-yellow-500" /></div>
          <h2 className="text-3xl font-bold text-white mt-2">{agendadas}</h2><p className="text-xs text-gray-500 mt-1">Aguardando realização</p>
        </Card>
        <Card className="p-5 border-l-4 border-l-green-500 flex flex-col justify-between">
          <div className="flex justify-between items-start"><p className="text-gray-400 text-sm font-medium">Realizadas</p><CheckCircle2 className="w-5 h-5 text-green-500" /></div>
          <h2 className="text-3xl font-bold text-white mt-2">{realizadas}</h2><p className="text-xs text-gray-500 mt-1">Concluídas com sucesso</p>
        </Card>
        <Card className="p-5 border-l-4 border-l-red-500 flex flex-col justify-between">
          <div className="flex justify-between items-start"><p className="text-gray-400 text-sm font-medium">Atrasadas</p><XCircle className="w-5 h-5 text-red-500" /></div>
          <h2 className="text-3xl font-bold text-white mt-2">{atrasadas}</h2><p className="text-xs text-gray-500 mt-1">Data prevista expirou</p>
        </Card>
      </div>

      <Card className="p-4 flex flex-col lg:flex-row gap-3 items-center bg-ohel-surface/50">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
          <input type="text" placeholder="Buscar por pessoa, responsável..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full bg-ohel-bg border border-gray-700 text-sm text-white rounded-md pl-9 pr-4 py-2.5 focus:border-ohel-blue outline-none" />
        </div>
        
        <select value={filtroVinculo} onChange={(e) => setFiltroVinculo(e.target.value)} className="bg-ohel-bg border border-gray-700 text-sm text-white rounded-md px-3 py-2.5 outline-none w-full lg:w-auto">
          <option value="todos">Todos os Públicos</option>
          <option value="Membro">Membro</option>
          <option value="Congregado">Congregado</option>
          <option value="Visitante">Visitante</option>
        </select>
        
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="bg-ohel-bg border border-gray-700 text-sm text-white rounded-md px-3 py-2.5 outline-none w-full lg:w-auto">
          <option value="todos">Todos os Tipos</option>
          <option value="Visita Pastoral">Visita Pastoral</option>
          <option value="Acolhimento">Acolhimento</option>
          <option value="Visita de Oração">Visita de Oração</option>
        </select>

        <select value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)} className="bg-ohel-bg border border-gray-700 text-sm text-white rounded-md px-3 py-2.5 outline-none w-full lg:w-auto">
          <option value="todos">Todos os Responsáveis</option>
          {/* Aqui poderíamos puxar dinamicamente, mas vamos deixar simples por enquanto */}
          <option value="Pastor João">Pastor João</option> 
        </select>
      </Card>

      <Card className="overflow-hidden p-0 border-gray-800/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-ohel-surface/80 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400">
                <th className="p-4 font-medium">Ações</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Pessoa</th>
                <th className="p-4 font-medium">Vínculo</th>
                <th className="p-4 font-medium">Data Prevista</th>
                <th className="p-4 font-medium">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Carregando visitas...</td></tr>
              ) : visitasFiltradas.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhuma visita encontrada.</td></tr>
              ) : (
                visitasFiltradas.map((vis) => (
                  <tr key={vis.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => router.push(`/secretaria/visitas/editar/${vis.id}`)} className="text-gray-500 hover:text-ohel-blue transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => setVisitaToDelete(vis.id)} className="text-gray-500 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                        ${vis.status === "Agendada" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : 
                          vis.status === "Realizada" ? "bg-green-500/10 text-green-400 border-green-500/20" : 
                          vis.status === "Atrasada" ? "bg-red-500/10 text-red-400 border-red-500/20" : 
                          "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                        {vis.status}
                      </span>
                    </td>
                    <td className="p-4 text-white font-medium">{vis.pessoa_visitada}</td>
                    <td className="p-4 text-gray-400 text-sm">{vis.vinculo_tipo}</td>
                    <td className="p-4 text-gray-300 text-sm">{formatarData(vis.data_prevista)} {vis.hora_prevista && `às ${vis.hora_prevista}`}</td>
                    <td className="p-4 text-gray-300 text-sm">{vis.responsavel || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {visitaToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
              <h3 className="text-lg font-bold text-white">Excluir Visita</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">Tem certeza que deseja excluir esta visita? Esta ação não pode ser desfeita.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setVisitaToDelete(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white" disabled={isDeleting}>Cancelar</button>
              <button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md text-sm flex items-center gap-2" disabled={isDeleting}>{isDeleting ? "Excluindo..." : "Sim, excluir"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}