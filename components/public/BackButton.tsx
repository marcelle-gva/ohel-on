"use client";

import { ArrowLeft } from "lucide-react";

export function BackButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) window.history.back();
        else window.location.href = "/";
      }}
      className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-gray-400 transition hover:bg-white/5 hover:text-cyan-200 sm:inline-flex"
      title="Voltar para a página anterior"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Voltar
    </button>
  );
}
