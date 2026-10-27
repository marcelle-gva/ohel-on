"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { FileText, Printer, ArrowRight } from "lucide-react";

export default function GestaoCartasPage() {
  const [loading, setLoading] = useState(true);
  const [totalModelos, setTotalModelos] = useState(0);
  const [totalMembros, setTotalMembros] = useState(0);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("Sua sessão expirou. Entre novamente.");
        const { data: user, error: userError } = await supabase.from("usuarios").select("igreja_id").eq("id", session.user.id).maybeSingle();
        if (userError) throw userError;
        if (!user?.igreja_id) throw new Error("Não foi possível identificar a igreja do usuário.");
        const [modelosRes, membrosRes] = await Promise.all([
          supabase.from('modelos_cartas').select('*', { count: 'exact', head: true }).eq("igreja_id", user.igreja_id),
          supabase.from('membros').select('*', { count: 'exact', head: true }).eq("igreja_id", user.igreja_id)
        ]);

        if (modelosRes.error) throw modelosRes.error;
        if (membrosRes.error) throw membrosRes.error;
        setTotalModelos(modelosRes.count || 0);
        setTotalMembros(membrosRes.count || 0);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto pb-10">
      
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Gestão de Cartas</h1>
        <p className="text-gray-400 text-xs mt-0.5">        Crie modelos personalizados com variáveis dinâmicas, pré-visualize em A4 e encaminhe por WhatsApp ou e-mail.</p>
      </div>
      {loadError && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">{loadError}</p>}

      {/* Grid dos dois Cards Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
        
        {/* Card: Cartas Padrão */}
        <Link href="/secretaria/cartas/modelos" className="block outline-none h-full group">
          <Card className="p-8 h-full flex flex-col justify-between bg-ohel-surface border border-gray-800 transition-all duration-300 group-hover:border-ohel-blue/50 group-hover:bg-ohel-surface/80">
            
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-xl bg-ohel-blue/10 flex items-center justify-center text-ohel-blue group-hover:bg-ohel-blue group-hover:text-white transition-colors">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="bg-ohel-blue/10 text-ohel-blue text-xs font-bold px-3 py-1 rounded-full border border-ohel-blue/20">
                  {loading ? "-" : totalModelos} modelos
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Cartas Padrão</h2>
              <p className="text-sm text-gray-400 leading-relaxed mb-8">
                Cadastre, edite e configure modelos com editor rico, logotipo de cabeçalho, rodapé e inserção de variáveis dinâmicas por duplo clique.
              </p>
            </div>

            <div className="flex items-center text-ohel-blue font-semibold text-sm mt-4">
              Acessar Modelos <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </div>
          </Card>
        </Link>

        {/* Card: Impressão de Cartas */}
        <Link href="/secretaria/cartas/imprimir" className="block outline-none h-full group">
          <Card className="p-8 h-full flex flex-col justify-between bg-ohel-surface border border-gray-800 transition-all duration-300 group-hover:border-ohel-blue/50 group-hover:bg-ohel-surface/80">
            
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-xl bg-ohel-blue/10 flex items-center justify-center text-ohel-blue group-hover:bg-ohel-blue group-hover:text-white transition-colors">
                  <Printer className="w-6 h-6" />
                </div>
                <span className="bg-ohel-blue/10 text-ohel-blue text-xs font-bold px-3 py-1 rounded-full border border-ohel-blue/20">
                  {loading ? "-" : totalMembros} membros disponíveis
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Impressão de Cartas</h2>
              <p className="text-sm text-gray-400 leading-relaxed mb-8">
                Emita cartas personalizadas para membros, imprima em A4, envie texto por WhatsApp com consentimento ou encaminhe por e-mail a igrejas cadastradas.
              </p>
            </div>

            <div className="flex items-center text-ohel-blue font-semibold text-sm mt-4">
              Emitir Documentos <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </div>
          </Card>
        </Link>

      </div>
    </div>
  );
}