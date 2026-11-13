export const ORACOES_PAGE_SIZE = 500;

export interface PedidoOracao {
  id: string;
  nome_solicitante: string | null;
  descricao: string | null;
  visibilidade: string | null;
  status: string | null;
  created_at: string;
}

export interface OracaoFormValues {
  nome_solicitante: string;
  descricao: string;
  visibilidade: string;
  status: string;
}

export interface SequenciadorConsultas {
  proxima(): number;
  invalidar(): number;
  vigente(token: number): boolean;
}

type ErroSupabase = { message?: string; code?: string } | null;
type RespostaSupabase<T> = { data: T | null; error: ErroSupabase };

type QueryBuilder = {
  select(columns: string): QueryBuilder;
  update(values: OracaoFormValues): QueryBuilder;
  delete(): QueryBuilder;
  eq(column: string, value: string): QueryBuilder;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder;
  range(from: number, to: number): QueryBuilder;
  maybeSingle<T = unknown>(): Promise<RespostaSupabase<T>>;
};

export interface OracoesClient {
  from(table: string): unknown;
  auth?: {
    getSession(): Promise<{
      data: { session: { user?: { id?: string | null } | null } | null };
      error: ErroSupabase;
    }>;
  };
}

const CAMPOS_ORACAO = "id, nome_solicitante, descricao, visibilidade, status, created_at";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function queryDo(client: OracoesClient): QueryBuilder {
  return client.from("pedidos_oracao") as QueryBuilder;
}

async function executarQuery<T>(query: QueryBuilder): Promise<RespostaSupabase<T>> {
  return await (query as unknown as PromiseLike<RespostaSupabase<T>>);
}

function exigirUuid(value: string, label: string): void {
  if (!isUuid(value)) throw new Error(`${label} inválido.`);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isIgrejaValida(value: unknown): value is string {
  return isUuid(value);
}

export function criarSequenciadorConsultas(): SequenciadorConsultas {
  let atual = 0;
  return {
    proxima: () => {
      atual += 1;
      return atual;
    },
    invalidar: () => {
      atual += 1;
      return atual;
    },
    vigente: (token: number) => token === atual,
  };
}

export async function obterIgrejaDaSessao(client: OracoesClient): Promise<string | null> {
  if (!client.auth) throw new Error("Cliente autenticado indisponível.");

  const { data: sessaoData, error: sessaoError } = await client.auth.getSession();
  if (sessaoError) throw sessaoError;

  const usuarioId = sessaoData.session?.user?.id;
  if (!usuarioId) return null;

  const usuarioQuery = client.from("usuarios") as QueryBuilder;
  const { data: usuario, error: usuarioError } = await usuarioQuery
    .select("igreja_id")
    .eq("id", usuarioId)
    .maybeSingle<{ igreja_id: string | null }>();
  if (usuarioError) throw usuarioError;

  return isIgrejaValida(usuario?.igreja_id) ? usuario.igreja_id : null;
}

export async function listarOracoes(
  client: OracoesClient,
  igrejaId: string,
): Promise<PedidoOracao[]> {
  exigirUuid(igrejaId, "Igreja");

  const pedidos = new Map<string, PedidoOracao>();
  for (let inicio = 0; ; inicio += ORACOES_PAGE_SIZE) {
    const query = queryDo(client)
      .select(CAMPOS_ORACAO)
      .eq("igreja_id", igrejaId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(inicio, inicio + ORACOES_PAGE_SIZE - 1);
    const { data, error } = await executarQuery<PedidoOracao[]>(query);
    if (error) throw error;
    for (const pedido of data || []) pedidos.set(pedido.id, pedido);
    if (!data || data.length < ORACOES_PAGE_SIZE) break;
  }
  return [...pedidos.values()];
}

export async function obterOracao(
  client: OracoesClient,
  igrejaId: string,
  id: string,
): Promise<PedidoOracao | null> {
  exigirUuid(igrejaId, "Igreja");
  exigirUuid(id, "Pedido");

  const { data, error } = await queryDo(client)
    .select(CAMPOS_ORACAO)
    .eq("igreja_id", igrejaId)
    .eq("id", id)
    .maybeSingle<PedidoOracao>();
  if (error) throw error;
  return data;
}

export interface ResultadoMutacaoOracao {
  id: string | null;
  confirmado: boolean;
}

export async function excluirOracao(
  client: OracoesClient,
  igrejaId: string,
  id: string,
): Promise<ResultadoMutacaoOracao> {
  exigirUuid(igrejaId, "Igreja");
  exigirUuid(id, "Pedido");

  const { data, error } = await queryDo(client)
    .delete()
    .eq("id", id)
    .eq("igreja_id", igrejaId)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw error;

  const confirmado = Boolean(data?.id);
  return { id: confirmado ? data!.id : null, confirmado };
}

export async function atualizarOracao(
  client: OracoesClient,
  igrejaId: string,
  id: string,
  values: OracaoFormValues,
): Promise<ResultadoMutacaoOracao> {
  exigirUuid(igrejaId, "Igreja");
  exigirUuid(id, "Pedido");

  const { data, error } = await queryDo(client)
    .update(values)
    .eq("id", id)
    .eq("igreja_id", igrejaId)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw error;

  const confirmado = Boolean(data?.id);
  return { id: confirmado ? data!.id : null, confirmado };
}
