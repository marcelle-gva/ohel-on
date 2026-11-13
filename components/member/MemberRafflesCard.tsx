"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Gift,
  Loader2,
  RefreshCw,
  Ticket,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  linkPublicoSorteio,
  type SorteioMembro,
} from "@/lib/member-raffles";
import styles from "./member-raffles.module.css";

type MemberRafflesCardProps = {
  refreshKey?: number;
};

type ApiResult = {
  sorteios?: SorteioMembro[];
  error?: string;
};

function isSorteioMembro(value: unknown): value is SorteioMembro {
  if (typeof value !== "object" || value === null) return false;
  const registro = value as Record<string, unknown>;
  return (
    typeof registro.id === "string" &&
    typeof registro.titulo === "string" &&
    typeof registro.premio === "string" &&
    typeof registro.valor_por_numero === "number" &&
    (registro.imagem_url === undefined ||
      registro.imagem_url === null ||
      typeof registro.imagem_url === "string") &&
    (registro.prazo === null || typeof registro.prazo === "string") &&
    (registro.regra === null || typeof registro.regra === "string") &&
    typeof registro.link_publico === "string"
  );
}

function mensagemDoErro(error: unknown, alternativa: string) {
  return error instanceof Error && error.message ? error.message : alternativa;
}

async function lerResposta(response: Response): Promise<ApiResult> {
  const texto = await response.text();
  if (!texto) return {};
  try {
    const resultado: unknown = JSON.parse(texto);
    return resultado && typeof resultado === "object"
      ? (resultado as ApiResult)
      : {};
  } catch {
    return {};
  }
}

function imagemSegura(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function formatarMoeda(valor: number) {
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatarPrazo(valor: string | null) {
  if (!valor) return "A definir";
  const partes = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : "A definir";
}

export function MemberRafflesCard({ refreshKey = 0 }: MemberRafflesCardProps) {
  const [sorteios, setSorteios] = useState<SorteioMembro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const requisicaoRef = useRef<AbortController | null>(null);
  const recarregarPendente = useRef(false);
  const refreshAnteriorRef = useRef(refreshKey);
  const carregarRef = useRef<(() => Promise<void>) | null>(null);

  const carregar = useCallback(async function carregarSorteios() {
    if (requisicaoRef.current) {
      recarregarPendente.current = true;
      return;
    }
    const controller = new AbortController();
    requisicaoRef.current = controller;
    setCarregando(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (controller.signal.aborted) return;
      if (!session?.access_token) {
        setSorteios([]);
        throw new Error("Sua sessão expirou. Entre novamente.");
      }
      const response = await fetch("/api/membros/sorteios", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
        signal: controller.signal,
      });
      const resultado = await lerResposta(response);
      if (controller.signal.aborted) return;
      const itens = Array.isArray(resultado.sorteios)
        ? resultado.sorteios.filter(isSorteioMembro)
        : null;
      if (!response.ok || !itens) {
        if ([401, 403].includes(response.status)) setSorteios([]);
        throw new Error(
          resultado.error || "Não foi possível carregar os sorteios ativos.",
        );
      }
      setSorteios(itens);
      setErro("");
    } catch (error) {
      if (!controller.signal.aborted) {
        setErro(
          mensagemDoErro(
            error,
            "Não foi possível carregar os sorteios ativos.",
          ),
        );
      }
    } finally {
      if (requisicaoRef.current === controller) requisicaoRef.current = null;
      if (!controller.signal.aborted) setCarregando(false);
      const repetir = recarregarPendente.current && !controller.signal.aborted;
      recarregarPendente.current = false;
      if (repetir) window.setTimeout(() => void carregarSorteios(), 0);
    }
  }, []);

  useEffect(() => {
    carregarRef.current = carregar;
    return () => {
      if (carregarRef.current === carregar) carregarRef.current = null;
    };
  }, [carregar]);

  useEffect(() => {
    const timer = window.setTimeout(() => void carregar(), 0);
    const atualizarAoRetomar = () => {
      if (!document.hidden) void carregar();
    };
    const intervalo = window.setInterval(() => {
      if (!document.hidden) void carregar();
    }, 30000);
    document.addEventListener("visibilitychange", atualizarAoRetomar);
    window.addEventListener("focus", atualizarAoRetomar);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", atualizarAoRetomar);
      window.removeEventListener("focus", atualizarAoRetomar);
      requisicaoRef.current?.abort();
      requisicaoRef.current = null;
      recarregarPendente.current = false;
    };
  }, [carregar]);

  useEffect(() => {
    if (refreshAnteriorRef.current === refreshKey) return;
    refreshAnteriorRef.current = refreshKey;
    void carregarRef.current?.();
  }, [refreshKey]);

  return (
    <section className={styles.card} aria-labelledby="member-raffles-title">
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          <div className={styles.headingIcon} aria-hidden="true">
            <Gift className="h-5 w-5" />
          </div>
          <div className={styles.headingText}>
            <p className={styles.eyebrow}>Oportunidades da igreja</p>
            <h2 id="member-raffles-title" className={styles.title}>
              Sorteios ativos
            </h2>
            <p className={styles.subtitle}>
              Escolha um número e acompanhe sua reserva pelo fluxo público.
            </p>
          </div>
        </div>
        <button
          type="button"
          className={styles.refresh}
          onClick={() => void carregar()}
          disabled={carregando}
          aria-label="Atualizar sorteios ativos"
          title="Atualizar sorteios ativos"
        >
          <RefreshCw className={carregando ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          <span>Atualizar</span>
        </button>
      </header>

      {carregando && (
        <div className={styles.loading} role="status" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Carregando sorteios ativos...</span>
        </div>
      )}

      {!carregando && erro && (
        <div className={styles.loadError} role="alert">
          <span>{erro}</span>
          <button type="button" onClick={() => void carregar()}>
            Tentar novamente
          </button>
        </div>
      )}

      {!carregando && !erro && sorteios.length === 0 && (
        <div className={styles.empty} role="status">
          <strong>Nenhum sorteio ativo agora.</strong>
          <span>Quando a igreja abrir uma nova oportunidade, ela aparecerá aqui.</span>
        </div>
      )}

      {!carregando && !erro && sorteios.length > 0 && (
        <div className={styles.content}>
          <p className={styles.syncing} aria-live="polite">
            Atualizado automaticamente ao abrir a área, voltar o foco ou a cada 30 segundos.
          </p>
          <div className={styles.grid}>
            {sorteios.map((sorteio) => {
              const imagem = imagemSegura(sorteio.imagem_url);
              const link = sorteio.link_publico || linkPublicoSorteio(sorteio.id);
              return (
                <article className={styles.item} key={sorteio.id}>
                  <div className={styles.cover}>
                    {imagem ? (
                      // A URL vem da igreja e pode apontar para um domínio externo;
                      // next/image exigiria uma allowlist que este módulo não controla.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagem} alt={`Imagem de ${sorteio.titulo}`} />
                    ) : (
                      <Gift className="h-10 w-10" aria-hidden="true" />
                    )}
                  </div>
                  <div className={styles.itemBody}>
                    <h3 className={styles.itemTitle}>{sorteio.titulo}</h3>
                    <p className={styles.itemPrize}>Prêmio: {sorteio.premio}</p>
                    <dl className={styles.meta}>
                      <div>
                        <dt>
                          <Ticket className="mr-1 inline h-3 w-3" aria-hidden="true" />
                          Por número
                        </dt>
                        <dd>{formatarMoeda(sorteio.valor_por_numero)}</dd>
                      </div>
                      <div>
                        <dt>
                          <CalendarDays className="mr-1 inline h-3 w-3" aria-hidden="true" />
                          Prazo
                        </dt>
                        <dd>{formatarPrazo(sorteio.prazo)}</dd>
                      </div>
                    </dl>
                    {sorteio.regra && <p className={styles.rule}>{sorteio.regra}</p>}
                    <a
                      className={styles.action}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Participar e acompanhar
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export default MemberRafflesCard;
