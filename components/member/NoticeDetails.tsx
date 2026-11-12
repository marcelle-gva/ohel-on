"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { AvisoDashboard } from "@/lib/member-dashboard";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "[contenteditable]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function linkSeguro(url: string | null | undefined) {
  try {
    const parsed = new URL(url || "");
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function dataEvento(value: string | null | undefined) {
  const partes = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : null;
}

function elementosFocaveis(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      !element.hidden && element.getAttribute("aria-hidden") !== "true",
  );
}

export function NoticeDetails({
  aviso,
  onClose,
}: {
  aviso: AvisoDashboard | null;
  onClose: () => void;
}) {
  const [foto, setFoto] = useState<string | null>(null);
  const detalhesRef = useRef<HTMLDivElement>(null);
  const fecharDetalhesRef = useRef<HTMLButtonElement>(null);
  const focoAnteriorRef = useRef<HTMLElement | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const fecharLightboxRef = useRef<HTMLButtonElement>(null);
  const focoAnteriorLightboxRef = useRef<HTMLElement | null>(null);

  const capaUrl = linkSeguro(aviso?.imagem_url);
  const imagens = aviso
    ? Array.from(
        new Set(
          [capaUrl, ...aviso.fotos.map((url) => linkSeguro(url))].filter(
            (url): url is string => Boolean(url),
          ),
        ),
      )
    : [];
  const fotosAdicionais = imagens.filter((url) => url !== capaUrl);
  const fotoVisivel = aviso && foto && imagens.includes(foto) ? foto : null;

  useEffect(() => {
    if (!aviso) return;

    const focoAnterior =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    focoAnteriorRef.current = focoAnterior;
    const frame = window.requestAnimationFrame(() => {
      fecharDetalhesRef.current?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (focoAnterior?.isConnected) {
        focoAnterior.focus({ preventScroll: true });
      }
      if (focoAnteriorRef.current === focoAnterior) {
        focoAnteriorRef.current = null;
      }
    };
  }, [aviso]);

  useEffect(() => {
    if (!fotoVisivel) return;

    const frame = window.requestAnimationFrame(() => {
      fecharLightboxRef.current?.focus({ preventScroll: true });
    });
    const focoAnterior = focoAnteriorLightboxRef.current;

    return () => {
      window.cancelAnimationFrame(frame);
      if (focoAnterior?.isConnected) {
        focoAnterior.focus({ preventScroll: true });
      }
      if (focoAnteriorLightboxRef.current === focoAnterior) {
        focoAnteriorLightboxRef.current = null;
      }
    };
  }, [fotoVisivel]);

  useEffect(() => {
    if (!aviso) return;

    const lidarComTeclado = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (fotoVisivel) setFoto(null);
        else onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const container = fotoVisivel ? lightboxRef.current : detalhesRef.current;
      if (!container) return;

      const focaveis = elementosFocaveis(container);
      if (focaveis.length === 0) {
        event.preventDefault();
        (fotoVisivel ? fecharLightboxRef : fecharDetalhesRef).current?.focus({
          preventScroll: true,
        });
        return;
      }

      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const ativo = document.activeElement;

      if (event.shiftKey) {
        if (ativo === primeiro || !container.contains(ativo)) {
          event.preventDefault();
          ultimo.focus({ preventScroll: true });
        }
      } else if (ativo === ultimo || !container.contains(ativo)) {
        event.preventDefault();
        primeiro.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", lidarComTeclado);
    return () => document.removeEventListener("keydown", lidarComTeclado);
  }, [aviso, fotoVisivel, onClose]);

  if (!aviso) return null;

  const abrirFoto = (url: string) => {
    focoAnteriorLightboxRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setFoto(url);
  };

  const fechar = () => {
    setFoto(null);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/80 p-2 sm:p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) fechar();
        }}
      >
        <div
          ref={detalhesRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-notice-details-title"
          className="max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-700 bg-ohel-surface p-4 sm:max-h-[calc(100dvh-2rem)]"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2
              id="member-notice-details-title"
              className="break-words text-lg font-bold text-white"
            >
              {aviso.titulo}
            </h2>
            <button
              ref={fecharDetalhesRef}
              type="button"
              aria-label="Fechar detalhes"
              onClick={fechar}
              className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg p-2 text-gray-300 transition hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-ohel-blue"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {capaUrl && (
            <button
              type="button"
              aria-label="Ampliar capa"
              onClick={() => abrirFoto(capaUrl)}
              className="mb-4 flex min-h-10 w-full items-center justify-center overflow-hidden rounded-lg border border-gray-800 bg-black/40 focus:outline-none focus:ring-2 focus:ring-ohel-blue"
            >
              <img
                src={capaUrl}
                alt={`Capa de ${aviso.titulo}`}
                className="h-auto max-h-[min(20rem,45dvh)] w-full object-contain"
              />
            </button>
          )}

          <p className="whitespace-pre-wrap break-words text-sm text-gray-300">
            {aviso.conteudo || "Sem resumo informado."}
          </p>

          {(aviso.tipo === "evento" || aviso.categoria === "culto") &&
            (dataEvento(aviso.data_inicio) ||
              dataEvento(aviso.data_fim) ||
              aviso.hora_abertura) && (
              <dl
                className="mt-4 flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-gray-800 bg-ohel-bg p-3 text-xs text-gray-300"
                aria-label={aviso.categoria === "culto" ? "Agenda do culto" : "Agenda do evento"}
              >
                {dataEvento(aviso.data_inicio) && (
                  <div>
                    <dt className="text-gray-500">Início</dt>
                    <dd className="mt-1">{dataEvento(aviso.data_inicio)}</dd>
                  </div>
                )}
                {dataEvento(aviso.data_fim) && (
                  <div>
                    <dt className="text-gray-500">Término</dt>
                    <dd className="mt-1">{dataEvento(aviso.data_fim)}</dd>
                  </div>
                )}
                {aviso.hora_abertura && (
                  <div>
                    <dt className="text-gray-500">Horário de abertura</dt>
                    <dd className="mt-1">{aviso.hora_abertura.slice(0, 5)}</dd>
                  </div>
                )}
              </dl>
            )}

          {aviso.pregador_convidados && (
            <p className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-300">
              Convidados: {aviso.pregador_convidados}
            </p>
          )}

          {aviso.preco_ingresso != null && (
            <p className="mt-2 text-xs text-gray-300">
              Ingresso:{" "}
              {Number(aviso.preco_ingresso).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </p>
          )}

          {aviso.informacoes_adicionais && (
            <p className="mt-3 whitespace-pre-wrap break-words text-xs text-gray-400">
              {aviso.informacoes_adicionais}
            </p>
          )}

          {fotosAdicionais.length > 0 && (
            <section aria-labelledby="member-notice-gallery-title">
              <h3
                id="member-notice-gallery-title"
                className="mb-2 mt-4 text-sm font-semibold text-white"
              >
                Fotos — clique para ampliar
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {fotosAdicionais.map((url, index) => (
                  <button
                    type="button"
                    key={url}
                    onClick={() => abrirFoto(url)}
                    aria-label={`Ampliar foto ${index + 1} de ${fotosAdicionais.length}`}
                    className="aspect-video min-h-10 min-w-10 overflow-hidden rounded-lg border border-gray-700 bg-black/40 focus:outline-none focus:ring-2 focus:ring-ohel-blue"
                  >
                    <img
                      src={url}
                      alt={`Foto ${index + 1} de ${aviso.titulo}`}
                      className="h-full w-full object-contain"
                    />
                  </button>
                ))}
              </div>
            </section>
          )}

          {aviso.tipo === "evento" && (
            <Link
              href={`/evento/${encodeURIComponent(aviso.id)}`}
              className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-ohel-blue px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-ohel-blue"
            >
              Ver evento e inscrição
            </Link>
          )}
        </div>
      </div>

      {fotoVisivel && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-auto bg-black/95 p-2 sm:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setFoto(null);
          }}
        >
          <div
            ref={lightboxRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-notice-lightbox-title"
            className="relative flex max-h-full min-h-full w-full max-w-6xl items-center justify-center"
            onClick={(event) => {
              if (event.target === event.currentTarget) setFoto(null);
            }}
          >
            <h2 id="member-notice-lightbox-title" className="sr-only">
              Foto ampliada de {aviso.titulo}
            </h2>
            <button
              ref={fecharLightboxRef}
              type="button"
              aria-label="Fechar foto ampliada"
              onClick={() => setFoto(null)}
              className="absolute right-0 top-0 z-10 flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-gray-700 bg-ohel-surface p-2 text-white focus:outline-none focus:ring-2 focus:ring-ohel-blue"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex max-h-[calc(100dvh-2rem)] max-w-full items-center justify-center sm:max-h-[calc(100dvh-3rem)]">
              <img
                src={fotoVisivel}
                alt={`Foto ampliada de ${aviso.titulo}`}
                className="h-auto max-h-[calc(100dvh-2rem)] max-w-full object-contain sm:max-h-[calc(100dvh-3rem)]"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
