"use client";

import { supabase } from "@/lib/supabase";
import type {
  AtendimentoEquipe,
  RegistroEmocionalEquipe,
} from "@/lib/pastoral-care";

export type PeriodoEmocional = "semana" | "mes" | "ano" | "total";

export interface MembroOpcao {
  id: string;
  nome: string;
  cargo: string | null;
}

export interface PessoaOpcao {
  id: string;
  nome: string;
}

export interface PastorOpcao {
  id: string;
  nome: string;
  cargo: string | null;
}

export interface AtendimentoOpcoes {
  membros: MembroOpcao[];
  visitantes: PessoaOpcao[];
  pastores: PastorOpcao[];
}

export interface AtendimentoPayload {
  membro_id?: string | null;
  nome_visitante?: string | null;
  pastor_responsavel: string;
  data_atendimento: string;
  hora_atendimento: string | null;
  tipo: string;
  motivo: string | null;
  observacoes: string | null;
  status: string;
  status_anterior?: string | null;
}

export class PastoralApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "PastoralApiError";
    this.status = status;
  }
}

function respostaDeErro(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string" &&
    payload.error.trim()
  ) {
    return payload.error;
  }
  return fallback;
}

async function cabecalhosComSessao(contentType = false) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new PastoralApiError("Sua sessão expirou. Entre novamente para continuar.", 401);
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    ...(contentType ? { "Content-Type": "application/json" } : {}),
  };
}

async function requisicaoJson<T>(
  url: string,
  init: RequestInit,
  mensagemFallback: string,
  signal?: AbortSignal,
) {
  const headers = await cabecalhosComSessao(Boolean(init.body));
  const response = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
    cache: "no-store",
    signal,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PastoralApiError(
      respostaDeErro(payload, mensagemFallback),
      response.status,
    );
  }
  return payload as T;
}

export async function listarAtendimentos(
  offset = 0,
  signal?: AbortSignal,
): Promise<{ atendimentos: AtendimentoEquipe[]; hasMore: boolean }> {
  const payload = await requisicaoJson<{
    atendimentos?: AtendimentoEquipe[];
    hasMore?: boolean;
  }>(
    `/api/gabinete/atendimentos?offset=${Math.max(0, offset)}`,
    {},
    "Não foi possível carregar os atendimentos.",
    signal,
  );
  if (!Array.isArray(payload.atendimentos) || typeof payload.hasMore !== "boolean") {
    throw new PastoralApiError("A resposta dos atendimentos está incompleta.", 502);
  }
  return { atendimentos: payload.atendimentos, hasMore: payload.hasMore };
}

export async function listarTodosAtendimentos(signal?: AbortSignal) {
  const todos: AtendimentoEquipe[] = [];
  const ids = new Set<string>();
  let offset = 0;

  for (;;) {
    const pagina = await listarAtendimentos(offset, signal);
    for (const atendimento of pagina.atendimentos) {
      if (!ids.has(atendimento.id)) {
        ids.add(atendimento.id);
        todos.push(atendimento);
      }
    }
    if (!pagina.hasMore) return todos;
    if (pagina.atendimentos.length === 0) {
      throw new PastoralApiError("A paginação dos atendimentos não avançou.", 502);
    }
    offset += pagina.atendimentos.length;
  }
}

export async function obterAtendimentoOpcoes(signal?: AbortSignal) {
  const payload = await requisicaoJson<Partial<AtendimentoOpcoes>>(
    "/api/gabinete/atendimentos/opcoes",
    {},
    "Não foi possível carregar as opções do atendimento.",
    signal,
  );
  if (!Array.isArray(payload.membros) || !Array.isArray(payload.visitantes) || !Array.isArray(payload.pastores)) {
    throw new PastoralApiError("As opções do atendimento estão incompletas.", 502);
  }
  return payload as AtendimentoOpcoes;
}

export async function obterAtendimento(id: string, signal?: AbortSignal) {
  const payload = await requisicaoJson<{ atendimento?: AtendimentoEquipe }>(
    `/api/gabinete/atendimentos/${encodeURIComponent(id)}`,
    {},
    "Não foi possível carregar este atendimento.",
    signal,
  );
  if (!payload.atendimento) {
    throw new PastoralApiError("Atendimento não encontrado.", 404);
  }
  return payload.atendimento;
}

export async function criarAtendimento(payload: AtendimentoPayload) {
  const result = await requisicaoJson<{ atendimento?: AtendimentoEquipe }>(
    "/api/gabinete/atendimentos",
    { method: "POST", body: JSON.stringify(payload) },
    "Não foi possível registrar o atendimento.",
  );
  if (!result.atendimento) {
    throw new PastoralApiError("O atendimento não foi retornado após o salvamento.", 502);
  }
  return result.atendimento;
}

export async function atualizarAtendimento(
  id: string,
  payload: AtendimentoPayload,
) {
  const result = await requisicaoJson<{ atendimento?: AtendimentoEquipe }>(
    `/api/gabinete/atendimentos/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    "Não foi possível atualizar o atendimento.",
  );
  if (!result.atendimento) {
    throw new PastoralApiError("O atendimento não foi retornado após a atualização.", 502);
  }
  return result.atendimento;
}

export async function listarTodosRegistrosEmocionais(
  periodo: PeriodoEmocional,
  signal?: AbortSignal,
) {
  const todos: RegistroEmocionalEquipe[] = [];
  const ids = new Set<string>();
  let offset = 0;

  for (;;) {
    const payload = await requisicaoJson<{
      registros?: RegistroEmocionalEquipe[];
      hasMore?: boolean;
    }>(
      `/api/gabinete/emocional?periodo=${periodo}&offset=${offset}`,
      {},
      "Não foi possível carregar os registros emocionais.",
      signal,
    );
    if (!Array.isArray(payload.registros) || typeof payload.hasMore !== "boolean") {
      throw new PastoralApiError("A resposta dos registros emocionais está incompleta.", 502);
    }
    for (const registro of payload.registros) {
      if (!ids.has(registro.id)) {
        ids.add(registro.id);
        todos.push(registro);
      }
    }
    if (!payload.hasMore) return todos;
    if (payload.registros.length === 0) {
      throw new PastoralApiError("A paginação dos registros emocionais não avançou.", 502);
    }
    offset += payload.registros.length;
  }
}

export function mensagemPastoral(error: unknown, fallback: string) {
  return error instanceof PastoralApiError && error.message
    ? error.message
    : fallback;
}

export function requisicaoAbortada(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}
