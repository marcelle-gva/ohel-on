"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Loader2,
  QrCode as QrCodeIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { PublicQrCodeKind } from "@/lib/qrcode-public";

type QrCodeResponse = {
  url?: string;
  igrejaNome?: string;
  error?: string;
};

type PublicQrCodePageProps = {
  tipo: PublicQrCodeKind;
  voltarPara: string;
  titulo: string;
  descricao: string;
  chamada: string;
};

export function PublicQrCodePage({
  tipo,
  voltarPara,
  titulo,
  descricao,
  chamada,
}: PublicQrCodePageProps) {
  const [url, setUrl] = useState("");
  const [igrejaNome, setIgrejaNome] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      setCarregando(true);
      setErro("");
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("Entre novamente para gerar o QR Code da sua igreja.");
        }

        const response = await fetch(`/api/qrcodes?tipo=${tipo}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const result = (await response.json()) as QrCodeResponse;
        if (!response.ok || !result.url) {
          throw new Error(result.error || "Não foi possível carregar o QR Code.");
        }
        if (!ativo) return;
        setUrl(result.url);
        setIgrejaNome(result.igrejaNome || "");
      } catch (error) {
        if (ativo) {
          setErro(error instanceof Error ? error.message : "Não foi possível carregar o QR Code.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    void carregar();
    return () => {
      ativo = false;
    };
  }, [tipo]);

  const copiarLink = async () => {
    if (!url) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard indisponível");
      await navigator.clipboard.writeText(url);
      setMensagem("Link copiado.");
    } catch {
      setMensagem("Não foi possível copiar automaticamente. Selecione o link exibido para copiar manualmente.");
    }
  };

  const baixarQrCode = () => {
    const svg = svgContainerRef.current?.querySelector("svg");
    if (!svg) {
      setMensagem("O QR Code ainda não está pronto para baixar.");
      return;
    }
    try {
      const source = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `ohel-on-${tipo}-qrcode.svg`;
      link.click();
      URL.revokeObjectURL(downloadUrl);
      setMensagem("QR Code baixado.");
    } catch {
      setMensagem("Não foi possível baixar o QR Code. Tente imprimir esta página.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href={voltarPara}
            className="mt-0.5 text-gray-400 transition-colors hover:text-white"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
              <QrCodeIcon className="h-5 w-5 text-ohel-blue" /> {titulo}
            </h1>
            <p className="mt-1 text-xs text-gray-400">{descricao}</p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-800 bg-ohel-surface p-6 shadow-xl">
        {carregando ? (
          <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Conferindo a igreja da sessão...
          </div>
        ) : erro ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200" role="alert">
            {erro}
          </div>
        ) : (
          <>
            <div className="text-center">
              <p className="text-sm font-semibold text-white">{igrejaNome || "Sua igreja"}</p>
              <p className="mt-2 text-sm leading-6 text-gray-400">{chamada}</p>
            </div>

            <div ref={svgContainerRef} className="mx-auto my-6 w-fit rounded-2xl bg-white p-5">
              <QRCode value={url} size={240} level="H" title={titulo} />
            </div>

            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400" htmlFor={`qr-link-${tipo}`}>
              Link oficial
            </label>
            <input
              id={`qr-link-${tipo}`}
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-2 w-full rounded-lg border border-gray-700 bg-ohel-bg px-3 py-3 text-xs text-gray-300 outline-none focus:border-ohel-blue focus:ring-1 focus:ring-ohel-blue"
            />

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void copiarLink()}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-ohel-blue px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
              >
                <Copy className="h-4 w-4" /> Copiar link
              </button>
              <button
                type="button"
                onClick={baixarQrCode}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-gray-700 px-4 py-3 text-sm font-semibold text-gray-200 transition-colors hover:border-ohel-blue hover:text-white"
              >
                <Download className="h-4 w-4" /> Baixar QR
              </button>
            </div>
            <p className="mt-3 min-h-5 text-center text-xs text-gray-500" aria-live="polite">
              {mensagem && <><Check className="mr-1 inline h-3.5 w-3.5 text-green-400" />{mensagem}</>}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
