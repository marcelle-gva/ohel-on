"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, Plus, Search, BookOpen, PlayCircle, Headphones, Calendar, ExternalLink, Edit } from "lucide-react";

interface Sermao {
  id: string;
  titulo: string;
  tema: string;
  referencia_biblica: string;
  pastor: string;
  data_pregacao: string;
  link_video: string;
  link_audio: string;
}

export default function SermoesPage() {
  const [loading, setLoading] = useState(true);
  const [sermoes, setSermoes] = useState<Sermao[]>([]);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    fetchSermoes();
  }, []);

  const fetchSermoes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('sermoes')
      .select('*')
      .order('data_pregacao', { ascending: false });
    
    if (data) setSermoes(data as Sermao[]);
    setLoading(false);
  };

  const sermoesFiltrados = sermoes.filter(s => 
    s.titulo.toLowerCase().includes(busca.toLowerCase()) || 
    (s.tema && s.tema.toLowerCase().includes(busca.toLowerCase())) ||
    (s.pastor && s.pastor.toLowerCase().includes(busca.toLowerCase()))
  );

  const formatarData = (dataStr: string) => {
    if (!dataStr) return "-";
    return new Date(`${dataStr}T12:00:00`).toLocaleDateString('pt-BR');
  };

  // Função que gera o link da Bíblia Online
  const getBibleLink = (referencia: string) => {
    if (!referencia) return "#";
    return `https://www.bibliaonline.com.br/busca?q=${encodeURIComponent(referencia)}`;
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-5 pb-10">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/gabinete" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-ohel-blue" /> Banco de Sermões
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Biblioteca de esboços, pregações e estudos da igreja.</p>
          </div>
        </div>
        <Link href="/gabinete/sermoes/novo" className="w-auto px-5 py-2 text-xs bg-ohel-blue hover:bg-blue-600 text-white rounded-md flex items-center gap-2 font-medium transition-colors shadow-[0_0_15px_rgba(0,123,255,0.2)]">
          <Plus className="w-3.5 h-3.5" /> Novo Sermão
        </Link>
      </div>

      <Card className="p-3 flex flex-col lg:flex-row gap-3 items-center bg-ohel-surface/50 border-gray-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
          <input 
            type="text" 
            placeholder="Buscar por título, tema ou pastor..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-ohel-bg border border-gray-700 text-xs text-white rounded-md pl-9 pr-3 py-2 focus:border-ohel-blue outline-none"
          />
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Carregando sermões...</div>
      ) : sermoesFiltrados.length === 0 ? (
        <Card className="p-10 flex flex-col items-center justify-center text-center">
          <BookOpen className="w-10 h-10 text-gray-600 mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">Nenhum sermão cadastrado</h3>
          <p className="text-gray-400 text-xs">Clique em "Novo Sermão" para adicionar o primeiro esboço.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sermoesFiltrados.map((sermao) => (
            <Card key={sermao.id} className="p-5 flex flex-col bg-ohel-surface border-gray-800 hover:border-ohel-blue/50 transition-colors group">
              
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2 text-[10px] text-ohel-blue bg-ohel-blue/10 px-2 py-1 rounded font-bold uppercase tracking-wider">
                  <Calendar className="w-3 h-3" /> {formatarData(sermao.data_pregacao)}
                </div>
                <div className="flex gap-2">
                  {sermao.link_video && (
                    <a href={sermao.link_video} target="_blank" className="text-red-500 hover:text-red-400 bg-red-500/10 p-1.5 rounded" title="Assistir Vídeo">
                      <PlayCircle className="w-4 h-4" />
                    </a>
                  )}
                  {sermao.link_audio && (
                    <a href={sermao.link_audio} target="_blank" className="text-green-500 hover:text-green-400 bg-green-500/10 p-1.5 rounded" title="Ouvir Áudio">
                      <Headphones className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              <h3 className="text-base font-bold text-white mb-1 leading-tight">{sermao.titulo}</h3>
              <p className="text-[11px] text-gray-400 mb-3">{sermao.tema || "Sem tema definido"}</p>
              
              <div className="mt-auto pt-3 border-t border-gray-800/50 flex flex-col gap-1">
                <p className="text-[11px] text-gray-500 flex items-center gap-1">
                  <strong className="text-gray-300">Base:</strong> 
                  {sermao.referencia_biblica ? (
                    <a href={getBibleLink(sermao.referencia_biblica)} target="_blank" className="text-ohel-blue hover:underline flex items-center gap-1">
                      {sermao.referencia_biblica} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : "-"}
                </p>
                <p className="text-[11px] text-gray-500"><strong className="text-gray-300">Preletor:</strong> {sermao.pastor || "-"}</p>
              </div>
              
              <Link href={`/gabinete/sermoes/editar/${sermao.id}`} className="mt-4 w-full py-2 bg-ohel-bg border border-gray-700 hover:border-ohel-blue text-center text-xs text-gray-300 hover:text-white rounded transition-colors flex items-center justify-center gap-2">
                <Edit className="w-3.5 h-3.5" /> Ler / Editar Esboço
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}