"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  HeartHandshake,
  MessageSquare,
  MonitorPlay,
  Music,
  Users,
  Video,
  RefreshCw,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAccess } from "@/components/layout/AccessShell";
import type { AvisoMembro, MonitorMembroData } from "@/lib/member-monitor";

function linkSeguro(url: string | null) {
  try {
    const parsed = new URL(url || "");
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function Bloco({
  titulo,
  children,
}: {
  titulo: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-gray-800 bg-ohel-surface p-4">
      <h2 className="mb-3 flex items-center gap-2 border-b border-gray-800 pb-2 text-sm font-bold text-white">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export default function MonitorMembroPage() {
  const contexto = useAccess();
  const [monitor, setMonitor] = useState<MonitorMembroData | null>(null);
  const [erro, setErro] = useState("");
  const [atualizando, setAtualizando] = useState(false);
  const [selecionado, setSelecionado] = useState<AvisoMembro | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);

  const carregar = useCallback(async () => {
    setAtualizando(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMonitor(null);
        throw new Error("Sua sessão expirou. Entre novamente.");
      }
      const response = await fetch("/api/membros/monitor", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const result = (await response.json()) as {
        monitor?: MonitorMembroData;
        error?: string;
      };
      if (!response.ok || !result.monitor) {
        if ([401, 403].includes(response.status)) setMonitor(null);
        throw new Error(
          result.error || "Não foi possível atualizar o Monitor.",
        );
      }
      setMonitor(result.monitor);
      setErro("");
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o Monitor.",
      );
    } finally {
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void carregar(), 0);
    const interval = window.setInterval(() => {
      if (!document.hidden) void carregar();
    }, 20000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [carregar]);

  useEffect(() => {
    const fechar = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (foto) setFoto(null);
        else setSelecionado(null);
      }
    };
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [foto]);

  const vazio = (texto: string) => (
    <p className="text-xs text-gray-500">{texto}</p>
  );
  const live = linkSeguro(monitor?.culto?.link_ao_vivo || null);
  const palavraSlide =
    monitor?.palavra?.slides[
      Math.min(slide, Math.max(0, monitor.palavra.slides.length - 1))
    ];
  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <MonitorPlay className="h-5 w-5 shrink-0 text-ohel-blue" /> Monitor
            online
          </h1>
          <p className="mt-1 text-xs text-gray-400">
            Olá, {contexto?.membro?.nome?.split(" ")[0] || "membro"}. Acompanhe
            a vida da sua igreja.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void carregar()}
          disabled={atualizando}
          className="flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2 text-xs text-gray-300"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${atualizando ? "animate-spin" : ""}`}
          />{" "}
          Atualizar
        </button>
      </div>
      {erro && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300"
        >
          {erro}
        </div>
      )}
      {!monitor ? (
        <p role="status" className="py-8 text-sm text-gray-400">
          {erro
            ? "Use Atualizar para tentar novamente."
            : "Carregando o Monitor da sua igreja..."}
        </p>
      ) : (
        <>
          {monitor.culto && (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  Culto em andamento
                </p>
                <h2 className="mt-1 break-words text-sm font-semibold text-white">
                  {monitor.culto.titulo}
                </h2>
              </div>
              {live && (
                <a
                  href={live}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300"
                >
                  <Video className="h-4 w-4" /> Assistir ao vivo
                </a>
              )}
            </section>
          )}
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-4">
              <Bloco
                titulo={
                  <>
                    <Users className="h-4 w-4 text-purple-400" /> Visitantes
                  </>
                }
              >
                <p className="text-2xl font-bold text-purple-300">
                  {monitor.visitantes}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Visitantes recebidos hoje. Seja bem-vindo à casa do Pai!
                </p>
              </Bloco>
              <Bloco
                titulo={
                  <>
                    <MessageSquare className="h-4 w-4 text-teal-400" /> Avisos
                  </>
                }
              >
                <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto">
                  {monitor.avisos.length
                    ? monitor.avisos.map((item) => (
                        <button
                          type="button"
                          key={`${item.tipo}-${item.id}`}
                          onClick={() => setSelecionado(item)}
                          className="rounded-lg border border-gray-800 bg-ohel-bg p-3 text-left hover:border-ohel-blue"
                        >
                          <p className="break-words text-sm font-bold text-white">
                            {item.titulo}
                          </p>
                          <p className="mt-1 line-clamp-2 break-words text-xs text-gray-400">
                            {item.conteudo}
                          </p>
                          <span className="mt-2 block text-[10px] text-ohel-blue">
                            Ver resumo{item.fotos.length ? " e fotos" : ""}
                          </span>
                        </button>
                      ))
                    : vazio("Nenhum aviso publicado.")}
                </div>
              </Bloco>
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <Bloco
                titulo={
                  <>
                    <Music className="h-4 w-4 text-ohel-blue" /> Repertório
                  </>
                }
              >
                <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto">
                  {monitor.louvores.length
                    ? monitor.louvores.map((item, index) => (
                        <article
                          key={item.id}
                          className="rounded-lg border border-gray-800 bg-ohel-bg p-3"
                        >
                          <p className="break-words text-sm font-semibold text-white">
                            <span className="mr-2 text-gray-500">
                              {index + 1}.
                            </span>
                            {item.titulo}
                          </p>
                          <p className="mt-1 break-words text-xs text-gray-400">
                            Tom: {item.tom || "—"} · Ministro:{" "}
                            {item.ministro || "—"}
                          </p>
                          {item.palavra_vinculada && (
                            <p className="mt-2 whitespace-pre-wrap break-words text-xs text-blue-300">
                              {item.palavra_vinculada}
                            </p>
                          )}
                        </article>
                      ))
                    : vazio("Nenhum louvor no repertório de hoje.")}
                </div>
              </Bloco>
              <Bloco
                titulo={
                  <>
                    <BookOpen className="h-4 w-4 text-ohel-blue" /> Palavra
                  </>
                }
              >
                {monitor.palavra ? (
                  <>
                    <h3 className="break-words text-sm font-semibold text-white">
                      {monitor.palavra.titulo || "Palavra do culto"}
                    </h3>
                    {monitor.palavra.referencia && (
                      <p className="mt-1 text-xs text-blue-300">
                        {monitor.palavra.referencia}
                      </p>
                    )}
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300">
                      {palavraSlide || ""}
                    </p>
                    {monitor.palavra.slides.length > 1 && (
                      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-gray-400">
                        <button
                          type="button"
                          disabled={slide === 0}
                          onClick={() =>
                            setSlide((atual) => Math.max(0, atual - 1))
                          }
                          className="rounded border border-gray-700 px-2 py-2 disabled:opacity-40"
                        >
                          Anterior
                        </button>
                        <span>
                          {Math.min(slide + 1, monitor.palavra.slides.length)} /{" "}
                          {monitor.palavra.slides.length}
                        </span>
                        <button
                          type="button"
                          disabled={slide >= monitor.palavra.slides.length - 1}
                          onClick={() =>
                            setSlide((atual) =>
                              Math.min(
                                monitor.palavra!.slides.length - 1,
                                atual + 1,
                              ),
                            )
                          }
                          className="rounded border border-gray-700 px-2 py-2 disabled:opacity-40"
                        >
                          Próxima
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  vazio(
                    "A Palavra aparecerá aqui quando a equipe a projetar no culto.",
                  )
                )}
              </Bloco>
            </div>
            <Bloco
              titulo={
                <>
                  <HeartHandshake className="h-4 w-4 text-red-400" /> Orações
                </>
              }
            >
              <Link
                href={`/oracao/${contexto?.igrejaId}`}
                className="mb-3 inline-block rounded-lg border border-gray-800 px-3 py-2 text-xs text-red-300 hover:border-red-400/30"
              >
                Enviar pedido de oração
              </Link>
              <div className="flex max-h-[42rem] flex-col gap-3 overflow-y-auto">
                {monitor.oracoes.length
                  ? monitor.oracoes.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-lg border border-gray-800 bg-ohel-bg p-3"
                      >
                        <p className="break-words text-xs font-bold text-red-300">
                          {item.nome_solicitante || "Anônimo"}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-300">
                          {item.descricao}
                        </p>
                      </article>
                    ))
                  : vazio("Nenhum pedido aprovado nesta semana.")}
              </div>
              <p className="mt-3 text-[10px] text-gray-500">
                Somente pedidos aprovados pela igreja são exibidos.
              </p>
            </Bloco>
          </div>
        </>
      )}
      {selecionado && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-event-title"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3"
          onClick={() => setSelecionado(null)}
        >
          <div
            className="max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-700 bg-ohel-surface p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2
                id="member-event-title"
                className="break-words text-lg font-bold text-white"
              >
                {selecionado.titulo}
              </h2>
              <button
                type="button"
                aria-label="Fechar detalhes"
                onClick={() => setSelecionado(null)}
                className="shrink-0 p-2 text-gray-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {linkSeguro(selecionado.imagem_url) && (
              <button
                type="button"
                className="mb-4 w-full"
                aria-label="Ampliar capa"
                onClick={() => setFoto(linkSeguro(selecionado.imagem_url))}
              >
                <img
                  src={selecionado.imagem_url!}
                  alt={selecionado.titulo}
                  className="max-h-80 w-full rounded-lg bg-black/40 object-contain"
                />
              </button>
            )}
            <p className="whitespace-pre-wrap break-words text-sm text-gray-300">
              {selecionado.conteudo || "Sem resumo informado."}
            </p>
            {selecionado.pregador_convidados && (
              <p className="mt-3 text-sm text-gray-300">
                Convidados: {selecionado.pregador_convidados}
              </p>
            )}
            {selecionado.preco_ingresso != null && (
              <p className="mt-2 text-xs text-gray-300">
                Ingresso:{" "}
                {Number(selecionado.preco_ingresso).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </p>
            )}
            {selecionado.informacoes_adicionais && (
              <p className="mt-3 whitespace-pre-wrap text-xs text-gray-400">
                {selecionado.informacoes_adicionais}
              </p>
            )}
            {selecionado.fotos.length > 0 && (
              <>
                <h3 className="mb-2 mt-4 text-sm font-semibold text-white">
                  Fotos — clique para ampliar
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selecionado.fotos
                    .filter((url) => linkSeguro(url))
                    .map((url, index) => (
                      <button
                        type="button"
                        key={`${url}-${index}`}
                        onClick={() => setFoto(url)}
                        aria-label={`Ampliar foto ${index + 1}`}
                        className="aspect-video overflow-hidden rounded-lg border border-gray-700 bg-black/40"
                      >
                        <img
                          src={url}
                          alt={`Foto ${index + 1} de ${selecionado.titulo}`}
                          className="h-full w-full object-contain"
                        />
                      </button>
                    ))}
                </div>
              </>
            )}
            {selecionado.tipo === "evento" && (
              <Link
                href={`/evento/${encodeURIComponent(selecionado.id)}`}
                className="mt-4 inline-block rounded-lg bg-ohel-blue px-3 py-2 text-xs text-white"
              >
                Ver evento e inscrição
              </Link>
            )}
          </div>
        </div>
      )}
      {foto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto ampliada"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setFoto(null)}
        >
          <img
            src={foto}
            alt="Foto ampliada do aviso"
            className="max-h-[85dvh] max-w-full object-contain"
          />
          <button
            type="button"
            aria-label="Fechar foto ampliada"
            onClick={() => setFoto(null)}
            className="absolute right-3 top-3 rounded-full bg-ohel-surface p-3 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
