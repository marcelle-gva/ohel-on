"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, Check, ExternalLink, Loader2, Music, RefreshCw, X } from "lucide-react";

type Submissao = {
  id: string;
  titulo: string;
  tom: string | null;
  ministro: string | null;
  link_cifra: string | null;
  link_video: string | null;
  palavra_vinculada: string | null;
  created_at: string;
};

function urlHttp(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export default function LouvoresPendentesPage() {
  const [submissoes, setSubmissoes] = useState<Submissao[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const nextOffsetRef = useRef(0);
  const [decisaoAtiva, setDecisaoAtiva] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const carregar = useCallback(async (append = false, initial = false) => {
    if (!initial) {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setErro("");
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Entre novamente para revisar as músicas.");
      const offset = append ? nextOffsetRef.current : 0;
      const response = await fetch(`/api/louvores/submissoes?offset=${offset}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar as submissões.");
      const novas = Array.isArray(result.submissoes) ? result.submissoes : [];
      setSubmissoes((atuais) => append ? [...atuais, ...novas] : novas);
      const updatedOffset = Number.isInteger(result.nextOffset) ? result.nextOffset : offset + novas.length;
      nextOffsetRef.current = updatedOffset;
      setHasMore(Boolean(result.hasMore));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar as submissões.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void carregar(false, true), 0);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  const decidir = async (item: Submissao, decisao: "Aprovado" | "Rejeitado") => {
    if (decisao === "Rejeitado" && !window.confirm(`Rejeitar a música “${item.titulo}”?`)) return;
    setDecisaoAtiva(item.id);
    setErro("");
    setMensagem("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Entre novamente para registrar a decisão.");
      const response = await fetch("/api/louvores/submissoes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: item.id, decisao }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível registrar a decisão.");
      setSubmissoes((current) => current.filter((submission) => submission.id !== item.id));
      nextOffsetRef.current = Math.max(0, nextOffsetRef.current - 1);
      setMensagem(decisao === "Aprovado" ? "Música aprovada e adicionada ao repertório do telão." : "Música rejeitada; ela não foi publicada.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível registrar a decisão.");
    } finally {
      setDecisaoAtiva(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/monitor-midia" aria-label="Voltar ao Monitor de Mídia" className="mt-1 text-gray-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-white"><Music className="h-5 w-5 text-ohel-blue" /> Louvores aguardando aprovação</h1>
            <p className="mt-1 text-sm text-gray-400">Revise as músicas enviadas pelo QR antes de adicioná-las ao telão.</p>
          </div>
        </div>
        <button type="button" onClick={() => void carregar()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-gray-700 px-3 text-sm text-gray-200 hover:bg-white/5 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {erro && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{erro}</p>}
      {mensagem && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{mensagem}</p>}

      {loading ? (
        <div role="status" className="flex items-center gap-2 py-12 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando submissões...</div>
      ) : submissoes.length === 0 ? (
        <Card className="border-gray-800 bg-ohel-surface p-8 text-center">
          <Music className="mx-auto mb-3 h-8 w-8 text-gray-500" />
          <h2 className="font-semibold text-white">Nenhuma música aguardando revisão</h2>
          <p className="mt-1 text-sm text-gray-400">Novos envios pelo QR aparecerão aqui para avaliação do responsável de Louvor.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {submissoes.map((item) => {
            const cifra = urlHttp(item.link_cifra);
            const video = urlHttp(item.link_video);
            return (
              <Card key={item.id} className="border-gray-800 bg-ohel-surface p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Recebida {new Date(item.created_at).toLocaleString("pt-BR")}</p>
                    <h2 className="mt-1 text-lg font-semibold text-white">{item.titulo}</h2>
                    <p className="mt-1 text-sm text-gray-300">Tom: {item.tom || "—"} · Ministro: {item.ministro || "—"}</p>
                    {item.palavra_vinculada && <p className="mt-3 rounded-md border border-ohel-blue/20 bg-ohel-blue/10 p-3 text-sm text-blue-100"><span className="font-medium">Palavra vinculada:</span> {item.palavra_vinculada}</p>}
                    {item.link_cifra && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-300">{item.link_cifra}</p>}
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      {cifra && <a href={cifra} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ohel-blue hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Abrir cifra</a>}
                      {video && <a href={video} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ohel-blue hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Abrir vídeo</a>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 sm:flex-col">
                    <button type="button" onClick={() => void decidir(item, "Aprovado")} disabled={decisaoAtiva !== null} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60">
                      {decisaoAtiva === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Aprovar
                    </button>
                    <button type="button" onClick={() => void decidir(item, "Rejeitado")} disabled={decisaoAtiva !== null} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-500/30 px-4 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-60">
                      <X className="h-4 w-4" /> Rejeitar
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
          {hasMore && (
            <button
              type="button"
              onClick={() => void carregar(true)}
              disabled={loadingMore}
              className="inline-flex min-h-10 items-center justify-center gap-2 self-center rounded-md border border-gray-700 px-4 text-sm text-gray-200 hover:bg-white/5 disabled:opacity-60"
            >
              {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              Carregar mais submissões
            </button>
          )}
        </div>
      )}
    </div>
  );
}
