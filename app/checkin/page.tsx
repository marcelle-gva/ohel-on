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

// Função matemática para calcular a distância em metros (Fórmula de Haversine)
function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Raio da Terra em metros
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Retorna a distância em metros
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

      // Busca os dados do membro
      const { data: membroData } = await supabase.from('membros').select('*, igrejas(*)').eq('email', session.user.email).maybeSingle();
      
      if (!membroData) {
        setStatus("erro");
        setMensagem("Seu e-mail não está vinculado a um cadastro de membro. Procure a secretaria.");
        setLoading(false);
        return;
      }
      
      setMembro(membroData as Membro);
      setLoading(false);
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
          
          // 1. Busca a configuração dos eventos e a hora do servidor
          const { data: configs } = await supabase.from('config_checkin').select('*').eq('igreja_id', membroAtual.igreja_id);
          
          // Pega a hora atual do servidor para evitar fraudes
          const { data: serverTime } = await supabase.rpc('get_server_time'); 
          const agora = new Date(serverTime || new Date());
          const horaAtual = agora.getHours() * 60 + agora.getMinutes(); // Hora em minutos

          let eventoAtual = null;
          let statusCheckin = "Normal";
          let obs = "";

          // 2. Verifica qual evento está acontecendo agora
          if (configs) {
            for (const conf of configs) {
              const [hIni, mIni] = conf.horario_inicio.split(':').map(Number);
              const [hFim, mFim] = conf.horario_fim.split(':').map(Number);
              const minIni = hIni * 60 + mIni;
              const minFim = hFim * 60 + mFim;

              if (horaAtual >= minIni && horaAtual <= minFim) {
                eventoAtual = conf;
                
                // Validação de Elegibilidade para Louvor
                if (conf.nome_evento.includes('Louvor') && !membroAtual.departamento?.toLowerCase().includes('louvor')) {
                  obs = "Tentou check-in no louvor sem estar no ministério.";
                }
                break;
              }
            }
          }

          // 3. Define o status se for fora do horário
          if (!eventoAtual) {
            statusCheckin = "Fora de Horário";
            setEventoCheckin("Fora de Horário");
            setStatus("fora_horario");
            setMensagem("Não há eventos acontecendo neste horário, mas seu check-in foi registrado e o Pastor será notificado.");
          } else {
            setEventoCheckin(eventoAtual.nome_evento);
            setStatus("sucesso");
            setMensagem(`Check-in realizado com sucesso no ${eventoAtual.nome_evento}!`);
          }

          // 4. Calcula a distância (apenas para registrar no banco se estava perto)
          const confDistancia = configs?.[0]; // Pega as coordenações da igreja
          let distancia = -1;
          if (confDistancia) {
            distancia = calcularDistancia(latitude, longitude, confDistancia.latitude_igreja, confDistancia.longitude_igreja);
            
            // Se estiver muito longe, avisa
            if (distancia > confDistancia.raio_metros && statusCheckin === "Normal") {
               obs += ` (Fora do raio de ${confDistancia.raio_metros}m. Distância: ${distancia.toFixed(0)}m)`;
            }
          }

          // 5. Salva no banco
          await supabase.from('checkins').insert([{
            igreja_id: membroAtual.igreja_id,
            membro_id: membroAtual.id,
            tipo_evento: eventoAtual ? eventoAtual.nome_evento : "Geral",
            metodo: 'GPS',
            latitude,
            longitude,
            status: statusCheckin,
            observacao: obs
          }]);

        } catch {
          setStatus("erro");
          setMensagem("Erro ao processar o check-in. Tente novamente.");
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
