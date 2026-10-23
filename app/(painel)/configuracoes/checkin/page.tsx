"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, MapPin, Clock, CalendarDays, QrCode as QrIcon } from "lucide-react";
import Link from "next/link";

type CheckinEvent = {
  id: string;
  nome_evento: string;
  horario_inicio: string;
  horario_fim: string;
  latitude_igreja: string;
  longitude_igreja: string;
  raio_metros: string;
};

export default function ConfigCheckinPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [eventos, setEventos] = useState<CheckinEvent[]>([]);
  const [fusoHorario, setFusoHorario] = useState("America/Sao_Paulo");
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("Entre novamente para configurar o check-in.");
        const { data: user, error: userError } = await supabase
          .from("usuarios")
          .select("igreja_id")
          .eq("id", session.user.id)
          .maybeSingle();
        if (userError) throw userError;
        if (!user?.igreja_id) throw new Error("Não foi possível identificar a igreja deste usuário.");
        setIgrejaId(user.igreja_id);
        const [eventsResult, timezoneResult] = await Promise.all([
          supabase.from("config_checkin").select("*").eq("igreja_id", user.igreja_id).order("horario_inicio"),
          supabase.from("config_checkin_fusos").select("fuso_horario").eq("igreja_id", user.igreja_id).maybeSingle(),
        ]);
        if (eventsResult.error) throw eventsResult.error;
        if (timezoneResult.error) throw timezoneResult.error;
        setEventos((eventsResult.data ?? []).map(evento => ({
          id: evento.id,
          nome_evento: evento.nome_evento,
          horario_inicio: evento.horario_inicio,
          horario_fim: evento.horario_fim,
          latitude_igreja: evento.latitude_igreja == null ? "" : String(evento.latitude_igreja),
          longitude_igreja: evento.longitude_igreja == null ? "" : String(evento.longitude_igreja),
          raio_metros: evento.raio_metros == null ? "" : String(evento.raio_metros),
        })));
        setFusoHorario(timezoneResult.data?.fuso_horario ?? "America/Sao_Paulo");
        setLoading(false);
      } catch (error) {
        setModal({
          isOpen: true,
          type: "error",
          title: "Erro",
          message: error instanceof Error ? error.message : "Não foi possível carregar as configurações.",
        });
        setLoading(false);
      }
    };
    void init();
  }, []);

  const handleUpdateEvento = <K extends keyof CheckinEvent>(index: number, field: K, value: CheckinEvent[K]) => {
    const novosEventos = [...eventos];
    novosEventos[index] = { ...novosEventos[index], [field]: value };
    setEventos(novosEventos);
  };

  const handleSalvar = async () => {
    if (!igrejaId) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Não foi possível identificar a igreja." });
      return;
    }
    setSaving(true);
    try {
      const normalizedTimezone = fusoHorario.trim();
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: normalizedTimezone });
      } catch {
        throw new Error("Informe um fuso horário IANA válido, por exemplo America/Sao_Paulo.");
      }

      const { data: savedTimezone, error: timezoneError } = await supabase
        .from("config_checkin_fusos")
        .upsert({ igreja_id: igrejaId, fuso_horario: normalizedTimezone }, { onConflict: "igreja_id" })
        .select("igreja_id")
        .maybeSingle();
      if (timezoneError) throw timezoneError;
      if (!savedTimezone) throw new Error("O fuso horário não foi confirmado pelo banco.");

      const results = await Promise.all(eventos.map(evento =>
        supabase.from("config_checkin").update({
          nome_evento: evento.nome_evento,
          horario_inicio: evento.horario_inicio,
          horario_fim: evento.horario_fim,
          latitude_igreja: parseFloat(evento.latitude_igreja),
          longitude_igreja: parseFloat(evento.longitude_igreja),
          raio_metros: parseInt(evento.raio_metros)
        }).eq("id", evento.id).select("id").maybeSingle(),
      ));
      const failedUpdate = results.find(result => result.error || !result.data);
      if (failedUpdate?.error) throw failedUpdate.error;
      if (failedUpdate) throw new Error("Uma das configurações não foi confirmada pelo banco.");

      setFusoHorario(normalizedTimezone);
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Configurações de check-in atualizadas!" });
    } catch (error) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Erro",
        message: error instanceof Error ? error.message : "Não foi possível salvar as configurações.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando configurações...</div>;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      {/* CABEÇALHO COM OS BOTÕES */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Link href="/configuracoes" className="text-gray-400 hover:text-white transition-colors mt-0.5">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <MapPin className="w-5 h-5 text-ohel-blue" /> Configuração do Check-in
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Defina o fuso horário, os horários e o raio de geolocalização.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Link 
            href="/configuracoes/checkin/qrcode" 
            className="bg-ohel-surface border border-gray-700 hover:border-ohel-blue text-white px-4 py-2 rounded-md font-medium text-xs flex items-center gap-2 transition-colors"
          >
            <QrIcon className="w-3.5 h-3.5" /> Ver QR Code
          </Link>

          <Button 
            variant="primary" 
            onClick={handleSalvar} 
            disabled={saving} 
            className="w-auto px-6 py-2 text-xs"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" /> 
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <Card className="border-gray-800 bg-ohel-surface p-5">
        <Input
          label="Fuso horário da igreja (IANA)"
          value={fusoHorario}
          onChange={event => setFusoHorario(event.target.value)}
          placeholder="America/Sao_Paulo"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="mt-2 text-[10px] text-gray-500">
          Use o identificador IANA da cidade, por exemplo America/Sao_Paulo, America/Manaus ou America/Noronha.
        </p>
      </Card>

      {/* AVISO EXPLICATIVO COM DESTAQUES */}
      <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl mb-2">
        <p className="text-xs text-blue-400 leading-relaxed">
          <strong className="text-blue-300">Como funciona:</strong> O membro fará o check-in pelo celular. O sistema usa a hora do servidor no fuso horário desta igreja e a localização do GPS. Se estiver dentro do raio e no horário do evento, a presença é marcada como <strong className="text-green-400">Normal</strong>. Se estiver fora do horário, será marcada como <strong className="text-yellow-400">Fora de Horário</strong> para o pastor analisar.
        </p>
      </div>

      {/* LISTA DE EVENTOS */}
      <div className="flex flex-col gap-4">
        {eventos.map((evento, index) => (
          <Card key={evento.id} className="p-5 border-gray-800 bg-ohel-surface flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-ohel-blue" /> {evento.nome_evento}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              
              <div>
                <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider mb-1.5 block">Início</label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
                  <input 
                    type="time" 
                    value={evento.horario_inicio}
                    onChange={(e) => handleUpdateEvento(index, 'horario_inicio', e.target.value)}
                    className="input-ohel w-full pl-9 pr-3 py-2 rounded-md text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider mb-1.5 block">Término</label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
                  <input 
                    type="time" 
                    value={evento.horario_fim}
                    onChange={(e) => handleUpdateEvento(index, 'horario_fim', e.target.value)}
                    className="input-ohel w-full pl-9 pr-3 py-2 rounded-md text-xs"
                  />
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Latitude</label>
                <Input 
                  value={evento.latitude_igreja} 
                  onChange={(e) => handleUpdateEvento(index, 'latitude_igreja', e.target.value)}
                  className="py-2 text-xs" 
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Longitude</label>
                <Input 
                  value={evento.longitude_igreja} 
                  onChange={(e) => handleUpdateEvento(index, 'longitude_igreja', e.target.value)}
                  className="py-2 text-xs" 
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider mb-1 block">Raio de Tolerância (metros)</label>
                <Input 
                  type="number"
                  value={evento.raio_metros} 
                  onChange={(e) => handleUpdateEvento(index, 'raio_metros', e.target.value)}
                  className="py-2 text-xs" 
                />
                <p className="text-[9px] text-gray-500 mt-1">Recomendado: 25 a 30 metros (precisão do GPS).</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}