"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, User, Droplets, UserPlus, Baby, UserCheck, FileText } from "lucide-react";

export default function FichasCadastroPage() {
  const fichas = [
    {
      id: "membro",
      titulo: "Ficha de Cadastro de Membro",
      descricao: "Formulário completo para cadastro de novos membros com todos os dados pessoais, histórico eclesiástico, filiação, dados eclesiásticos e documentos.",
      icone: UserCheck,
      corTexto: "text-blue-400",
      corBg: "bg-blue-500/10",
      corHover: "hover:border-blue-500/50",
      link: "/secretaria/fichas/imprimir/membro"
    },
    {
      id: "batismo",
      titulo: "Ficha de Candidato ao Batismo",
      descricao: "Formulário para inscrição e cadastro de candidatos ao batismo nas águas, com histórico eclesiástico, discipulado e termo de fé.",
      icone: Droplets,
      corTexto: "text-cyan-400",
      corBg: "bg-cyan-500/10",
      corHover: "hover:border-cyan-500/50",
      link: "/secretaria/fichas/imprimir/batismo"
    },
    {
      id: "congregado",
      titulo: "Ficha de Congregado",
      descricao: "Formulário simplificado para cadastro de congregados com dados pessoais, endereço e informações eclesiásticas básicas.",
      icone: User,
      corTexto: "text-green-400",
      corBg: "bg-green-500/10",
      corHover: "hover:border-green-500/50",
      link: "/secretaria/fichas/imprimir/congregado"
    },
    {
      id: "visitante",
      titulo: "Ficha de Visitante",
      descricao: "Formulário ágil para registro de visitantes com dados essenciais, endereço e data da visita.",
      icone: UserPlus,
      corTexto: "text-purple-400",
      corBg: "bg-purple-500/10",
      corHover: "hover:border-purple-500/50",
      link: "/secretaria/fichas/imprimir/visitante"
    },
    {
      id: "crianca",
      titulo: "Ficha de Crianças (Infantil)",
      descricao: "Formulário especializado para cadastro infantil com dados da criança, pais, responsáveis autorizados e ficha de saúde/alergias.",
      icone: Baby,
      corTexto: "text-pink-400",
      corBg: "bg-pink-500/10",
      corHover: "hover:border-pink-500/50",
      link: "/secretaria/fichas/imprimir/crianca"
    }
  ];

  return (
    <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto pb-10">
      
      {/* Cabeçalho */}
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 rounded-xl bg-ohel-blue flex items-center justify-center shadow-[0_0_15px_rgba(0,123,255,0.4)]">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Fichas de Cadastro</h1>
          <p className="text-gray-400 text-xs mt-0.5">Selecione o modelo de ficha para imprimir.</p>
        </div>
      </div>

      {/* Grid de Fichas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {fichas.map((ficha) => {
          const Icon = ficha.icone;
          
          return (
            <Link key={ficha.id} href={ficha.link} className="block outline-none h-full">
              <Card className={`p-5 flex flex-col h-full bg-ohel-surface border border-gray-800 transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:bg-ohel-surface/80 ${ficha.corHover}`}>
                
                <div className={`w-10 h-10 rounded-lg ${ficha.corBg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-5 h-5 ${ficha.corTexto}`} />
                </div>
                
                <h3 className="text-sm font-bold text-white mb-2 leading-tight">
                  {ficha.titulo}
                </h3>
                
                <p className="text-[11px] text-gray-400 leading-relaxed flex-1">
                  {ficha.descricao}
                </p>
                
                <div className="mt-4 pt-3 border-t border-gray-800/50 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Imprimir</span>
                  <ArrowLeft className="w-3.5 h-3.5 text-gray-500 rotate-180" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}