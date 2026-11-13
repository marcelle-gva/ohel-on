"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  CheckCheck,
  HeartHandshake,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  analisarAtualizacaoNotificacoesOracao,
  criarChaveStorageNotificacoesOracao,
  idsDeSementesOracao,
  idsNaoLidosNotificacoesOracao,
  lerEstadoNotificacoesOracao,
  marcarNotificacoesOracaoComoLidas,
  normalizarNotificacoesOracao,
  type PrayerNotification,
  type PrayerNotificationSeed,
  type PrayerNotificationStorage,
} from "@/lib/member-prayer-notifications";
import styles from "./prayer-notifications.module.css";

export interface PrayerNotificationsProps {
  /** ID da igreja resolvido pelo contexto server-side; nunca vem de input livre. */
  churchId?: string | null;
  /** ID do membro ativo da sessão; evita misturar históricos entre membros. */
  memberId?: string | null;
  /** Incrementar após ações do dashboard para solicitar uma leitura imediata. */
  refreshKey?: number;
  /** Dados já filtrados pelo dashboard; servem apenas para semear IDs vistos. */
  initialPrayers?: readonly PrayerNotificationSeed[] | null;
}

function formatarData(value: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Data não disponível";
  }
}

export function PrayerNotifications({
  churchId,
  memberId,
  refreshKey = 0,
  initialPrayers,
}: PrayerNotificationsProps) {
  const [notifications, setNotifications] = useState<PrayerNotification[]>([]);
  const [storageState, setStorageState] =
    useState<PrayerNotificationStorage | null>(null);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const queued = useRef(false);
  const loadRef = useRef<(() => Promise<void>) | null>(null);
  const storageKeyRef = useRef<string | null>(null);
  const loadedScopeRef = useRef<string | null>(null);
  const scope = useMemo(
    () => JSON.stringify([churchId || "", memberId || ""]),
    [churchId, memberId],
  );
  const seedIds = useMemo(
    () => idsDeSementesOracao(initialPrayers),
    [initialPrayers],
  );

  const load = useCallback(async () => {
    if (!churchId || !memberId) return;
    if (inFlight.current) {
      queued.current = true;
      return;
    }

    const controller = new AbortController();
    inFlight.current = controller;
    if (loadedScopeRef.current !== scope) {
      loadedScopeRef.current = null;
      setLoadedScope(null);
      setNotifications([]);
      setStorageState(null);
      setNewIds([]);
      setErro("");
    }
    setLoading(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (controller.signal.aborted) return;
      if (sessionError || !session?.access_token || !session.user?.id) {
        setNotifications([]);
        setStorageState(null);
        setNewIds([]);
        loadedScopeRef.current = null;
        storageKeyRef.current = null;
        setLoadedScope(null);
        setOpen(false);
        throw new Error("Sua sessão expirou. Entre novamente para ver as orações.");
      }

      const key = criarChaveStorageNotificacoesOracao(
        session.user.id,
        memberId,
        churchId,
      );
      storageKeyRef.current = key;
      let previous: PrayerNotificationStorage | null = null;
      try {
        previous = lerEstadoNotificacoesOracao(window.localStorage.getItem(key));
      } catch {
        // O módulo segue sem histórico local quando o navegador bloqueia storage.
      }
      const response = await fetch("/api/membros/oracoes/notificacoes", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
        signal: controller.signal,
      });
      const result = (await response.json().catch(() => null)) as {
        notifications?: unknown;
        error?: string;
      } | null;
      if (controller.signal.aborted) return;
      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          setNotifications([]);
          setStorageState(null);
          setNewIds([]);
          loadedScopeRef.current = null;
          storageKeyRef.current = null;
          setLoadedScope(null);
          setOpen(false);
        }
        throw new Error(
          result?.error || "Não foi possível atualizar as notificações de oração.",
        );
      }

      const nextNotifications = normalizarNotificacoesOracao(
        result?.notifications,
      );
      const currentIds = [
        ...nextNotifications.map((notification) => notification.id),
        ...seedIds,
      ];
      const transition = analisarAtualizacaoNotificacoesOracao(
        previous,
        currentIds,
      );
      try {
        window.localStorage.setItem(key, JSON.stringify(transition.state));
      } catch {
        // A rede continua sendo a fonte da verdade; não guardar conteúdo no storage.
      }
      setNotifications(nextNotifications);
      setStorageState(transition.state);
      setNewIds(transition.newIds);
      loadedScopeRef.current = scope;
      setLoadedScope(scope);
      setErro("");
    } catch (error) {
      if (!controller.signal.aborted) {
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar as notificações de oração.",
        );
      }
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
      if (!controller.signal.aborted) setLoading(false);
      const repeat = queued.current && !controller.signal.aborted;
      queued.current = false;
      if (repeat) window.setTimeout(() => void loadRef.current?.(), 0);
    }
  }, [churchId, memberId, scope, seedIds]);

  useEffect(() => {
    loadRef.current = load;
    return () => {
      if (loadRef.current === load) loadRef.current = null;
    };
  }, [load]);

  useEffect(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    queued.current = false;
    storageKeyRef.current = null;

    if (!churchId || !memberId) {
      return;
    }

    const initialTimer = window.setTimeout(() => void load(), 0);
    const refresh = () => {
      if (!document.hidden) void load();
    };
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      inFlight.current?.abort();
      inFlight.current = null;
      queued.current = false;
    };
  }, [churchId, memberId, refreshKey, load]);

  const scopeLoaded = loadedScope === scope;
  const visibleNotifications = useMemo(
    () => (scopeLoaded ? notifications : []),
    [notifications, scopeLoaded],
  );
  const visibleStorageState = scopeLoaded ? storageState : null;
  const unreadIds = useMemo(
    () =>
      visibleStorageState
        ? idsNaoLidosNotificacoesOracao(
            visibleNotifications,
            visibleStorageState,
          )
        : [],
    [visibleNotifications, visibleStorageState],
  );
  const unreadSet = useMemo(() => new Set(unreadIds), [unreadIds]);

  const markRead = useCallback(
    (ids: readonly string[]) => {
      if (!storageKeyRef.current || !storageState || ids.length === 0) return;
      const next = marcarNotificacoesOracaoComoLidas(storageState, ids);
      try {
        window.localStorage.setItem(
          storageKeyRef.current,
          JSON.stringify(next),
        );
      } catch {
        // A indisponibilidade do storage não deve impedir a leitura do mural.
      }
      setStorageState(next);
      setNewIds((current) => current.filter((id) => !ids.includes(id)));
    },
    [storageState],
  );

  if (!churchId || !memberId) return null;

  const unreadCount = unreadIds.length;
  const newlyPublishedCount = scopeLoaded ? newIds.length : 0;

  return (
    <section className={styles.root} aria-labelledby="prayer-notifications-title">
      <div className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon} aria-hidden="true">
            <Bell size={17} />
          </span>
          <div>
            <h2 id="prayer-notifications-title" className={styles.title}>
              Orações da igreja
            </h2>
            <p className={styles.hint}>
              Pedidos publicados para a comunidade acompanhar em oração.
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          {unreadCount > 0 && (
            <span className={styles.badge} aria-label={`${unreadCount} não lidas`}>
              {unreadCount} nova{unreadCount === 1 ? "" : "s"}
            </span>
          )}
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
          >
            {open ? "Ocultar histórico" : "Ver histórico"}
          </button>
        </div>
      </div>

      {newlyPublishedCount > 0 && (
        <p className={styles.newMessage} role="status" aria-live="polite">
          <HeartHandshake size={14} aria-hidden="true" />
          {newlyPublishedCount === 1
            ? "Um novo pedido foi publicado."
            : `${newlyPublishedCount} novos pedidos foram publicados.`}
        </p>
      )}
      {erro && <p className={styles.error} role="alert">{erro}</p>}

      {open && (
        <div className={styles.history}>
          <div className={styles.historyHeader}>
            <span>
              {loading ? (
                <>
                  <Loader2 size={13} className={styles.spin} /> Atualizando…
                </>
              ) : (
                `${visibleNotifications.length} pedido${visibleNotifications.length === 1 ? "" : "s"} publicado${visibleNotifications.length === 1 ? "" : "s"}`
              )}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                className={styles.readAll}
                onClick={() => markRead(unreadIds)}
              >
                <CheckCheck size={13} /> Marcar como lidas
              </button>
            )}
          </div>
          {visibleNotifications.length === 0 ? (
            <p className={styles.empty}>
              Ainda não há pedidos de oração publicados para sua igreja.
            </p>
          ) : (
            <div className={styles.list}>
              {visibleNotifications.map((notification) => {
                const unread = unreadSet.has(notification.id);
                return (
                  <article
                    className={`${styles.item} ${unread ? styles.unread : ""}`}
                    key={notification.id}
                  >
                    <div className={styles.itemTopline}>
                      <span className={styles.itemTag}>
                        <HeartHandshake size={12} aria-hidden="true" /> Pedido publicado
                      </span>
                      {unread && <span className={styles.dot}>Novo</span>}
                    </div>
                    <h3 className={styles.itemTitle}>{notification.title}</h3>
                    <p className={styles.itemBody}>{notification.body}</p>
                    <div className={styles.itemFooter}>
                      <time dateTime={notification.publishedAt}>
                        Publicado em {formatarData(notification.publishedAt)}
                      </time>
                      <div className={styles.itemActions}>
                        {unread && (
                          <button
                            type="button"
                            className={styles.markRead}
                            onClick={() => markRead([notification.id])}
                          >
                            Marcar lida
                          </button>
                        )}
                        <a
                          href={notification.href}
                          className={styles.openLink}
                          onClick={() => markRead([notification.id])}
                        >
                          {notification.actionLabel} <ArrowRight size={12} />
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
