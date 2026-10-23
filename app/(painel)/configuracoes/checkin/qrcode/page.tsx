"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, QrCode as QrIcon, Smartphone } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import QRCode from "react-qr-code";
import { supabase } from "@/lib/supabase";

type TokenResponse = {
  token?: string;
  expiresAt?: string;
  error?: string;
};

export default function QrCodeCheckinPage() {
  const [urlCheckin, setUrlCheckin] = useState("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let requestingToken = false;

    const refreshToken = async () => {
      if (requestingToken) return;
      requestingToken = true;
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
        const response = await fetch("/api/checkin/qr-token", {
          method: "POST",
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          cache: "no-store",
        });
        const result = await response.json() as TokenResponse;
        if (!response.ok) throw new Error(result.error ?? "Não foi possível gerar o QR Code.");
        if (!result.token || !result.expiresAt) throw new Error("O servidor não retornou um QR Code válido.");
        const expiry = new Date(result.expiresAt).getTime();
        if (!Number.isFinite(expiry)) throw new Error("O servidor retornou uma validade inválida para o QR Code.");
        if (active) {
          setUrlCheckin(`${window.location.origin}/checkin?metodo=qr&token=${encodeURIComponent(result.token)}`);
          setExpiresAt(expiry);
          setNow(Date.now());
          setError("");
        }
      } catch (refreshError) {
        if (active) setError(refreshError instanceof Error ? refreshError.message : "Não foi possível atualizar o QR Code.");
      } finally {
        requestingToken = false;
        if (active) setLoading(false);
      }
    };

    void refreshToken();
    const refreshTimer = window.setInterval(() => void refreshToken(), 90_000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  const remainingSeconds = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0;
  const countdown = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;

  return (
    <div className="w-full min-h-screen bg-ohel-bg flex flex-col items-center py-8 relative">
      <div className="w-full max-w-lg flex justify-start items-center mb-8 px-4">
        <Link href="/configuracoes/checkin" className="flex items-center gap-2 text-gray-400 hover:text-white font-medium text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
      </div>

      <div className="w-full max-w-lg bg-[#080E1B] border border-gray-800 rounded-3xl p-10 flex flex-col items-center shadow-[0_0_50px_rgba(0,123,255,0.15)] print:shadow-none print:border-none print:bg-white print:text-black relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-ohel-blue/10 blur-[100px] rounded-full pointer-events-none print:hidden"></div>

        <div className="mb-8 scale-90 print:hidden">
          <Logo />
        </div>
        
        <div className="text-center mb-8 z-10">
          <h1 className="text-2xl font-bold text-white mb-2 uppercase tracking-wide">Check-in da igreja</h1>
          <p className="text-gray-400 text-sm">Mantenha esta tela aberta na recepção. O código muda automaticamente.</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-2xl mb-8 z-10">
          {urlCheckin && remainingSeconds > 0
            ? <QRCode value={urlCheckin} size={250} level="H" />
            : <div className="flex h-[250px] w-[250px] flex-col items-center justify-center gap-3 text-center text-gray-500">
              {loading ? <Loader2 className="h-7 w-7 animate-spin" /> : <QrIcon className="h-8 w-8" />}
              <span className="text-xs">{loading ? "Gerando código seguro…" : "Aguardando um novo código…"}</span>
            </div>}
        </div>

        <div className="flex items-center gap-3 bg-ohel-surface/50 border border-gray-800 px-6 py-4 rounded-xl w-full z-10 print:border-black print:bg-white">
          <Smartphone className="w-6 h-6 text-ohel-blue shrink-0 print:hidden" />
          <div>
            <p className="text-xs font-bold text-white">Código válido por até 2 minutos</p>
            <p className="text-[10px] text-gray-400">Próxima atualização em {countdown}. O link antigo deixa de funcionar após expirar.</p>
          </div>
        </div>

        {error && <p role="alert" className="mt-4 w-full rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
        <div className="mt-6 flex items-center gap-2 text-sky-300">
          <QrIcon className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">QR dinâmico de check-in</span>
        </div>
      </div>
    </div>
  );
}