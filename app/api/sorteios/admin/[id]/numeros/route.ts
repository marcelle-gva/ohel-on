import { resolverAcesso, respostaErroAcesso } from "@/lib/access-server";
import { isUuid, parseNumeroManual, validarCadastroComprador } from "@/lib/sorteios-admin";
import { criarClienteComSessao } from "@/lib/sorteios-admin-server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

type ManualBody = {
  numero?: unknown;
  vendedorMembroId?: unknown;
  nome?: unknown;
  telefone?: unknown;
  observacoes?: unknown;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return Response.json({ error: "Identificador de sorteio inválido." }, { status: 400 });

    const { contexto } = await resolverAcesso(request);
    if (contexto.role !== "admin") {
      return Response.json({ error: "Somente administradores podem cadastrar números manualmente." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as ManualBody;
    const numero = parseNumeroManual(body.numero);
    if (numero === null) return Response.json({ error: "Informe um número inteiro válido." }, { status: 400 });
    if (!isUuid(body.vendedorMembroId)) return Response.json({ error: "Selecione um membro vendedor válido." }, { status: 400 });
    const compradorError = validarCadastroComprador(body.nome, body.telefone);
    if (compradorError) return Response.json({ error: compradorError }, { status: 400 });
    const observacoes = typeof body.observacoes === "string" ? body.observacoes.trim().slice(0, 500) : "";

    // A função lê auth.uid() do JWT do administrador e bloqueia ocupação sob lock
    // da rifa; o cliente de sessão não expõe nenhuma chave de servidor.
    const sessionClient = criarClienteComSessao(request);
    const { data, error } = await sessionClient.rpc("registrar_numero_manual_sorteio", {
      p_sorteio_id: id,
      p_numero: numero,
      p_vendedor_membro_id: body.vendedorMembroId,
      p_nome: (body.nome as string).trim(),
      p_telefone: (body.telefone as string).trim(),
      p_observacoes: observacoes || null,
    });

    if (error) {
      if (error.code === "23505" || /ocupado|unique/i.test(error.message || "")) {
        return Response.json({ error: "Número já está ocupado neste sorteio." }, { status: 409 });
      }
      if (error.code === "42501") return Response.json({ error: error.message }, { status: 403 });
      if (error.code === "22023") return Response.json({ error: error.message }, { status: 400 });
      return Response.json({ error: "Não foi possível cadastrar o número manualmente." }, { status: 503 });
    }

    return Response.json({ participante: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return error instanceof Error && "status" in error
      ? Response.json({ error: error.message }, { status: Number((error as { status?: number }).status) || 500 })
      : respostaErroAcesso(error);
  }
}
