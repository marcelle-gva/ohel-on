"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/brand/Logo";
import { CheckCircle2, MapPin, Loader2, AlertTriangle, Clock } from "lucide-react";

interface MembroCheckin {
  id: string;
  igreja_id: string;
  nome: string;
}

export default function CheckinMembroPage() {
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [membro, setMembro] = useState<MembroCheckin | null>(null);
  
  const [status, setStatus] = useState<"inicial" | "sucesso" | "erro" | "fora_horario">("inicial");
  const [mensagem, setMensagem] = useState("");
  const [eventoCheckin, setEventoCheckin] = useState("");
  const [metodo, setMetodo] = useState<"GPS" | "QR Code">("GPS");
  const [qrToken, setQrToken] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const query = new URLSearchParams(window.location.search);
      setMetodo(query.get("metodo") === "qr" ? "QR Code" : "GPS");
      setQrToken(query.get("token") ?? "");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const carregarDados = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setStatus("erro");
        setMensagem("Não foi possível validar sua sessão. Entre novamente no aplicativo.");
        setLoading(false);
        return;
      }
      if (!session) {
        setStatus("erro");
        setMensagem("Você precisa estar logado no aplicativo para fazer o check-in.");
        setLoading(false);
        return;
      }

      // Busca os dados do membro
      const { data: membroData, error: membroError } = await supabase
        .from('membros')
        .select('id, igreja_id, nome')
        .eq('email', session.user.email)
        .maybeSingle();
      if (membroError) {
        setStatus("erro");
        setMensagem("Não foi possível carregar seu cadastro. Tente novamente.");
        setLoading(false);
        return;
      }
      
      if (!membroData) {
        setStatus("erro");
        setMensagem("Seu e-mail não está vinculado a um cadastro de membro. Procure a secretaria.");
        setLoading(false);
        return;
      }
      
      setMembro(membroData);
      setLoading(false);
    };
    const timeoutId = window.setTimeout(() => {
      void carregarDados();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const salvarCheckin = async (coordenadas?: Pick<GeolocationCoordinates, "latitude" | "longitude">) => {
    const membroAtual = membro;
    if (!membroAtual) {
      setStatus("erro");
      setMensagem("Não foi possível validar seu cadastro de membro.");
      return;
    }

    setProcessando(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch("/api/checkin/confirm", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: membroAtual.id,
          method: metodo,
          token: metodo === "QR Code" ? qrToken : undefined,
          latitude: coordenadas?.latitude,
          longitude: coordenadas?.longitude,
        }),
      });
      const result = await response.json() as {
        error?: string;
        eventName?: string;
        status?: "Normal" | "Fora de Horário";
      };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível registrar o check-in.");
      if (!result.status) throw new Error("O servidor não confirmou o status do check-in.");

      setEventoCheckin(result.eventName ?? "Fora de Horário");
      setStatus(result.status === "Normal" ? "sucesso" : "fora_horario");
      setMensagem(result.status === "Normal"
        ? `Check-in registrado com sucesso por ${metodo}.`
        : "Não há evento acontecendo neste horário. Seu check-in foi registrado.");
    } catch (error) {
      console.error("Falha ao registrar check-in:", error);
      setStatus("erro");
      setMensagem(error instanceof Error
        ? `Não foi possível registrar o check-in: ${error.message}`
        : "Não foi possível registrar o check-in. Tente novamente.");
    } finally {
      setProcessando(false);
    }
  };

  const realizarCheckin = () => {
    if (metodo === "QR Code") {
      if (!qrToken) {
        setStatus("erro");
        setMensagem("QR Code inválido ou expirado. Escaneie o código atualizado na recepção.");
        return;
      }
      void salvarCheckin();
      return;
    }

    setProcessando(true);
    setMensagem("Obtendo sua localização...");

    if (!navigator.geolocation) {
      setStatus("erro");
      setMensagem("Seu dispositivo não suporta geolocalização. Use o QR Code na recepção.");
      setProcessando(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        void salvarCheckin(position.coords);
      },
      error => {
        setProcessando(false);
        setStatus("erro");
        setMensagem(error.code === error.PERMISSION_DENIED
          ? "Você negou a localização. Escaneie o QR Code na recepção para fazer o check-in."
          : "Não foi possível obter sua localização.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando sistema...</div>;

  return (
    <div className="w-full h-screen bg-ohel-glow flex flex-col items-center justify-center p-4">
      <div className="mb-6 scale-90">
        <Logo />
      </div>

      <Card className="w-full max-w-sm p-8 flex flex-col items-center text-center">
        
        {status === "inicial" && (
          <>
            <div className="w-20 h-20 rounded-full bg-ohel-blue/10 flex items-center justify-center mb-4">
              <MapPin className="w-10 h-10 text-ohel-blue" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Bem-vindo, {membro?.nome.split(' ')[0]}!</h2>
            <p className="text-xs text-gray-400 mb-6">
              {metodo === "QR Code"
                ? "Confirme para registrar sua presença usando o QR Code da igreja."
                : "Para registrar sua presença por GPS, clique no botão abaixo."}
            </p>
            <Button onClick={realizarCheckin} disabled={processando} className="w-full py-3 bg-ohel-blue hover:bg-blue-600 text-white font-bold">
              {processando
                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processando...</>
                : metodo === "QR Code" ? "Fazer Check-in por QR Code" : "Fazer Check-in por GPS"}
            </Button>
          </>
        )}

        {status === "sucesso" && (
          <>
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-4 border border-green-500/30">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Presença Confirmada!</h2>
            <p className="text-sm text-green-400 font-medium mb-2">{eventoCheckin}</p>
            <p className="text-xs text-gray-400">{mensagem}</p>
            <p className="text-[10px] text-gray-500 mt-6">{new Date().toLocaleTimeString('pt-BR')}</p>
          </>
        )}

        {status === "fora_horario" && (
          <>
            <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4 border border-yellow-500/30">
              <Clock className="w-10 h-10 text-yellow-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Check-in Registrado</h2>
            <p className="text-xs text-gray-400">{mensagem}</p>
            <p className="text-[10px] text-gray-500 mt-6">{new Date().toLocaleTimeString('pt-BR')}</p>
          </>
        )}

        {status === "erro" && (
          <>
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/30">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Atenção</h2>
            <p className="text-xs text-gray-400">{mensagem}</p>
            <Button onClick={() => window.location.reload()} variant="secondary" className="mt-6 w-full py-2">
              Tentar Novamente
            </Button>
          </>
        )}

      </Card>
    </div>
  );
}