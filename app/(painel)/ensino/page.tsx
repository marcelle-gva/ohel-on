"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { BookOpen, Users, GraduationCap, CheckCircle, ArrowLeft, Settings, FileText } from "lucide-react";

export default function EnsinoHubPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ classes: 0, alunos: 0, professores: 0 });
  
  // Dados para os cards de acesso rápido
  const modulos = [
    { name: "Gestão de Classes", desc: "Crie turmas, defina professores e gerencie salas.", icon: GraduationCap, href: "/ensino/classes", color: "text-blue-400", bg: "bg-blue-500/10" },
    { name: "Matrículas de Alunos", desc: "Vincule membros e visitantes às classes da EBD.", icon: Users, href: "/ensino/matriculas", color: "text-green-400", bg: "bg-green-500/10" },
    { name: "Diário de Classe", desc: "Faça a chamada e registre a presença de cada aula.", icon: CheckCircle, href: "/ensino/diario", color: "text-purple-400", bg: "bg-purple-500/10" },
    { name: "Certificados EBD", desc: "Emita certificados de conclusão e participação.", icon: FileText, href: "/ensino/certificados", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  ];

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        const [classesRes, matriculasRes] = await Promise.all([
          supabase.from('ebd_classes').select('*', { count: 'exact', head: true }).eq('status', 'Ativa'),
          supabase.from('ebd_matriculas').select('*', { count: 'exact', head: true }).eq('status', 'Ativo')
        ]);
        
        setKpis({
          classes: classesRes.count || 0,
          alunos: matriculasRes.count || 0,
          professores: 0 // Será calculado futuramente puxando professores únicos
        });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchKpis();
  }, []);

  return (
    <div className="flex flex-col gap-5 w-full max-w-6xl mx-auto pb-10">
      
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 rounded-xl bg-ohel-blue flex items-center justify-center shadow-[0_0_15px_rgba(0,123,255,0.4)]">
          <BookOpen className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Ensino / Escola Bíblica</h1>
          <p className="text-gray-400 text-xs mt-0.5">Gestão das classes, professores e alunos da EBD.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 border-l-4 border-l-ohel-blue flex flex-col justify-between bg-ohel-surface border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Classes Ativas</p>
            <GraduationCap className="w-4 h-4 text-ohel-blue" />
          </div>
          <h2 className="text-3xl font-bold text-white">{loading ? "-" : kpis.classes}</h2>
        </Card>
        
        <Card className="p-5 border-l-4 border-l-green-500 flex flex-col justify-between bg-ohel-surface border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <p className="text-green-400 text-[10px] font-bold uppercase tracking-wider">Alunos Matriculados</p>
            <Users className="w-4 h-4 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-white">{loading ? "-" : kpis.alunos}</h2>
        </Card>

        <Card className="p-5 border-l-4 border-l-yellow-500 flex flex-col justify-between bg-ohel-surface border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <p className="text-yellow-400 text-[10px] font-bold uppercase tracking-wider">Professores</p>
            <BookOpen className="w-4 h-4 text-yellow-500" />
          </div>
          <h2 className="text-3xl font-bold text-white">{loading ? "-" : kpis.professores}</h2>
        </Card>
      </div>

      <h3 className="text-sm font-bold text-white mt-4 border-b border-gray-800 pb-2">Módulos do Ensino</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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