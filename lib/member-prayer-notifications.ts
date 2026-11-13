import {
  STATUS_ORACAO_PUBLICADA,
  VISIBILIDADE_ORACAO_PUBLICA,
} from "@/lib/mural-rules";

export const PRAYER_NOTIFICATION_STORAGE_VERSION = 1 as const;
export const PRAYER_NOTIFICATION_STORAGE_PREFIX =
  "ohelon.member.prayer-notifications.v1";
export const PRAYER_NOTIFICATION_MAX_SEEN_IDS = 5000;

export interface PrayerNotificationRow {
  id?: unknown;
  nome_solicitante?: unknown;
  descricao?: unknown;
  created_at?: unknown;
  status?: unknown;
  visibilidade?: unknown;
}

export interface PrayerNotification {
  id: string;
  type: "oracao_publicada";
  title: string;
  body: string;
  requesterName: string;
  publishedAt: string;
  href: string;
  actionLabel: "Abrir espaço de oração";
}

export interface PrayerNotificationSeed {
  id: string;
  nome_solicitante?: string | null;
  descricao?: string | null;
  created_at?: string | null;
}

export interface PrayerNotificationStorage {
  version: typeof PRAYER_NOTIFICATION_STORAGE_VERSION;
  initialized: boolean;
  seenIds: string[];
  readIds: string[];
}

export interface PrayerNotificationStateTransition {
  state: PrayerNotificationStorage;
  newIds: string[];
}

function textoSeguro(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function idSeguro(value: unknown): string | null {
  const id = textoSeguro(value, 160);
  return id ? id : null;
}

function idsUnicos(ids: readonly string[], limit = PRAYER_NOTIFICATION_MAX_SEEN_IDS) {
  const resultado: string[] = [];
  const vistos = new Set<string>();
  for (const id of ids) {
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    resultado.push(id);
  }
  return resultado.slice(-limit);
}

function hrefOracaoSeguro(igrejaId: string): string | null {
  const igreja = textoSeguro(igrejaId, 160);
  return igreja ? `/oracao/${encodeURIComponent(igreja)}` : null;
}

export function projetarOracaoPublicada(
  row: PrayerNotificationRow,
  igrejaId: string,
): PrayerNotification | null {
  if (
    row.status !== STATUS_ORACAO_PUBLICADA ||
    row.visibilidade !== VISIBILIDADE_ORACAO_PUBLICA
  ) {
    return null;
  }

  const id = idSeguro(row.id);
  const body = textoSeguro(row.descricao, 5000);
  const requesterName = textoSeguro(row.nome_solicitante, 150) || "Anônimo";
  const createdAt = textoSeguro(row.created_at, 80);
  const timestamp = Date.parse(createdAt);
  const href = hrefOracaoSeguro(igrejaId);
  if (!id || !body || !createdAt || !Number.isFinite(timestamp) || !href) {
    return null;
  }

  return {
    id,
    type: "oracao_publicada",
    title: `Pedido de oração · ${requesterName}`,
    body,
    requesterName,
    publishedAt: new Date(timestamp).toISOString(),
    href,
    actionLabel: "Abrir espaço de oração",
  };
}

export function ordenarNotificacoesOracao(
  notifications: readonly PrayerNotification[],
): PrayerNotification[] {
  return [...notifications].sort((a, b) => {
    const porData = b.publishedAt.localeCompare(a.publishedAt);
    return porData || b.id.localeCompare(a.id);
  });
}

export function normalizarNotificacoesOracao(
  value: unknown,
): PrayerNotification[] {
  if (!Array.isArray(value)) return [];
  const resultado: PrayerNotification[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const candidate = item as Partial<PrayerNotification>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.title !== "string" ||
      typeof candidate.body !== "string" ||
      typeof candidate.requesterName !== "string" ||
      typeof candidate.publishedAt !== "string" ||
      candidate.type !== "oracao_publicada" ||
      candidate.actionLabel !== "Abrir espaço de oração" ||
      !/^\/oracao\/[^/?#]+$/.test(candidate.href || "") ||
      !Number.isFinite(Date.parse(candidate.publishedAt)) ||
      ids.has(candidate.id)
    ) {
      continue;
    }
    ids.add(candidate.id);
    resultado.push({
      id: candidate.id,
      type: "oracao_publicada",
      title: candidate.title.slice(0, 190),
      body: candidate.body.slice(0, 5000),
      requesterName: candidate.requesterName.slice(0, 150),
      publishedAt: new Date(Date.parse(candidate.publishedAt)).toISOString(),
      href: candidate.href ?? "",
      actionLabel: "Abrir espaço de oração",
    });
  }
  return ordenarNotificacoesOracao(resultado);
}

export function idsDeSementesOracao(
  seeds: readonly PrayerNotificationSeed[] | null | undefined,
): string[] {
  if (!seeds) return [];
  return idsUnicos(
    seeds
      .map((seed) => idSeguro(seed?.id))
      .filter((id): id is string => Boolean(id)),
  );
}

export function criarChaveStorageNotificacoesOracao(
  usuarioId: string,
  membroId: string,
  igrejaId: string,
): string {
  return [
    PRAYER_NOTIFICATION_STORAGE_PREFIX,
    usuarioId,
    membroId,
    igrejaId,
  ]
    .map((value) => encodeURIComponent(textoSeguro(value, 160)))
    .join(":");
}

export function criarEstadoInicialNotificacoesOracao(
  idsAtuais: readonly string[],
): PrayerNotificationStorage {
  const ids = idsUnicos(idsAtuais);
  return {
    version: PRAYER_NOTIFICATION_STORAGE_VERSION,
    initialized: true,
    // A primeira carga é histórico, não um disparo de toast/badge em massa.
    seenIds: ids,
    readIds: ids,
  };
}

export function analisarAtualizacaoNotificacoesOracao(
  anterior: PrayerNotificationStorage | null,
  idsAtuais: readonly string[],
): PrayerNotificationStateTransition {
  const atuais = idsUnicos(idsAtuais);
  if (!anterior || !anterior.initialized) {
    return { state: criarEstadoInicialNotificacoesOracao(atuais), newIds: [] };
  }

  const vistos = new Set(anterior.seenIds);
  const newIds = atuais.filter((id) => !vistos.has(id));
  const state: PrayerNotificationStorage = {
    version: PRAYER_NOTIFICATION_STORAGE_VERSION,
    initialized: true,
    seenIds: idsUnicos([...anterior.seenIds, ...atuais]),
    readIds: idsUnicos(anterior.readIds),
  };
  return { state, newIds };
}

export function marcarNotificacoesOracaoComoLidas(
  anterior: PrayerNotificationStorage,
  ids: readonly string[],
): PrayerNotificationStorage {
  return {
    version: PRAYER_NOTIFICATION_STORAGE_VERSION,
    initialized: anterior.initialized,
    seenIds: idsUnicos(anterior.seenIds),
    readIds: idsUnicos([...anterior.readIds, ...ids]),
  };
}

export function lerEstadoNotificacoesOracao(
  raw: string | null,
): PrayerNotificationStorage | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const candidate = parsed as Partial<PrayerNotificationStorage>;
    if (
      candidate.version !== PRAYER_NOTIFICATION_STORAGE_VERSION ||
      candidate.initialized !== true ||
      !Array.isArray(candidate.seenIds) ||
      !Array.isArray(candidate.readIds)
    ) {
      return null;
    }
    return {
      version: PRAYER_NOTIFICATION_STORAGE_VERSION,
      initialized: true,
      seenIds: idsUnicos(
        candidate.seenIds.filter((id): id is string => typeof id === "string"),
      ),
      readIds: idsUnicos(
        candidate.readIds.filter((id): id is string => typeof id === "string"),
      ),
    };
  } catch {
    return null;
  }
}

export function idsNaoLidosNotificacoesOracao(
  notifications: readonly PrayerNotification[],
  state: PrayerNotificationStorage,
): string[] {
  const lidos = new Set(state.readIds);
  return notifications.filter((item) => !lidos.has(item.id)).map((item) => item.id);
}
