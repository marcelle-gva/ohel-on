import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AcessoError, resolverAcesso, respostaErroAcesso } from "@/lib/access-server";
import { podeAcessar } from "@/lib/access";
import { obterDataAtualSaoPaulo } from "@/lib/aniversariantes";
import {
  EMOCOES, TIPOS_ATENDIMENTO, STATUS_ATENDIMENTO, RESPONSAVEL_PENDENTE,
  atendimentoParaMembro, dataValida, horaValida, idValido,
  type AtendimentoPessoal,
} from "@/lib/pastoral-care";

const CAMPOS_PESSOAIS = "id,pastor_responsavel,data_atendimento,hora_atendimento,tipo,motivo,status,created_at";
const CAMPOS_EQUIPE = `${CAMPOS_PESSOAIS},membro_id,nome_visitante,observacoes,membros(nome,igreja_id)`;
const CAMPOS_EMOCIONAIS = "id,emoji,observacao,created_at";
const PRIVADO = { "Cache-Control": "private, no-store" };
const TAMANHO_PAGINA = 100;

function isolarPessoaRelacionada<T extends { membros?: unknown }>(row: T, igrejaId: string) {
  const membro = row.membros as { nome?: string; igreja_id?: string } | null;
  return {
    ...row,
    membros: membro?.igreja_id === igrejaId && typeof membro.nome === "string" ? { nome: membro.nome } : null,
  };
}

export function respostaPrivada(data: unknown, status = 200) {
  return Response.json(data, { status, headers: PRIVADO });
}
export function handlerPrivado(fn: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try { return await fn(request); } catch (error) { return respostaErroAcesso(error); }
  };
}
function verificarErro(error: { code?: string } | null, mensagem: string) {
  if (!error) return;
  // Nunca registrar dados pessoais, corpos enviados ou observações de cuidado.
  console.error("Falha no serviço de cuidado pastoral", { code: error.code });
  throw new AcessoError(mensagem, 503);
}
async function acessoMembro(request: Request) {
  const acesso = await resolverAcesso(request, true);
  if (!acesso.contexto.membro) throw new AcessoError("Seu acesso precisa estar vinculado a um membro ativo.", 403);
  return { ...acesso, membroId: acesso.contexto.membro.id };
}
async function acessoEquipe(request: Request, acoes: string[]) {
  const acesso = await resolverAcesso(request);
  if (!acoes.some((acao) => podeAcessar(acesso.contexto, "gabinete", acao))) {
    throw new AcessoError("Você não possui permissão para esta ação no Gabinete.", 403);
  }
  return acesso;
}
async function lerObjeto(request: Request, campos: string[]) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => !campos.includes(key))) {
    throw new AcessoError("Solicitação inválida. Confira os campos e tente novamente.", 400);
  }
  return body as Record<string, unknown>;
}
function texto(value: unknown, nome: string, max: number, obrigatorio = false): string {
  if (value === undefined || value === null) {
    if (obrigatorio) throw new AcessoError(`Informe ${nome}.`, 400);
    return "";
  }
  if (typeof value !== "string" || value.trim().length > max || (obrigatorio && !value.trim())) {
    throw new AcessoError(`Informe ${nome} com até ${max} caracteres.`, 400);
  }
  return value.trim();
}
function camposAgenda(body: Record<string, unknown>, futuro = false) {
  if (!dataValida(body.data_atendimento) || (futuro && body.data_atendimento < obterDataAtualSaoPaulo())) {
    throw new AcessoError(futuro ? "Escolha uma data válida a partir de hoje." : "Informe uma data válida.", 400);
  }
  if (!horaValida(body.hora_atendimento ?? null)) throw new AcessoError("Informe um horário válido (HH:MM).", 400);
  if (!TIPOS_ATENDIMENTO.some((tipo) => tipo === body.tipo)) throw new AcessoError("Escolha um tipo de atendimento válido.", 400);
  return {
    data_atendimento: body.data_atendimento,
    hora_atendimento: body.hora_atendimento || null,
    tipo: body.tipo as string,
    motivo: texto(body.motivo, "o motivo do atendimento", 2000, futuro),
  };
}
function validarId(id: string) {
  if (!idValido(id)) throw new AcessoError("Identificador inválido.", 400);
}
function offsetDaConsulta(request: Request) {
  const value = new URL(request.url).searchParams.get("offset") || "0";
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new AcessoError("Página inválida.", 400);
  return Number(value);
}
async function membroDaIgreja(service: SupabaseClient, igrejaId: string, membroId: string) {
  validarId(membroId);
  const { data, error } = await service.from("membros").select("id")
    .eq("igreja_id", igrejaId).eq("id", membroId).maybeSingle();
  verificarErro(error, "Não foi possível conferir o membro selecionado.");
  if (!data) throw new AcessoError("Membro não encontrado na sua igreja.", 400);
}

export const carregarCuidadoMembro = handlerPrivado(async (request) => {
  const { contexto, service, membroId } = await acessoMembro(request);
  const offset = offsetDaConsulta(request);
  const [agenda, emocional] = await Promise.all([
    service.from("atendimentos_pastorais").select(CAMPOS_PESSOAIS)
      .eq("igreja_id", contexto.igrejaId).eq("membro_id", membroId)
      .order("created_at", { ascending: false }).order("id").range(offset, offset + TAMANHO_PAGINA),
    service.from("acompanhamento_emocional").select(CAMPOS_EMOCIONAIS)
      .eq("igreja_id", contexto.igrejaId).eq("membro_id", membroId)
      .order("created_at", { ascending: false }).order("id").range(offset, offset + TAMANHO_PAGINA),
  ]);
  verificarErro(agenda.error, "Não foi possível carregar seus atendimentos.");
  verificarErro(emocional.error, "Não foi possível carregar seu acompanhamento emocional.");
  return respostaPrivada({
    atendimentos: ((agenda.data || []).slice(0, TAMANHO_PAGINA) as unknown as AtendimentoPessoal[]).map(atendimentoParaMembro),
    registros: (emocional.data || []).slice(0, TAMANHO_PAGINA),
    hasMore: (agenda.data || []).length > TAMANHO_PAGINA || (emocional.data || []).length > TAMANHO_PAGINA,
  });
});

export const solicitarAtendimento = handlerPrivado(async (request) => {
  const { contexto, service, membroId } = await acessoMembro(request);
  const body = await lerObjeto(request, ["tipo", "motivo", "data_atendimento", "hora_atendimento"]);
  const agenda = camposAgenda(body, true);
  const { data, error } = await service.from("atendimentos_pastorais").insert({
    ...agenda, igreja_id: contexto.igrejaId, membro_id: membroId,
    nome_visitante: null, pastor_responsavel: RESPONSAVEL_PENDENTE,
    status: "Agendado", observacoes: null,
  }).select(CAMPOS_PESSOAIS).single();
  verificarErro(error, "Não foi possível registrar sua solicitação. Tente novamente.");
  return respostaPrivada({ atendimento: atendimentoParaMembro(data as unknown as AtendimentoPessoal) }, 201);
});

export async function cancelarAtendimento(request: Request, id: string) {
  try {
    const { contexto, service, membroId } = await acessoMembro(request);
    validarId(id);
    const body = await lerObjeto(request, ["acao"]);
    if (body.acao !== "cancelar") throw new AcessoError("Ação inválida.", 400);
    // A condição é aplicada na própria escrita: uma conclusão/cancelamento concorrente não é sobrescrito.
    const { data, error } = await service.from("atendimentos_pastorais").update({ status: "Cancelado" })
      .eq("id", id).eq("igreja_id", contexto.igrejaId).eq("membro_id", membroId)
      .eq("status", "Agendado").select(CAMPOS_PESSOAIS).maybeSingle();
    verificarErro(error, "Não foi possível cancelar o atendimento. Tente novamente.");
    if (!data) throw new AcessoError("Atendimento não encontrado ou já encerrado. Atualize seu histórico.", 409);
    return respostaPrivada({ atendimento: atendimentoParaMembro(data as unknown as AtendimentoPessoal) });
  } catch (error) { return respostaErroAcesso(error); }
}

export const registrarEmocao = handlerPrivado(async (request) => {
  const { contexto, service, membroId } = await acessoMembro(request);
  const body = await lerObjeto(request, ["emoji", "observacao"]);
  if (!EMOCOES.some((emocao) => emocao === body.emoji)) throw new AcessoError("Escolha um sentimento da lista.", 400);
  const observacao = texto(body.observacao, "a observação", 2000);
  // Atualizar o sentimento cria uma nova entrada, preservando a evolução para o acolhimento.
  const { data, error } = await service.from("acompanhamento_emocional").insert({
    igreja_id: contexto.igrejaId, membro_id: membroId, emoji: body.emoji, observacao: observacao || null,
  }).select(CAMPOS_EMOCIONAIS).single();
  verificarErro(error, "Não foi possível registrar como você está se sentindo. Tente novamente.");
  return respostaPrivada({ registro: data }, 201);
});

export const listarAtendimentosEquipe = handlerPrivado(async (request) => {
  const { contexto, service } = await acessoEquipe(request, ["ler"]);
  const offset = offsetDaConsulta(request);
  const { data, error } = await service.from("atendimentos_pastorais").select(CAMPOS_EQUIPE)
    .eq("igreja_id", contexto.igrejaId).order("data_atendimento", { ascending: false })
    .order("hora_atendimento", { ascending: false }).order("id").range(offset, offset + TAMANHO_PAGINA);
  verificarErro(error, "Não foi possível carregar os atendimentos da igreja.");
  return respostaPrivada({ atendimentos: (data || []).slice(0, TAMANHO_PAGINA).map((row) => isolarPessoaRelacionada(row, contexto.igrejaId)), hasMore: (data || []).length > TAMANHO_PAGINA });
});

async function carregarOpcoes(service: SupabaseClient, igrejaId: string, tabela: "membros" | "visitantes") {
  const rows: { id: string; nome: string; cargo?: string | null }[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await service.from(tabela).select(tabela === "membros" ? "id,nome,cargo" : "id,nome")
      .eq("igreja_id", igrejaId).order("nome").order("id").range(inicio, inicio + 999);
    verificarErro(error, "Não foi possível carregar as opções de atendimento.");
    rows.push(...(data || []) as unknown as typeof rows);
    if (!data || data.length < 1000) return rows;
  }
}
export const opcoesAtendimento = handlerPrivado(async (request) => {
  const { contexto, service } = await acessoEquipe(request, ["criar", "editar"]);
  const [membros, visitantes] = await Promise.all([
    carregarOpcoes(service, contexto.igrejaId, "membros"), carregarOpcoes(service, contexto.igrejaId, "visitantes"),
  ]);
  const pastores = membros.filter((membro) => /pastor|pastora|missionária|missionaria|evangelista/i.test(membro.cargo || ""));
  return respostaPrivada({ membros, visitantes, pastores });
});

export const criarAtendimentoEquipe = handlerPrivado(async (request) => {
  const { contexto, service } = await acessoEquipe(request, ["criar"]);
  const body = await lerObjeto(request, ["membro_id", "nome_visitante", "pastor_responsavel", "data_atendimento", "hora_atendimento", "tipo", "motivo", "observacoes", "status"]);
  const agenda = camposAgenda(body);
  const pastor = texto(body.pastor_responsavel, "o pastor ou responsável", 150, true);
  const visitante = texto(body.nome_visitante, "o nome do visitante", 150);
  const membroId = texto(body.membro_id, "o membro", 36);
  if (Boolean(membroId) === Boolean(visitante)) throw new AcessoError("Selecione um membro ou informe um visitante.", 400);
  if (membroId) await membroDaIgreja(service, contexto.igrejaId, membroId);
  if (!STATUS_ATENDIMENTO.some((status) => status === body.status)) throw new AcessoError("Selecione um status válido.", 400);
  if (body.status === "Realizado" && pastor === RESPONSAVEL_PENDENTE) throw new AcessoError("Informe o responsável antes de concluir o atendimento.", 400);
  const { data, error } = await service.from("atendimentos_pastorais").insert({
    ...agenda, igreja_id: contexto.igrejaId, membro_id: membroId || null, nome_visitante: visitante || null,
    pastor_responsavel: pastor, status: body.status,
    observacoes: texto(body.observacoes, "as observações sigilosas", 10000) || null,
  }).select(CAMPOS_EQUIPE).single();
  verificarErro(error, "Não foi possível registrar o atendimento. Tente novamente.");
  if (!data) throw new AcessoError("Não foi possível confirmar o registro do atendimento.", 503);
  return respostaPrivada({ atendimento: isolarPessoaRelacionada(data, contexto.igrejaId) }, 201);
});

export async function consultarAtendimentoEquipe(request: Request, id: string) {
  try {
    const { contexto, service } = await acessoEquipe(request, ["editar"]);
    validarId(id);
    const { data, error } = await service.from("atendimentos_pastorais").select(CAMPOS_EQUIPE)
      .eq("igreja_id", contexto.igrejaId).eq("id", id).maybeSingle();
    verificarErro(error, "Não foi possível carregar o atendimento.");
    if (!data) throw new AcessoError("Atendimento não encontrado na sua igreja.", 404);
    return respostaPrivada({ atendimento: isolarPessoaRelacionada(data, contexto.igrejaId) });
  } catch (error) { return respostaErroAcesso(error); }
}

export async function editarAtendimentoEquipe(request: Request, id: string) {
  try {
    const { contexto, service } = await acessoEquipe(request, ["editar"]);
    validarId(id);
    const body = await lerObjeto(request, ["pastor_responsavel", "data_atendimento", "hora_atendimento", "tipo", "motivo", "observacoes", "status", "status_anterior"]);
    const agenda = camposAgenda(body);
    const pastor = texto(body.pastor_responsavel, "o pastor ou responsável", 150, true);
    if (!STATUS_ATENDIMENTO.some((status) => status === body.status) ||
        !STATUS_ATENDIMENTO.some((status) => status === body.status_anterior)) throw new AcessoError("Selecione um status válido e atualize o atendimento.", 400);
    if (body.status_anterior !== "Agendado" && body.status !== body.status_anterior) {
      throw new AcessoError("Atendimento encerrado não pode ser reaberto ou ter seu status alterado.", 409);
    }
    if (body.status === "Realizado" && pastor === RESPONSAVEL_PENDENTE) throw new AcessoError("Informe o responsável antes de concluir o atendimento.", 400);
    const { data, error } = await service.from("atendimentos_pastorais").update({
      ...agenda, pastor_responsavel: pastor, status: body.status,
      observacoes: texto(body.observacoes, "as observações sigilosas", 10000) || null,
    }).eq("igreja_id", contexto.igrejaId).eq("id", id).eq("status", body.status_anterior)
      .select(CAMPOS_EQUIPE).maybeSingle();
    verificarErro(error, "Não foi possível salvar o atendimento. Tente novamente.");
    if (!data) throw new AcessoError("O atendimento foi alterado ou não pertence à sua igreja. Recarregue antes de salvar.", 409);
    return respostaPrivada({ atendimento: isolarPessoaRelacionada(data, contexto.igrejaId) });
  } catch (error) { return respostaErroAcesso(error); }
}

export const listarEmocionalEquipe = handlerPrivado(async (request) => {
  const { contexto, service } = await acessoEquipe(request, ["ler"]);
  const periodo = new URL(request.url).searchParams.get("periodo") || "mes";
  if (!["semana", "mes", "ano", "total"].includes(periodo)) throw new AcessoError("Período inválido.", 400);
  const offset = offsetDaConsulta(request);
  const corte = new Date();
  if (periodo === "semana") corte.setDate(corte.getDate() - 7);
  if (periodo === "mes") corte.setMonth(corte.getMonth() - 1);
  if (periodo === "ano") corte.setFullYear(corte.getFullYear() - 1);
  let query = service.from("acompanhamento_emocional").select(`${CAMPOS_EMOCIONAIS},membro_id,membros(nome,igreja_id)`)
    .eq("igreja_id", contexto.igrejaId);
  if (periodo !== "total") query = query.gte("created_at", corte.toISOString());
  const { data, error } = await query.order("created_at", { ascending: false }).order("id").range(offset, offset + TAMANHO_PAGINA);
  verificarErro(error, "Não foi possível carregar o acompanhamento emocional.");
  return respostaPrivada({ registros: (data || []).slice(0, TAMANHO_PAGINA).map((row) => isolarPessoaRelacionada(row, contexto.igrejaId)), hasMore: (data || []).length > TAMANHO_PAGINA });
});
