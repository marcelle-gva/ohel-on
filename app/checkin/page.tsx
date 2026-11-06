"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/brand/Logo";
import publicLayout from "@/components/public/public-layout.module.css";
import { CheckCircle2, MapPin, Loader2, AlertTriangle, Clock } from "lucide-react";

interface Membro {
  id: string;
  nome: string;
  igreja_id: string;
  departamento?: string | null;
}

export default function CheckinMembroPage() {
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [membro, setMembro] = useState<Membro | null>(null);
  
  const [status, setStatus] = useState<"inicial" | "sucesso" | "erro" | "fora_horario">("inicial");
  const [mensagem, setMensagem] = useState("");
  const [eventoCheckin, setEventoCheckin] = useState("");

  useEffect(() => {
    const carregarDados = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus("erro");
        setMensagem("Você precisa estar logado no aplicativo para fazer o check-in.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/membros/checkin", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
        const result = await response.json() as { membro?: Membro; error?: string };
        if (!response.ok || !result.membro) throw new Error(result.error || "Seu cadastro ainda não possui acesso ativo.");
        setMembro(result.membro);
      } catch (error) {
        setStatus("erro");
        setMensagem(error instanceof Error ? error.message : "Não foi possível conferir seu acesso.");
      } finally { setLoading(false); }
    };
    carregarDados();
  }, []);

  const realizarCheckin = () => {
    const membroAtual = membro;
    if (!membroAtual) return;
    setProcessando(true);
    setMensagem("Obtendo sua localização...");

    if (!navigator.geolocation) {
      setStatus("erro");
      setMensagem("Seu dispositivo não suporta geolocalização. Por favor, use o QR Code na recepção.");
      setProcessando(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
          const response = await fetch("/api/membros/checkin", {
            method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ latitude, longitude }),
          });
          const result = await response.json() as { ok?: boolean; status?: string; evento?: string; mensagem?: string; error?: string };
          if (!response.ok || !result.ok) throw new Error(result.error || "Não foi possível registrar sua presença.");
          setEventoCheckin(result.evento || "Check-in");
          setStatus(result.status === "Fora de Horário" ? "fora_horario" : "sucesso");
          setMensagem(result.mensagem || "Check-in registrado com sucesso.");
        } catch (error) {
          setStatus("erro");
          setMensagem(error instanceof Error ? error.message : "Erro ao processar o check-in. Tente novamente.");
        } finally {
          setProcessando(false);
        }
      },
      (error) => {
        setProcessando(false);
        setStatus("erro");
        if (error.code === error.PERMISSION_DENIED) {
          setMensagem("Você negou a localização. Vá até a recepção e escaneie o QR Code para fazer o check-in.");
        } else {
          setMensagem("Não foi possível obter sua localização.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  if (loading) {
    return (
      <main className={`${publicLayout.viewport} flex items-center justify-center bg-ohel-glow p-4`}>
        <p className="text-center text-gray-400" role="status" aria-live="polite">
          Carregando sistema...
        </p>
      </main>
    );
  }

  return (
    <main className={`${publicLayout.viewport} flex w-full flex-col items-center justify-start bg-ohel-glow px-4 py-6 sm:py-8`}>
      <div className="mb-6 shrink-0 scale-90">
        <Logo />
      </div>

      <Card className={`${publicLayout.panel} ${publicLayout.compact} w-full max-w-sm flex flex-col items-center text-center`}>
        
        {status === "inicial" && (
          <>
            <div className="w-20 h-20 rounded-full bg-ohel-blue/10 flex items-center justify-center mb-4">
              <MapPin className="w-10 h-10 text-ohel-blue" />
            </div>
            <h1 className="max-w-full break-words text-xl font-bold text-white mb-2">Bem-vindo, {membro?.nome.split(' ')[0]}!</h1>
            <p className="text-xs text-gray-400 mb-6">Para registrar sua presença, clique no botão abaixo.</p>
            <Button onClick={realizarCheckin} disabled={processando} className="w-full py-3 bg-ohel-blue hover:bg-blue-600 text-white font-bold">
              {processando ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processando...</> : "Fazer Check-in"}
            </Button>
            {processando && (
              <p className="mt-3 w-full break-words text-xs text-gray-400" role="status" aria-live="polite">
                {mensagem}
              </p>
            )}
          </>
        )}

        {status === "sucesso" && (
          <>
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-4 border border-green-500/30">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <div className="w-full" role="status" aria-live="polite" aria-atomic="true">
              <h1 className="max-w-full break-words text-xl font-bold text-white mb-2">Presença Confirmada!</h1>
              <p className="text-sm text-green-400 font-medium mb-2 break-words">{eventoCheckin}</p>
              <p className="text-xs text-gray-400 break-words">{mensagem}</p>
            </div>
            <p className="text-[10px] text-gray-500 mt-6">{new Date().toLocaleTimeString('pt-BR')}</p>
          </>
        )}

        {status === "fora_horario" && (
          <>
            <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4 border border-yellow-500/30">
              <Clock className="w-10 h-10 text-yellow-500" />
            </div>
            <div className="w-full" role="status" aria-live="polite" aria-atomic="true">
              <h1 className="max-w-full break-words text-xl font-bold text-white mb-2">Check-in Registrado</h1>
              <p className="text-xs text-gray-400 break-words">{mensagem}</p>
            </div>
            <p className="text-[10px] text-gray-500 mt-6">{new Date().toLocaleTimeString('pt-BR')}</p>
          </>
        )}

        {status === "erro" && (
          <>
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/30">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <div className="w-full" role="alert" aria-atomic="true">
              <h1 className="max-w-full break-words text-xl font-bold text-white mb-2">Atenção</h1>
              <p className="text-xs text-gray-400 break-words">{mensagem}</p>
            </div>
            <Button onClick={() => window.location.reload()} variant="secondary" className="mt-6 w-full py-2">
              Tentar Novamente
            </Button>
          </>
        )}

      </Card>
    </main>
  );
}
