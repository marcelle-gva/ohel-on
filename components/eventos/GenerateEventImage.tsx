"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Sparkles } from "lucide-react";

type Props = {
  eventName: string;
  onImageReady: (url: string) => void;
};

export function GenerateEventImage({ eventName, onImageReady }: Props) {
  const [direction, setDirection] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setGenerating(true);
    setError("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch("/api/eventos/gerar-imagem", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionData.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ eventName, direction }),
      });
      const result = await response.json() as { imageBase64?: string; mimeType?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível gerar a imagem.");
      if (!result.imageBase64 || result.mimeType !== "image/png") throw new Error("A API não retornou uma imagem PNG válida.");

      const binary = atob(result.imageBase64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const file = new File([bytes], `evento-ia-${Date.now()}.png`, { type: "image/png" });
      const path = `evento-ia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      const { error: uploadError } = await supabase.storage.from("cartazes").upload(path, file, {
        contentType: "image/png",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("cartazes").getPublicUrl(path);
      if (!data.publicUrl) throw new Error("A imagem foi armazenada, mas não foi possível obter seu endereço.");
      onImageReady(data.publicUrl);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Não foi possível gerar a imagem.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-violet-200">Gerar cartaz com IA</label>
      <textarea value={direction} onChange={event => setDirection(event.target.value)} maxLength={1500} placeholder="Descreva a imagem desejada: tema, cores, clima e elementos visuais. A IA não adicionará texto ao cartaz." className="input-ohel min-h-20 w-full rounded-lg px-3 py-2.5 text-sm" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-gray-500">A geração usa a conta configurada em OPENAI_API_KEY.</p>
        <button type="button" onClick={() => void generate()} disabled={generating || !eventName.trim() || !direction.trim()} className="inline-flex items-center gap-2 rounded-lg border border-violet-400/30 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? "Gerando e salvando…" : "Gerar imagem"}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
