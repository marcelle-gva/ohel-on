"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Search, Plus, Edit, Trash2, AlertTriangle, CalendarDays, FileText, Users, Video } from "lucide-react";

interface Reuniao {
  id: string; 
  titulo: string; 
  data_hora: string; 
  local: string; 
  link_online: string | null; 
  status: string; 
  participantes: string;
}

export default function ReunioesPage() {
  const router = useRouter();
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todas");

  const [reuniaoToDelete, setReuniaoToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchReunioes();
  }, []);

  const fetchReunioes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("reunioes")
        .select("*")
        .order("data_hora", { ascending: false });
        
      if (error) throw error;
      setReunioes(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!reuniaoToDelete) return;
    setIsDeleting(true);
    try {
      await supabase.from("reunioes").delete().eq("id", reuniaoToDelete);
      setReunioes(reunioes.filter((r) => r.id !== reuniaoToDelete));
      setReuniaoToDelete(null);
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatarDataHora = (dataStr: string) => {
    if (!dataStr) return "-";
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + 
           ' às ' + 
           data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const totalReunioes = reunioes.length;
  const agendadas = reunioes.filter(r => r.status === "Agendada").length;
  const realizadas = reunioes.filter(r => r.status === "Realizada").length;

  const reunioesFiltradas = reunioes.filter((r) => {
    const matchBusca = r.titulo.toLowerCase().includes(busca.toLowerCase()) || (r.local && r.local.toLowerCase().includes(busca.toLowerCase()));
    const matchStatus = filtroStatus === "todas" || r.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto relative">
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Reuniões</h1>
          <p className="text-gray-400 text-sm mt-1">Gestão de reuniões, pautas e atas da igreja.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/secretaria/reunioes/novo" className="bg-ohel-blue hover:bg-blue-600 text-white font-medium py-2.5 px-6 rounded-md transition-all shadow-[0_0_15px_rgba(0,123,255,0.2)] flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Reunião
          </Link>
        </div>
      </div>

      {/* Resumo Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4 bg-ohel-surface/30">
          <div className="w-10 h-10 rounded-full bg-ohel-blue/10 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-ohel-blue" />
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Total</p>
            <h3 className="text-xl font-bold text-white">{totalReunioes}</h3>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 bg-ohel-surface/30">
          <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Agendadas</p>
            <h3 className="text-xl font-bold text-white">{agendadas}</h3>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 bg-ohel-surface/30">
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Realizadas</p>
            <h3 className="text-xl font-bold text-white">{realizadas}</h3>
          </div>
        </Card>
      </div>

      <Card className="p-4 flex flex-col lg:flex-row gap-4 items-center bg-ohel-surface/50">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
          <input type="text" placeholder="Buscar por título ou local..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full bg-ohel-bg border border-gray-700 text-sm text-white rounded-md pl-9 pr-4 py-2.5 focus:border-ohel-blue outline-none" />
        </div>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="bg-ohel-bg border border-gray-700 text-sm text-white rounded-md px-4 py-2.5 outline-none w-full lg:w-48">
          <option value="todas">Todos os Status</option>
          <option value="Agendada">Agendadas</option>
          <option value="Realizada">Realizadas</option>
          <option value="Cancelada">Canceladas</option>
        </select>
      </Card>

      <Card className="overflow-hidden p-0 border-gray-800/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-ohel-surface/80 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400">
                <th className="p-4 font-medium">Ações</th>
                <th className="p-4 font-medium">Data e Horário</th>
                <th className="p-4 font-medium">Título</th>
                <th className="p-4 font-medium">Local / Link</th>
                <th className="p-4 font-medium">Participantes</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Carregando reuniões...</td></tr>
              ) : reunioesFiltradas.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhuma reunião encontrada.</td></tr>
              ) : (
                reunioesFiltradas.map((reuniao) => (
                  <tr key={reuniao.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => router.push(`/secretaria/reunioes/editar/${reuniao.id}`)} className="text-gray-500 hover:text-ohel-blue transition-colors" title="Ver Ata / Editar"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => setReuniaoToDelete(reuniao.id)} className="text-gray-500 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                    
                    <td className="p-4 text-white font-medium">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-ohel-blue" /> {formatarDataHora(reuniao.data_hora)}
                      </div>
                    </td>
                    
                    <td className="p-4 text-gray-300 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" /> {reuniao.titulo}
                      </div>
                    </td>

                    {/* LÓGICA DO LINK ONLINE AQUI */}
                    <td className="p-4 text-gray-300 text-sm">
                      {reuniao.link_online ? (
                        <a 
                          href={reuniao.link_online} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 bg-ohel-blue/10 text-ohel-blue px-2.5 py-1.5 rounded-md border border-ohel-blue/20 hover:bg-ohel-blue/20 transition-colors font-medium text-xs"
                        >
                          <Video className="w-3.5 h-3.5" /> Entrar na Sala
                        </a>
                      ) : (
                        reuniao.local || "-"
                      )}
                    </td>

                    <td className="p-4 text-gray-300 text-sm">
                      {reuniao.participantes ? (
                        <div className="flex items-center gap-1" title={reuniao.participantes}>
                          <Users className="w-3 h-3 text-gray-500"/> {reuniao.participantes.split(',').length} pessoas
                        </div>
                      ) : "-"}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                        ${reuniao.status === "Agendada" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : 
                          reuniao.status === "Realizada" ? "bg-green-500/10 text-green-400 border-green-500/20" : 
                          "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                        {reuniao.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL DE EXCLUSÃO */}
      {reuniaoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-white">Excluir Reunião</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">Tem certeza que deseja excluir esta reunião e sua ata? Esta ação não pode ser desfeita.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setReuniaoToDelete(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white" disabled={isDeleting}>Cancelar</button>
              <button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md text-sm flex items-center gap-2" disabled={isDeleting}>
                {isDeleting ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}