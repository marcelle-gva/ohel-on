"use client";

import { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cultoLarRequest, CULTOLAR_ACCESS_LOST } from "./culto-lar-client";

export function CultoLarFoto({ id, versao, alt }: { id: string; versao: number; alt: string }) {
  const [url, setUrl] = useState("");
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    let objectUrl = "";
    let controller: AbortController | null = null;
    const limpar = () => {
      controller?.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = "";
      if (ativo) setUrl("");
    };
    const carregar = async () => {
      if (!ativo || controller) return;
      const requisicao = new AbortController();
      controller = requisicao;
      try {
        const response = await cultoLarRequest(`/api/culto-lar/${encodeURIComponent(id)}/foto`, { signal: requisicao.signal });
        if (!response.ok) throw new Error("Foto indisponível para este acesso.");
        if (!response.headers.get("content-type")?.startsWith("image/")) throw new Error("Não foi possível abrir a foto.");
        const blob = await response.blob();
        if (!ativo || requisicao.signal.aborted) return;
        const novaUrl = URL.createObjectURL(blob);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = novaUrl;
        setUrl(novaUrl);
        setErro("");
      } catch (error) {
        if (ativo && !requisicao.signal.aborted) {
          limpar();
          setErro(error instanceof Error ? error.message : "Não foi possível abrir a foto.");
        }
      } finally {
        if (controller === requisicao) controller = null;
      }
    };
    const refresh = () => { if (!document.hidden) void carregar(); };
    const timer = window.setTimeout(() => void carregar(), 0);
    const interval = window.setInterval(refresh, 60000);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") limpar();
    });
    window.addEventListener(CULTOLAR_ACCESS_LOST, limpar);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      ativo = false;
      limpar();
      window.clearTimeout(timer);
      window.clearInterval(interval);
      subscription.unsubscribe();
      window.removeEventListener(CULTOLAR_ACCESS_LOST, limpar);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [id, versao, tentativa]);

  return (
    <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-xl border border-gray-800 bg-black/20">
      {url ? (
        // A foto vem de uma requisição autenticada; a URL blob não é uma imagem pública.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="max-h-96 w-full object-contain" />
      ) : erro ? (
        <div className="flex flex-col items-center gap-2 p-5 text-center text-xs text-gray-400"><ImageOff size={22} /><p>{erro}</p><button type="button" onClick={() => { setErro(""); setTentativa((n) => n + 1); }} className="rounded px-3 py-2 text-blue-300 hover:bg-white/5">Tentar abrir novamente</button></div>
      ) : <p role="status" className="flex items-center gap-2 p-5 text-xs text-gray-400"><Loader2 size={16} className="animate-spin" />Carregando foto protegida...</p>}
    </div>
  );
}
