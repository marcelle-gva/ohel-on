"use client";

import { useRef, useState } from "react";
import {
  Copy,
  ExternalLink,
  MapPin,
  MessageCircle,
  Users,
} from "lucide-react";
import {
  criarMensagemConvite,
  criarWhatsAppUrl,
  obterMapaUrlSeguro,
} from "@/lib/member-dashboard";
import type { DashboardMembroData } from "@/lib/member-dashboard";

type VisitorInviteCardProps = {
  igreja: DashboardMembroData["igreja"];
  visitantes: number;
};

type CopyStatus = "idle" | "copied" | "fallback";

export function VisitorInviteCard({
  igreja,
  visitantes,
}: VisitorInviteCardProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const conviteRef = useRef<HTMLTextAreaElement>(null);
  const endereco = igreja.endereco?.trim() || null;
  const convite = endereco ? criarMensagemConvite(igreja) : null;
  const mapaUrl = endereco ? obterMapaUrlSeguro(igreja) : null;
  const whatsappUrl = convite ? criarWhatsAppUrl(igreja) : null;

  const copiarConvite = async () => {
    if (!convite) return;

    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard indisponível");
      await navigator.clipboard.writeText(convite);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("fallback");
      window.requestAnimationFrame(() => {
        conviteRef.current?.focus();
        conviteRef.current?.select();
      });
    }
  };

  return (
    <section className="rounded-xl border border-gray-800 bg-ohel-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-300">
            <Users className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white">Visitantes</h2>
            <p className="mt-1 text-xs text-gray-400">
              Convide alguém para estar com a gente
            </p>
          </div>
        </div>
        <p className="shrink-0 text-lg font-bold text-purple-300" aria-label="Visitantes recebidos hoje">
          {visitantes}
        </p>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        {visitantes === 1
          ? "1 visitante recebido hoje."
          : `${visitantes} visitantes recebidos hoje.`}
      </p>

      <div className="mt-4 rounded-lg border border-gray-800 bg-ohel-bg p-3">
        <p className="break-words text-xs font-semibold text-white">
          {igreja.nome || "Igreja"}
        </p>
        {endereco ? (
          <p className="mt-2 flex items-start gap-2 whitespace-pre-wrap break-words text-xs leading-5 text-gray-400">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ohel-blue" aria-hidden="true" />
            <span>{endereco}</span>
          </p>
        ) : (
          <p className="mt-2 text-xs leading-5 text-amber-200/80" role="status">
            O endereço da igreja ainda não foi informado. Peça à secretaria para atualizá-lo antes de compartilhar um convite.
          </p>
        )}
      </div>

      {endereco && convite && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {mapaUrl && (
              <a
                href={mapaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 transition-colors hover:border-ohel-blue hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ohel-blue"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Abrir mapa
              </a>
            )}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 transition-colors hover:border-emerald-400 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Convidar no WhatsApp
              </a>
            )}
            <button
              type="button"
              onClick={() => void copiarConvite()}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-ohel-blue px-3 py-2 text-xs text-white transition-colors hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ohel-blue"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copiar convite
            </button>
          </div>

          <p className="mt-2 text-[10px] text-gray-500" aria-live="polite">
            {copyStatus === "copied"
              ? "Convite copiado."
              : copyStatus === "fallback"
                ? "Não foi possível copiar automaticamente. Selecione o texto abaixo para copiar."
                : "O convite não é enviado automaticamente."}
          </p>

          {copyStatus === "fallback" && (
            <textarea
              ref={conviteRef}
              readOnly
              value={convite}
              aria-label="Texto do convite para copiar manualmente"
              className="mt-2 min-h-24 w-full resize-y rounded-lg border border-amber-500/30 bg-ohel-bg p-2 text-xs leading-5 text-gray-300 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
          )}
        </>
      )}
    </section>
  );
}

export default VisitorInviteCard;
