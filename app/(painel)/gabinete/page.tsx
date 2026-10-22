"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Church, CalendarDays, HeartPulse, BookOpen, MessageCircle } from "lucide-react";

export default function GabineteHubPage() {
  const modulos = [
    { 
      name: "Atendimentos Pastorais", 
      desc: "Agendamento de aconselhamentos, orações e visitas.", 
      icon: CalendarDays, 
      href: "/gabinete/atendimentos", 
      color: "text-blue-400", 
      bg: "bg-blue-500/10" 
    },
    { 
      name: "Acompanhamento Emocional", 
      desc: "Gestão de emoções e acolhimento da igreja.", 
      icon: HeartPulse, 
      href: "/gabinete/emocional", 
      color: "text-pink-400", 
      bg: "bg-pink-500/10" 
    },
    { 
      name: "Comunicações Pastorais", 
      desc: "Envio de mensagens segmentadas via WhatsApp.", 
      icon: MessageCircle, 
      href: "/gabinete/comunicacoes", 
      color: "text-green-400", 
      bg: "bg-green-500/10" 
    },
    { 
      name: "Banco de Sermões", 
      desc: "Esboços, séries, links de áudio e vídeo.", 
      icon: BookOpen, 
      href: "/gabinete/sermoes", 
      color: "text-yellow-400", 
      bg: "bg-yellow-500/10" 
    },
  ];

  return (
    <div className="flex flex-col gap-5 w-full max-w-6xl mx-auto pb-10">
      
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 rounded-xl bg-ohel-blue flex items-center justify-center shadow-[0_0_15px_rgba(0,123,255,0.4)]">
          <Church className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Gabinete Pastoral</h1>
          <p className="text-gray-400 text-xs mt-0.5">Gestão do cuidado, aconselhamento e acompanhamento da igreja.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modulos.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link key={mod.name} href={mod.href} className="block outline-none h-full">
              <Card className="p-6 flex flex-col h-full bg-ohel-surface border border-gray-800 transition-all duration-300 hover:scale-[1.02] hover:border-ohel-blue/50 group">
                <div className={`w-12 h-12 rounded-xl ${mod.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-6 h-6 ${mod.color}`} />
                </div>
                <h4 className="text-base font-bold text-white mb-1">{mod.name}</h4>
                <p className="text-xs text-gray-400 leading-relaxed">{mod.desc}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}