"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, Plus, Search, GraduationCap, MapPin, Clock, User, Users } from "lucide-react";

export default function ClassesEbdPage() {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    setLoading(true);
    // Busca as classes, o nome do professor (join) e a contagem de alunos (via foreign table)
    const { data } = await supabase
      .from('ebd_classes')
      .select(`
        *,
        membros (nome),
        ebd_matriculas (count)
      `)
      .order('nome');
    
    if (data) setClasses(data);
    setLoading(false);
  };

  const classesFiltradas = classes.filter(c => 
    c.nome.toLowerCase().includes(busca.toLowerCase()) || 
    (c.faixa_etaria && c.faixa_etaria.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-5 pb-10">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/ensino" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-ohel-blue" /> Gestão de Classes (EBD)
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Gerencie as turmas, salas e professores da Escola Bíblica.</p>
          </div>
        </div>
        <Link href="/ensino/classes/nova" className="w-auto px-5 py-2 text-xs bg-ohel-blue hover:bg-blue-600 text-white rounded-md flex items-center gap-2 font-medium transition-colors shadow-[0_0_15px_rgba(0,123,255,0.2)]">
          <Plus className="w-3.5 h-3.5" /> Nova Classe
        </Link>
      </div>

      <Card className="p-3 flex flex-col lg:flex-row gap-3 items-center bg-ohel-surface/50 border-gray-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
          <input 
            type="text" 
            placeholder="Buscar por nome da classe ou faixa etária..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-ohel-bg border border-gray-700 text-xs text-white rounded-md pl-9 pr-3 py-2 focus:border-ohel-blue outline-none"
          />
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Carregando classes...</div>
      ) : classesFiltradas.length === 0 ? (
        <Card className="p-10 flex flex-col items-center justify-center text-center">
          <GraduationCap className="w-10 h-10 text-gray-600 mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">Nenhuma classe cadastrada</h3>
          <p className="text-gray-400 text-xs">Clique em "Nova Classe" para criar a primeira turma da EBD.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classesFiltradas.map((classe) => (
            <Card key={classe.id} className="p-5 flex flex-col bg-ohel-surface border-gray-800 hover:border-ohel-blue/50 transition-colors group">
              
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-lg bg-ohel-blue/10 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-ohel-blue" />
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${classe.status === 'Ativa' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                  {classe.status}
                </span>
              </div>

              <h3 className="text-base font-bold text-white mb-1">{classe.nome}</h3>
              <p className="text-[11px] text-ohel-blue font-medium mb-4">{classe.faixa_etaria || "Faixa etária não definida"}</p>
              
              <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-gray-800/50">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Professor:</span>
                  <span className="text-gray-200 font-medium">{classe.membros?.nome || "Não definido"}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Sala:</span>
                  <span className="text-gray-200 font-medium">{classe.sala || "-"}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Horário:</span>
                  <span className="text-gray-200 font-medium">{classe.horario || "-"}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Alunos:</span>
                  <span className="bg-ohel-bg px-2 py-0.5 rounded text-white font-bold">{classe.ebd_matriculas?.[0]?.count || 0}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Link href={`/ensino/classes/editar/${classe.id}`} className="flex-1 py-2 bg-ohel-bg border border-gray-700 hover:border-ohel-blue text-center text-[11px] text-gray-300 hover:text-white rounded transition-colors">
                  Editar Classe
                </Link>
                <Link href={`/ensino/matriculas?classe=${classe.id}`} className="flex-1 py-2 bg-ohel-blue/10 border border-ohel-blue/30 hover:bg-ohel-blue text-center text-[11px] text-ohel-blue hover:text-white rounded transition-colors">
                  Ver Alunos
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}