"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Search, Plus, Edit, Trash2, AlertTriangle, Calendar, MapPin, Users, Megaphone, Ticket } from "lucide-react";

interface Evento {
  id: string;
  nome: string;
  data_inicio: string;
  data_fim: string | null;
  cartaz_url: string | null;
  congregacao_id: string | null;
  congregacoes: { nome: string } | null;
  cidade: string | null;
  status: string;
  publicar_mural: boolean;
  limite_participantes: number | null;
  inscricoes_count: number;
}

export default function EventosPage() {
  const router = useRouter();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  
  const [eventoToDelete, setEventoToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchEventos();
  }, []);

  const fetchEventos = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("eventos")
        .select(`*, congregacoes (nome), inscricoes_eventos (count)`)
        .order("data_inicio", { ascending: false });
        
      if (error) throw error;

      const eventosFormatados = (data || []).map((e: any) => ({
        ...e,
        inscricoes_count: e.inscricoes_eventos?.[0]?.count || 0
      }));

      setEventos(eventosFormatados);
    } catch (error) {
      console.error("Erro ao buscar eventos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!eventoToDelete) return;
    setIsDeleting(true);
    try {
      await supabase.from("eventos").delete().eq("id", eventoToDelete);
      setEventos(eventos.filter((e) => e.id !== eventoToDelete));
      setEventoToDelete(null);
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatarData = (data: string) => {
    if (!data) return "-";
    return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  const eventosFiltrados = eventos.filter((e) => {
    const matchBusca = 
      e.nome.toLowerCase().includes(busca.toLowerCase()) || 
      (e.cidade && e.cidade.toLowerCase().includes(busca.toLowerCase())) ||
      (e.congregacoes?.nome.toLowerCase().includes(busca.toLowerCase()));
      
    const matchStatus = filtroStatus === "todos" || e.status.toLowerCase() === filtroStatus.toLowerCase();
    
    return matchBusca && matchStatus;
  });

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto relative pb-10">
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Eventos</h1>
          <p className="text-gray-400 text-sm mt-1">Gestão de eventos, datas e inscrições.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/eventos/novo" className="bg-ohel-blue hover:bg-blue-600 text-white font-medium py-2.5 px-6 rounded-md transition-all shadow-[0_0_15px_rgba(0,123,255,0.2)] flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Novo Evento
          </Link>
        </div>
      </div>

      <Card className="p-4 flex flex-col md:flex-row gap-4 items-center bg-ohel-surface/50">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
          <input 
            type="text" 
            placeholder="Buscar por nome, local ou congregação..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-ohel-bg border border-gray-700 text-sm text-white rounded-md pl-9 pr-4 py-2.5 focus:border-ohel-blue outline-none transition-colors"
          />
        </div>
        
        <div className="flex gap-2 w-full md:w-auto bg-ohel-bg border border-gray-700 rounded-md p-1">
          <button onClick={() => setFiltroStatus("todos")} className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-medium rounded-sm transition-colors ${filtroStatus === "todos" ? "bg-ohel-blue text-white" : "text-gray-400 hover:text-white"}`}>Todos</button>
          <button onClick={() => setFiltroStatus("Aberto")} className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-medium rounded-sm transition-colors ${filtroStatus === "Aberto" ? "bg-ohel-blue text-white" : "text-gray-400 hover:text-white"}`}>Abertos</button>
          <button onClick={() => setFiltroStatus("Encerrado")} className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-medium rounded-sm transition-colors ${filtroStatus === "Encerrado" ? "bg-ohel-blue text-white" : "text-gray-400 hover:text-white"}`}>Encerrados</button>
        </div>
      </Card>

      {loading ? (
        <div className="text-center p-10 text-gray-400">Carregando eventos...</div>
      ) : eventosFiltrados.length === 0 ? (
        <div className="text-center p-10 text-gray-400 bg-ohel-surface/30 rounded-xl border border-gray-800">Nenhum evento encontrado.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventosFiltrados.map((evento) => {
            const limite = evento.limite_participantes || 0;
            const inscritos = evento.inscricoes_count;
            const percentual = limite > 0 ? Math.min(Math.round((inscritos / limite) * 100), 100) : 0;

            return (
              <Card key={evento.id} className="p-0 overflow-hidden border-gray-800 bg-ohel-surface flex flex-col group hover:border-ohel-blue/50 transition-colors">
                
                <div className="h-40 w-full relative bg-gradient-to-br from-ohel-surface to-ohel-bg overflow-hidden">
                  {evento.cartaz_url ? (
                    <Image src={evento.cartaz_url} alt={evento.nome} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Calendar className="w-12 h-12 text-gray-700" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md
                      ${evento.status === "Aberto" ? "bg-green-500/20 text-green-300 border-green-500/30" : 
                        "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}>
                      {evento.status}
                    </span>
                    {evento.publicar_mural && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md bg-purple-500/20 text-purple-300 border-purple-500/30">
                        <Megaphone className="w-3 h-3" /> No Mural
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 text-ohel-blue text-xs font-semibold mb-2">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatarData(evento.data_inicio)}
                    {evento.data_fim && ` até ${formatarData(evento.data_fim)}`}
                  </div>
                  
                  <h3 className="text-lg font-bold text-white mb-2 line-clamp-1">{evento.nome}</h3>
                  
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-4 line-clamp-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                    {evento.congregacoes?.nome || evento.cidade || "Local a definir"}
                  </div>

                  {/* BARRA DE PROGRESSO (SEMPRE VISÍVEL) */}
                  <div className="mb-4">
                    <div className="flex justify-between text-[11px] text-gray-400 mb-1.5">
                      <span>{inscritos} inscritos</span>
                      {limite > 0 ? (
                        <span className="font-medium text-gray-300">{percentual}% ({limite} vagas)</span>
                      ) : (
                        <span className="text-gray-500 italic">Sem limite de vagas</span>
                      )}
                    </div>
                    <div className="w-full bg-ohel-bg rounded-full h-1.5 border border-gray-800/50">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          limite > 0 ? "bg-ohel-blue" : "bg-gray-700/50"
                        }`}
                        style={{ width: `${limite > 0 ? percentual : 0}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-gray-800 flex items-center justify-between">
                    <button 
                      onClick={() => router.push(`/eventos/${evento.id}/inscricoes`)}
                      className="flex items-center gap-1.5 text-xs text-ohel-blue font-medium hover:text-white transition-colors bg-ohel-blue/10 px-3 py-1.5 rounded-full border border-ohel-blue/20"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      Gerenciar
                    </button>
                    
                    <div className="flex items-center gap-2">
                      <button onClick={() => router.push(`/eventos/editar/${evento.id}`)} className="p-1.5 text-gray-500 hover:text-ohel-blue hover:bg-ohel-blue/10 rounded transition-colors" title="Editar">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEventoToDelete(evento.id)} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {eventoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-white">Excluir Evento</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">Tem certeza que deseja excluir este evento? Todas as inscrições vinculadas a ele serão perdidas.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setEventoToDelete(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white" disabled={isDeleting}>Cancelar</button>
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