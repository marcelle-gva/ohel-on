import {
  AcessoError,
  resolverAcesso,
  respostaErroAcesso,
} from "@/lib/access-server";
import { podeAcessar } from "@/lib/access";
import { combinarSugestoes } from "@/lib/cestas";

export const runtime = "nodejs";
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "private, no-store" };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_QUANTIDADE = 100_000;

type Acesso = Awaited<ReturnType<typeof resolverAcesso>>;
type Service = Acesso["service"];
type Contexto = Acesso["contexto"];

type CestaRow = {
  id: string;
  nome: string;
  descricao: string | null;
  status: string;
  quantidade_cestas?: number | null;
  created_at?: string;
};

type ItemRow = {
  id: string;
  cesta_id: string;
  nome: string;
  quantidade_necessaria: number;
  quantidade_por_cesta?: number | null;
  unidade: string;
  created_at?: string;
};

function texto(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function uuid(value: unknown) {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function inteiro(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : fallback;
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function colunaAusente(error: { code?: string; message?: string } | null | undefined) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("pgrst204") || text.includes("quantidade_cestas") || text.includes("quantidade_por_cesta") || text.includes("column") && text.includes("does not exist");
}

function resposta(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

function exigirPermissao(contexto: Contexto, acao: "ler" | "criar" | "editar" | "excluir") {
  return podeAcessar(contexto, "cestas", acao)
    ? null
    : resposta("Seu grupo não tem esta permissão no módulo Cestas Básicas.", 403);
}

function mensagemOperacao(error: { message?: string } | null | undefined) {
  const raw = error?.message || "";
  if (raw.includes("menor que o total reservado") || raw.includes("abaixo do reservado")) {
    return "A nova meta não pode ser menor que o total reservado ou entregue. Aumente a quantidade ou mantenha o valor atual.";
  }
  if (raw.includes("item legado")) {
    return "Há item legado sem quantidade por cesta. Edite esse item primeiro para informar sua quantidade por cesta; nenhuma reserva foi alterada.";
  }
  if (raw.includes("histórico de reservas")) return "Não é possível excluir um item com histórico de reservas ou entregas. Edite a meta sem destruir o histórico.";
  if (raw.includes("campanha aberta")) return "Só é possível editar uma campanha aberta.";
  if (raw.includes("não encontrado")) return "O registro não foi encontrado nesta igreja.";
  if (colunaAusente(error) || raw.includes("Could not find the function")) return "A migration de quantidades de cestas ainda não foi aplicada. Nenhuma alteração foi feita.";
  return "Não foi possível salvar a alteração da campanha. Tente novamente.";
}

async function consultarCampanhas(service: Service, igrejaId: string) {
  const moderna = await service
    .from("cestas_basicas")
    .select("id, nome, descricao, status, quantidade_cestas, created_at")
    .eq("igreja_id", igrejaId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!moderna.error) return (moderna.data || []) as CestaRow[];
  if (!colunaAusente(moderna.error)) throw new AcessoError("Não foi possível carregar as campanhas de cestas.", 503);

  const legada = await service
    .from("cestas_basicas")
    .select("id, nome, descricao, status, created_at")
    .eq("igreja_id", igrejaId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (legada.error) throw new AcessoError("Não foi possível carregar as campanhas de cestas.", 503);
  return ((legada.data || []) as CestaRow[]).map((cesta) => ({ ...cesta, quantidade_cestas: 1 }));
}

async function consultarItens(service: Service, igrejaId: string, cestaIds: string[]) {
  if (!cestaIds.length) return [] as ItemRow[];
  const moderna = await service
    .from("cesta_itens")
    .select("id, cesta_id, nome, quantidade_necessaria, quantidade_por_cesta, unidade, created_at")
    .eq("igreja_id", igrejaId)
    .in("cesta_id", cestaIds)
    .order("created_at")
    .limit(500);
  if (!moderna.error) return (moderna.data || []) as ItemRow[];
  if (!colunaAusente(moderna.error)) throw new AcessoError("Não foi possível carregar os itens das cestas.", 503);

  const legada = await service
    .from("cesta_itens")
    .select("id, cesta_id, nome, quantidade_necessaria, unidade, created_at")
    .eq("igreja_id", igrejaId)
    .in("cesta_id", cestaIds)
    .order("created_at")
    .limit(500);
  if (legada.error) throw new AcessoError("Não foi possível carregar os itens das cestas.", 503);
  return ((legada.data || []) as ItemRow[]).map((item) => ({ ...item, quantidade_por_cesta: null }));
}

function validarQuantidade(value: unknown, label: string) {
  const parsed = inteiro(value);
  if (parsed < 1 || parsed > MAX_QUANTIDADE) throw new AcessoError(`${label} deve ser um número inteiro entre 1 e ${MAX_QUANTIDADE}.`, 400);
  return parsed;
}

async function criarCampanha(service: Service, contexto: Contexto, userId: string, values: Record<string, unknown>) {
  const nome = texto(values.nome, 160);
  const descricao = texto(values.descricao, 2000);
  const quantidadeCestas = validarQuantidade(values.quantidadeCestas, "A quantidade de cestas");
  if (!nome) return resposta("Informe o nome da campanha.");

  const moderna = await service
    .from("cestas_basicas")
    .insert({ igreja_id: contexto.igrejaId, nome, descricao, quantidade_cestas: quantidadeCestas, created_by: userId })
    .select("id, nome, descricao, status, quantidade_cestas, created_at")
    .single();
  if (!moderna.error) return Response.json({ ok: true, campanha: moderna.data }, { status: 201, headers: NO_STORE });
  if (quantidadeCestas !== 1 || !colunaAusente(moderna.error)) return resposta("Não foi possível criar a campanha. Verifique a migration e tente novamente.", 503);

  const legada = await service
    .from("cestas_basicas")
    .insert({ igreja_id: contexto.igrejaId, nome, descricao, created_by: userId })
    .select("id, nome, descricao, status, created_at")
    .single();
  if (legada.error) return resposta("Não foi possível criar a campanha. Verifique a configuração das cestas.", 503);
  return Response.json({ ok: true, campanha: { ...legada.data, quantidade_cestas: 1 } }, { status: 201, headers: NO_STORE });
}

async function criarItem(service: Service, contexto: Contexto, values: Record<string, unknown>) {
  const cestaId = uuid(values.cestaId);
  const nome = texto(values.nome, 160);
  const unidade = texto(values.unidade, 60) || "unidade";
  const quantidadePorCesta = validarQuantidade(values.quantidadePorCesta, "A quantidade por cesta");
  if (!cestaId || !nome) return resposta("Informe a campanha e o nome do item.");

  const insercao = await service.rpc("criar_item_cesta", {
    p_cesta_id: cestaId,
    p_igreja_id: contexto.igrejaId,
    p_nome: nome,
    p_unidade: unidade,
    p_quantidade_por_cesta: quantidadePorCesta,
  });
  if (insercao.error) return resposta(mensagemOperacao(insercao.error), 409);
  return Response.json({ ok: true, item: insercao.data }, { status: 201, headers: NO_STORE });
}

export async function GET(request: Request) {
  try {
    const { contexto, service } = await resolverAcesso(request);
    const denied = exigirPermissao(contexto, "ler");
    if (denied) return denied;

    const cestas = await consultarCampanhas(service, contexto.igrejaId);
    const ids = cestas.map((cesta) => cesta.id);
    const [itens, doacoes, historico] = await Promise.all([
      consultarItens(service, contexto.igrejaId, ids),
      ids.length
        ? service.from("cesta_doacoes").select("id, cesta_id, item_id, nome_doador, quantidade, status, reservado_em, whatsapp_doador_status, whatsapp_responsaveis_status").eq("igreja_id", contexto.igrejaId).in("cesta_id", ids).order("reservado_em", { ascending: false }).limit(1000)
        : Promise.resolve({ data: [], error: null }),
      service.from("cesta_itens").select("nome, unidade").eq("igreja_id", contexto.igrejaId).order("created_at", { ascending: false }).limit(100),
    ]);
    if (doacoes.error) throw new AcessoError("Não foi possível carregar as reservas das cestas.", 503);

    const responsaveis = podeAcessar(contexto, "cestas", "criar")
      ? await service.from("cestas_responsaveis").select("id, nome, telefone, ativo, notificar_reserva").eq("igreja_id", contexto.igrejaId).order("nome").limit(100)
      : { data: [], error: null };
    if (responsaveis.error) throw new AcessoError("Não foi possível carregar os responsáveis de WhatsApp.", 503);

    return Response.json({
      cestas: cestas.map((cesta) => ({ ...cesta, quantidade_cestas: Number(cesta.quantidade_cestas) || 1 })),
      itens,
      reservas: doacoes.data || [],
      responsaveis: responsaveis.data || [],
      sugestoes: combinarSugestoes((historico.data || []) as Array<{ nome: string; unidade: string }>),
    }, { headers: NO_STORE });
  } catch (error) {
    return respostaErroAcesso(error);
  }
}

export async function POST(request: Request) {
  try {
    const { contexto, service, user } = await resolverAcesso(request);
    const values = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!values) return resposta("Dados inválidos.");
    const action = typeof values.action === "string" ? values.action : "";
    const permissao = action === "criar-responsavel" || action === "criar-campanha" || action === "criar-item" ? "criar" : "criar";
    const denied = exigirPermissao(contexto, permissao);
    if (denied) return denied;

    if (action === "criar-campanha") return criarCampanha(service, contexto, user.id, values);
    if (action === "criar-item") return criarItem(service, contexto, values);
    if (action === "criar-responsavel") {
      const nome = texto(values.nome, 160);
      const telefone = texto(values.telefone, 40);
      if (!nome || !telefone) return resposta("Informe o nome e o WhatsApp do responsável.");
      const result = await service.from("cestas_responsaveis").insert({ igreja_id: contexto.igrejaId, nome, telefone, ativo: true, notificar_reserva: true });
      if (result.error) return resposta("Não foi possível adicionar o responsável.", 503);
      return Response.json({ ok: true }, { status: 201, headers: NO_STORE });
    }
    return resposta("Ação de cestas desconhecida.");
  } catch (error) {
    return respostaErroAcesso(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { contexto, service } = await resolverAcesso(request);
    const values = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!values) return resposta("Dados inválidos.");
    const action = typeof values.action === "string" ? values.action : "";
    const permissao = action === "encerrar-campanha" ? "editar" : "editar";
    const denied = exigirPermissao(contexto, permissao);
    if (denied) return denied;

    const cestaId = uuid(values.cestaId);
    if (action === "editar-campanha") {
      if (!cestaId) return resposta("Campanha inválida.");
      const nome = texto(values.nome, 160);
      const descricao = texto(values.descricao, 2000);
      if (!nome) return resposta("Informe o nome da campanha.");
      const result = await service.from("cestas_basicas").update({ nome, descricao }).eq("id", cestaId).eq("igreja_id", contexto.igrejaId).select("id, nome, descricao, status, quantidade_cestas, created_at").maybeSingle();
      if (!result.error && result.data) return Response.json({ ok: true, campanha: { ...result.data, quantidade_cestas: Number(result.data.quantidade_cestas) || 1 } }, { headers: NO_STORE });
      if (result.error && colunaAusente(result.error)) {
        const legado = await service.from("cestas_basicas").update({ nome, descricao }).eq("id", cestaId).eq("igreja_id", contexto.igrejaId).select("id, nome, descricao, status, created_at").maybeSingle();
        if (legado.error) return resposta("Não foi possível editar a campanha.", 503);
        if (!legado.data) return resposta("Campanha não encontrada nesta igreja.", 404);
        return Response.json({ ok: true, campanha: { ...legado.data, quantidade_cestas: 1 } }, { headers: NO_STORE });
      }
      if (result.error) return resposta("Não foi possível editar a campanha.", 503);
      return resposta("Campanha não encontrada nesta igreja.", 404);
    }
    if (action === "quantidade-cestas") {
      if (!cestaId) return resposta("Campanha inválida.");
      const quantidadeCestas = validarQuantidade(values.quantidadeCestas, "A quantidade de cestas");
      const result = await service.rpc("editar_quantidade_cestas", { p_cesta_id: cestaId, p_igreja_id: contexto.igrejaId, p_quantidade_cestas: quantidadeCestas });
      if (result.error) return resposta(mensagemOperacao(result.error), colunaAusente(result.error) ? 503 : 409);
      return Response.json({ ok: true, resultado: result.data }, { headers: NO_STORE });
    }
    if (action === "editar-item") {
      const itemId = uuid(values.itemId);
      const nome = texto(values.nome, 160);
      const unidade = texto(values.unidade, 60);
      const quantidadePorCesta = validarQuantidade(values.quantidadePorCesta, "A quantidade por cesta");
      if (!itemId || !nome || !unidade) return resposta("Informe item, nome e unidade.");
      const result = await service.rpc("editar_item_cesta", { p_item_id: itemId, p_igreja_id: contexto.igrejaId, p_nome: nome, p_unidade: unidade, p_quantidade_por_cesta: quantidadePorCesta });
      if (result.error) return resposta(mensagemOperacao(result.error), colunaAusente(result.error) ? 503 : 409);
      return Response.json({ ok: true, resultado: result.data }, { headers: NO_STORE });
    }
    if (action === "encerrar-campanha") {
      if (!cestaId) return resposta("Campanha inválida.");
      const result = await service.from("cestas_basicas").update({ status: "encerrada" }).eq("id", cestaId).eq("igreja_id", contexto.igrejaId).eq("status", "aberta").select("id, status").maybeSingle();
      if (result.error) return resposta("Não foi possível encerrar a campanha.", 503);
      if (!result.data) return resposta("A campanha não está aberta ou não pertence à sua igreja.", 409);
      return Response.json({ ok: true, campanha: result.data }, { headers: NO_STORE });
    }
    return resposta("Ação de cestas desconhecida.");
  } catch (error) {
    return respostaErroAcesso(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { contexto, service } = await resolverAcesso(request);
    const denied = exigirPermissao(contexto, "excluir");
    if (denied) return denied;
    const itemId = uuid(new URL(request.url).searchParams.get("itemId"));
    if (!itemId) return resposta("Item inválido.");

    const result = await service.rpc("excluir_item_cesta", { p_item_id: itemId, p_igreja_id: contexto.igrejaId });
    if (result.error) return resposta(mensagemOperacao(result.error), 409);
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    return respostaErroAcesso(error);
  }
}
