"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, QrCode as QrIcon, Smartphone } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import QRCode from "react-qr-code";

export default function QrCodeCheckinPage() {
  const [urlCheckin, setUrlCheckin] = useState("");

  useEffect(() => {
    // Pega a URL base do sistema (funciona local e em produção)
    if (typeof window !== "undefined") {
      setUrlCheckin(`${window.location.origin}/checkin`);
    }
  }, []);

  return (
    <div className="w-full min-h-screen bg-ohel-bg flex flex-col items-center py-8 relative">
      
      {/* Botões do Topo (Somem na impressão) */}
      <div className="w-full max-w-lg flex justify-between items-center mb-8 print:hidden px-4">
        <Link href="/configuracoes/checkin" className="flex items-center gap-2 text-gray-400 hover:text-white font-medium text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <button onClick={() => window.print()} className="bg-ohel-blue hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg transition-colors">
          <Printer className="w-4 h-4" /> Imprimir Cartaz
        </button>
      </div>

      {/* O Cartaz / Totem de Check-in */}
      <div className="w-full max-w-lg bg-[#080E1B] border border-gray-800 rounded-3xl p-10 flex flex-col items-center shadow-[0_0_50px_rgba(0,123,255,0.15)] print:shadow-none print:border-none print:bg-white print:text-black relative overflow-hidden">
        
        {/* Efeito de fundo do cartaz */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-ohel-blue/10 blur-[100px] rounded-full pointer-events-none print:hidden"></div>

        {/* Cabeçalho do Cartaz */}
        <div className="mb-8 scale-90 print:hidden">
          <Logo />
        </div>
        
        <div className="text-center mb-8 z-10">
          <h1 className="text-2xl font-bold text-white mb-2 uppercase tracking-wide print:text-black">Faça seu Check-in</h1>
          <p className="text-gray-400 text-sm print:text-gray-600">Aponte a câmera do seu celular para o código abaixo para registrar sua presença.</p>
        </div>

        {/* QR Code */}
        <div className="bg-white p-6 rounded-2xl shadow-2xl mb-8 z-10">
          {urlCheckin && <QRCode value={urlCheckin} size={250} level="H" />}
        </div>

        {/* Instruções */}
        <div className="flex items-center gap-3 bg-ohel-surface/50 border border-gray-800 px-6 py-4 rounded-xl w-full z-10 print:border-black print:bg-white">
          <Smartphone className="w-6 h-6 text-ohel-blue shrink-0 print:hidden" />
          <div>
            <p className="text-xs font-bold text-white print:text-black">Já tem o aplicativo?</p>
            <p className="text-[10px] text-gray-400 print:text-gray-600">Abra o app OHEL ON e clique em "Fazer Check-in".</p>
          </div>
        </div>

        {/* Rodapé do Cartaz */}
        <div className="mt-10 flex items-center gap-2 text-ohel-blue z-10">
          <QrIcon className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Check-in Rápido e Seguro</span>
        </div>

      </div>
    </div>
  );
}