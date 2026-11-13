"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  HeartHandshake,
  Loader2,
  MapPin,
  MessageSquare,
  Music,
  RefreshCw,
  Search,
  ShoppingBasket,
  Sparkles,
  Video,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAccess } from "@/components/layout/AccessShell";
import type {
  AvisoDashboard,
  DashboardMembroData,
} from "@/lib/member-dashboard";
import { VisitorInviteCard } from "./VisitorInviteCard";
import { NoticeDetails } from "./NoticeDetails";
import { PastoralCareCard } from "./PastoralCareCard";
import { MemberRafflesCard } from "./MemberRafflesCard";
import { PrayerNotifications } from "./PrayerNotifications";
import { VerseCallout } from "@/components/shared/VerseCallout";
import styles from "@/app/area-membro/dashboard.module.css";

function urlSegura(url: string | null | undefined) {
  try {
    const parsed = new URL(url || "");
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}
function diaEvento(aviso: AvisoDashboard) {
  if (!aviso.data_inicio) return null;
  const match = aviso.data_inicio.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
function Bloco({
  titulo,
  descricao,
  icone,
  total,
  children,
}: {
  titulo: string;
  descricao: string;
  icone: React.ReactNode;
  total?: number;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.block} aria-label={titulo}>
      <div className={styles.blockHeader}>
        <div>
          <h2 className={styles.blockTitle}>
            {icone}
            {titulo}
          </h2>
          <p className={styles.blockHint}>{descricao}</p>
        </div>
        {total !== undefined && <span className={styles.count}>{total}</span>}
      </div>
      <div className={styles.blockBody}>{children}</div>
    </section>
  );
}

export function MemberDashboard() {
  const contexto = useAccess();
  const [dashboard, setDashboard] = useState<DashboardMembroData | null>(null);
  const [erro, setErro] = useState("");
  const [atualizando, setAtualizando] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [selecionado, setSelecionado] = useState<AvisoDashboard | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "evento" | "aviso">("todos");
  const [busca, setBusca] = useState("");
  const [avisosVisiveis, setAvisosVisiveis] = useState(4);
  const [louvoresVisiveis, setLouvoresVisiveis] = useState(3);
  const [slide, setSlide] = useState(0);
  const [cuidadoRefreshKey, setCuidadoRefreshKey] = useState(0);
  const [sorteiosRefreshKey, setSorteiosRefreshKey] = useState(0);
  const [prayerRefreshKey, setPrayerRefreshKey] = useState(0);
  const emAndamento = useRef<AbortController | null>(null);
  const recarregarPendente = useRef(false);
  const carregarRef = useRef<(() => Promise<void>) | null>(null);

  const carregar = useCallback(async () => {
    if (emAndamento.current) {
      recarregarPendente.current = true;
      return;
    }
    const controller = new AbortController();
    emAndamento.current = controller;
    setAtualizando(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (controller.signal.aborted) return;
      if (!session?.access_token) {
        setDashboard(null);
        setSelecionado(null);
        throw new Error("Sua sessão expirou. Entre novamente.");
      }
      const response = await fetch("/api/membros/dashboard", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
        signal: controller.signal,
      });
      const result = (await response.json()) as {
        dashboard?: DashboardMembroData;
        error?: string;
      };
      if (!response.ok || !result.dashboard) {
        if ([401, 403].includes(response.status)) {
          setDashboard(null);
          setSelecionado(null);
        }
        throw new Error(
          result.error || "Não foi possível atualizar seu dashboard.",
        );
      }
      setDashboard(result.dashboard);
      setUltimaAtualizacao(new Date());
      setErro("");
    } catch (error) {
      if (!controller.signal.aborted)
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar sua igreja.",
        );
    } finally {
      if (emAndamento.current === controller) emAndamento.current = null;
      if (!controller.signal.aborted) setAtualizando(false);
      const repetir = recarregarPendente.current && !controller.signal.aborted;
      recarregarPendente.current = false;
      if (repetir) window.setTimeout(() => void carregarRef.current?.(), 0);
    }
  }, []);

  useEffect(() => {
    carregarRef.current = carregar;
    return () => {
      if (carregarRef.current === carregar) carregarRef.current = null;
    };
  }, [carregar]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let realtimeTimer: number | null = null;
    const igrejaId = contexto?.igrejaId;
    const timer = window.setTimeout(() => void carregar(), 0);
    const refresh = () => {
      if (!document.hidden) void carregar();
    };
    const atualizarPorMudanca = () => {
      if (document.hidden) return;
      if (realtimeTimer !== null) window.clearTimeout(realtimeTimer);
      realtimeTimer = window.setTimeout(() => {
        realtimeTimer = null;
        void carregar();
      }, 200);
    };
    if (igrejaId) {
      const filtroIgreja = `igreja_id=eq.${igrejaId}`;
      channel = supabase
        .channel(`member-dashboard-mural-${igrejaId}-${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "comunicacoes", filter: filtroIgreja }, atualizarPorMudanca)
        .on("postgres_changes", { event: "*", schema: "public", table: "eventos", filter: filtroIgreja }, atualizarPorMudanca)
        .on("postgres_changes", { event: "*", schema: "public", table: "pedidos_oracao", filter: filtroIgreja }, atualizarPorMudanca)
        .subscribe();
    }
    const interval = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      if (realtimeTimer !== null) window.clearTimeout(realtimeTimer);
      document.removeEventListener("visibilitychange", refresh);
      emAndamento.current?.abort();
      emAndamento.current = null;
      recarregarPendente.current = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [carregar, contexto?.igrejaId]);

  const avisos = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return (dashboard?.avisos || []).filter(
      (item) =>
        (filtro === "todos" || item.tipo === filtro) &&
        (!termo ||
          [
            item.titulo,
            item.conteudo,
            item.pregador_convidados,
            item.informacoes_adicionais,
          ].some((texto) => texto?.toLocaleLowerCase("pt-BR").includes(termo))),
    );
  }, [dashboard?.avisos, filtro, busca]);
  const live = urlSegura(dashboard?.culto?.link_ao_vivo);
  const palavra = dashboard?.palavra;
  const slideAtual = Math.min(
    slide,
    Math.max(0, (palavra?.slides.length || 1) - 1),
  );
  const primeiroNome =
    contexto?.membro?.nome?.trim().split(/\s+/)[0] || "membro";
  const vazio = (principal: string, dica: string) => (
    <div className={styles.empty}>
      <strong>{principal}</strong>
      <span>{dica}</span>
    </div>
  );
  const quickActions = [
    {
      href: `/oracao/${contexto?.igrejaId}`,
      nome: "Pedir oração",
      hint: "Conte com a sua igreja",
      icon: HeartHandshake,
    },
    {
      href: "/checkin",
      nome: "Fazer check-in",
      hint: "Registre sua presença",
      icon: MapPin,
    },
    {
      href: "/area-membro/cestas",
      nome: "Contribuir com cestas",
      hint: "Veja o que falta e participe",
      icon: ShoppingBasket,
    },
  ];

  return (
    <div className={styles.dashboard}>
      <div className={styles.welcome}>
        <div>
          <p className={styles.eyebrow}>Meu dashboard · Área do Membro</p>
          <h1 className={styles.title}>A paz do Senhor, {primeiroNome}.</h1>
          <p className={styles.subtitle}>
            Sua igreja, mais perto de você. Acompanhe, participe e acolha.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCuidadoRefreshKey((valor) => valor + 1);
            setSorteiosRefreshKey((valor) => valor + 1);
            setPrayerRefreshKey((valor) => valor + 1);
            void carregar();
          }}
          disabled={atualizando}
          className={styles.refresh}
        >
          <RefreshCw size={14} className={atualizando ? "animate-spin" : ""} />{" "}
          Atualizar
        </button>
      </div>

      <nav className={styles.actions} aria-label="Ações do membro">
        {quickActions.map(({ href, nome, hint, icon: Icon }) => (
          <Link
            href={href}
            key={nome}
            className={styles.action}
            aria-label={nome}
          >
            <span className={`${styles.actionIcon} ${nome === "Pedir oração" ? styles.prayerActionIcon : ""}`}>
              <Icon size={19} />
            </span>
            <span className="min-w-0">
              <span className={styles.actionLabel}>{nome}</span>
              <span className={styles.actionHint}>{hint}</span>
            </span>
            <ArrowRight size={15} className={styles.actionArrow} />
          </Link>
        ))}
      </nav>

      <PrayerNotifications
        key={`oracoes-${contexto?.igrejaId}-${contexto?.membro?.id}`}
        churchId={contexto?.igrejaId}
        memberId={contexto?.membro?.id}
        refreshKey={prayerRefreshKey}
      />
      <MemberRafflesCard
        key={`sorteios-${contexto?.igrejaId}-${contexto?.membro?.id}`}
        refreshKey={sorteiosRefreshKey}
      />

      {erro && (
        <p role="alert" className={styles.error}>
          {erro}{" "}
          {dashboard &&
            "Os conteúdos abaixo são da última atualização recebida."}
        </p>
      )}
      {!dashboard ? (
        <>
          <p role="status" className={styles.loading}>
            {!erro && <Loader2 size={17} className="animate-spin" />}
            {erro
              ? "Use Atualizar para tentar novamente."
              : "Preparando os conteúdos da sua igreja..."}
          </p>
          {!erro && (
            <div aria-hidden="true" className={styles.skeleton}>
              <div />
              <div />
            </div>
          )}
        </>
      ) : (
        <>
          {dashboard.culto && (
            <section className={styles.live} aria-label="Culto em andamento">
              <div className="min-w-0">
                <p className={styles.liveLabel}>
                  <span className={styles.liveDot} /> Culto em andamento
                </p>
                <h2 className={styles.liveTitle}>{dashboard.culto.titulo}</h2>
              </div>
              {live && (
                <a
                  href={live}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.liveLink}
                >
                  <Video size={16} /> Assistir ao vivo <ArrowRight size={13} />
                </a>
              )}
            </section>
          )}

          <div className={styles.columns}>
            <div className={styles.column}>
              <Bloco
                titulo="Acontece na igreja"
                descricao="Avisos, encontros e eventos para você participar."
                icone={<CalendarDays size={17} className="text-teal-500" />}
                total={dashboard.avisos.length}
              >
                <div className={styles.tools}>
                  <div
                    className={styles.tabs}
                    role="group"
                    aria-label="Filtrar conteúdos"
                  >
                    {(
                      [
                        ["todos", "Todos"],
                        ["evento", "Eventos"],
                        ["aviso", "Avisos"],
                      ] as const
                    ).map(([valor, texto]) => (
                      <button
                        type="button"
                        key={valor}
                        className={styles.tab}
                        aria-pressed={filtro === valor}
                        onClick={() => {
                          setFiltro(valor);
                          setAvisosVisiveis(4);
                        }}
                      >
                        {texto}
                      </button>
                    ))}
                  </div>
                  <label className={styles.search}>
                    <Search size={15} className="shrink-0" />
                    <input
                      aria-label="Buscar avisos e eventos"
                      placeholder="Buscar na sua igreja"
                      value={busca}
                      onChange={(event) => {
                        setBusca(event.target.value);
                        setAvisosVisiveis(4);
                      }}
                    />
                  </label>
                </div>
                <div className={styles.notices}>
                  {avisos.slice(0, avisosVisiveis).map((item) => (
                    <button
                      type="button"
                      className={styles.notice}
                      key={`${item.tipo}-${item.id}`}
                      onClick={() => setSelecionado(item)}
                      aria-label={`Ver ${item.categoria === "culto" ? "próximo culto" : item.categoria === "oracao" ? "oração" : item.tipo === "evento" ? "evento" : "aviso"}: ${item.titulo}`}
                    >
                      {urlSegura(item.imagem_url) && (
                        <img
                          src={item.imagem_url!}
                          alt=""
                          className={styles.thumbnail}
                          loading="lazy"
                        />
                      )}
                      <div className={styles.noticeText}>
                        <div className={styles.noticeMeta}>
                          <span className={styles.tag}>
                            {item.categoria === "culto" ? (
                              <CalendarDays size={10} />
                            ) : item.categoria === "oracao" ? (
                              <HeartHandshake size={10} />
                            ) : item.tipo === "evento" ? (
                              <CalendarDays size={10} />
                            ) : (
                              <MessageSquare size={10} />
                            )}
                            {item.categoria === "culto" ? "Próximo culto" : item.categoria === "oracao" ? "Oração" : item.tipo === "evento" ? "Evento" : "Aviso"}
                          </span>
                          {diaEvento(item) && (
                            <span>
                              {diaEvento(item)}
                              {item.hora_abertura
                                ? ` · ${item.hora_abertura.slice(0, 5)}`
                                : ""}
                            </span>
                          )}
                        </div>
                        <h3 className={styles.noticeTitle}>{item.titulo}</h3>
                        <p className={styles.noticeSummary}>
                          {item.conteudo ||
                            "Confira as informações compartilhadas pela igreja."}
                        </p>
                        <span className={styles.noticeLink}>
                          Ver detalhes{item.fotos.length ? " e fotos" : ""}{" "}
                          <ArrowRight size={11} />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                {!avisos.length &&
                  vazio(
                    busca || filtro !== "todos"
                      ? "Nenhum resultado encontrado."
                      : "Em breve, novidades por aqui.",
                    busca || filtro !== "todos"
                      ? "Tente outro termo ou selecione Todos."
                      : "Os avisos publicados pela igreja aparecerão neste espaço.",
                  )}
                {avisos.length > avisosVisiveis && (
                  <button
                    type="button"
                    className={styles.more}
                    onClick={() => setAvisosVisiveis((n) => n + 6)}
                  >
                    <ChevronDown size={14} /> Mostrar mais (
                    {avisos.length - avisosVisiveis})
                  </button>
                )}
                <VerseCallout
                  tone="teal"
                  title="Fique por dentro!"
                  message="Deus tem feito coisas lindas na casa do Pai."
                  verse={'"Alegrei-me quando me disseram: Vamos à casa do Senhor." (Salmos 122:1)'}
                />
              </Bloco>
            </div>
            <div className={styles.column}>
              <VisitorInviteCard
                igreja={dashboard.igreja}
                visitantes={dashboard.visitantes}
              />
            </div>
          </div>

          <section className={styles.worship} aria-label="Acompanhe o culto">
            <h2 className={styles.sectionTitle}>
              <Sparkles size={15} className="text-blue-400" /> Acompanhe o culto
            </h2>
            <div className={styles.worshipColumns}>
              <Bloco
                titulo="Palavra"
                descricao="A mensagem compartilhada durante a celebração."
                icone={<BookOpen size={16} className="text-ohel-blue" />}
              >
                {palavra ? (
                  <>
                    <h3 className={styles.wordTitle}>
                      {palavra.titulo || "Palavra do culto"}
                    </h3>
                    {palavra.referencia && (
                      <p className={styles.reference}>{palavra.referencia}</p>
                    )}
                    <p className={styles.word}>
                      {palavra.slides[slideAtual] ||
                        "A mensagem será exibida assim que estiver disponível."}
                    </p>
                    {palavra.slides.length > 1 && (
                      <div className={styles.pager}>
                        <button
                          type="button"
                          disabled={slideAtual === 0}
                          onClick={() => setSlide(Math.max(0, slideAtual - 1))}
                        >
                          Anterior
                        </button>
                        <span>
                          {slideAtual + 1} / {palavra.slides.length}
                        </span>
                        <button
                          type="button"
                          disabled={slideAtual >= palavra.slides.length - 1}
                          onClick={() =>
                            setSlide(
                              Math.min(
                                palavra.slides.length - 1,
                                slideAtual + 1,
                              ),
                            )
                          }
                        >
                          Próxima
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  vazio(
                    "Acompanhe a Palavra por aqui.",
                    "Quando a equipe projetar a mensagem durante o culto, ela aparecerá neste espaço.",
                  )
                )}
                <VerseCallout
                  tone="blue"
                  title="Palavra para o caminho"
                  message="Deixe a mensagem iluminar sua caminhada com Deus."
                  verse={'"Lâmpada para os meus pés é a tua palavra, e luz para o meu caminho." (Salmos 119:105)'}
                />
              </Bloco>
              <Bloco
                titulo="Repertório de hoje"
                descricao="Os louvores que fazem parte da celebração."
                icone={<Music size={16} className="text-ohel-blue" />}
                total={dashboard.louvores.length}
              >
                {dashboard.louvores
                  .slice(0, louvoresVisiveis)
                  .map((item, index) => (
                    <article className={styles.song} key={item.id}>
                      <span className={styles.songNumber}>{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className={styles.songName}>{item.titulo}</h3>
                        <p className={styles.songMeta}>
                          Tom: {item.tom || "—"} · Ministro:{" "}
                          {item.ministro || "—"}
                        </p>
                        {item.palavra_vinculada && (
                          <details>
                            <summary>Ver Palavra vinculada</summary>
                            <p>{item.palavra_vinculada}</p>
                          </details>
                        )}
                      </div>
                    </article>
                  ))}
                {!dashboard.louvores.length &&
                  vazio(
                    "O repertório ainda não foi publicado.",
                    "Os louvores adicionados pela equipe aparecerão aqui.",
                  )}
                {dashboard.louvores.length > louvoresVisiveis && (
                  <button
                    type="button"
                    className={styles.more}
                    onClick={() => setLouvoresVisiveis((n) => n + 6)}
                  >
                    Ver mais louvores (
                    {dashboard.louvores.length - louvoresVisiveis})
                  </button>
                )}
                <VerseCallout
                  tone="blue"
                  title="Momento de Adoração"
                  message="Adore ao Senhor com todo o seu coração."
                  verse={'"Cantem ao Senhor um novo cântico; cantem ao Senhor, todos os habitantes da terra!" (Salmos 96:1)'}
                />
              </Bloco>
            </div>
          </section>
          <footer className={styles.footer}>
            <span>
              {contexto?.igrejaNome} · Conteúdos compartilhados com os membros
            </span>
            <span>
              {ultimaAtualizacao
                ? `Atualizado às ${ultimaAtualizacao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                : ""}
            </span>
          </footer>
        </>
      )}
      <PastoralCareCard refreshKey={cuidadoRefreshKey} />
      <NoticeDetails aviso={selecionado} onClose={() => setSelecionado(null)} />
    </div>
  );
}
