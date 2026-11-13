import { resolverAcesso, respostaErroAcesso } from "@/lib/access-server";
import { isUuid } from "@/lib/sorteios-admin";

export const runtime = "nodejs";

const SORTEIO_FIELDS = "id, igreja_id, nome, descricao, status, valor_bilhete, total_numeros, numero_inicial, numero_final, data_sorteio, cartaz_url, created_at, updated_at";
const PARTICIPANTE_FIELDS = "id, numero, nome, telefone, valor, status, observacoes, created_at, updated_at, origem, vendedor_membro_id, pagamento_manual_status, pagamento_manual_observacoes";
const MEMBRO_FIELDS = "id, nome, codigo_membro, status";

type RouteContext = { params: Promise<{ id: string }> };

function respostaInterna(message = "Não foi possível carregar os dados do sorteio.") {
  return Response.json({ error: message }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return Response.json({ error: "Identificador de sorteio inválido." }, { status: 400 });

    const { contexto, service } = await resolverAcesso(request);
    if (contexto.role !== "admin") {
      return Response.json({ error: "Somente administradores podem gerenciar sorteios." }, { status: 403 });
    }

    const sorteioResult = await service
      .from("sorteios")
      .select(SORTEIO_FIELDS)
      .eq("id", id)
      .eq("igreja_id", contexto.igrejaId)
      .maybeSingle();
    if (sorteioResult.error) return respostaInterna();
    if (!sorteioResult.data) return Response.json({ error: "Sorteio não encontrado nesta igreja." }, { status: 404 });

    const [participantesResult, membrosResult] = await Promise.all([
      service
        .from("sorteio_participantes")
        .select(PARTICIPANTE_FIELDS)
        .eq("sorteio_id", id)
        .eq("igreja_id", contexto.igrejaId)
        .order("numero", { ascending: true })
        .limit(5000),
      service
        .from("membros")
        .select(MEMBRO_FIELDS)
        .eq("igreja_id", contexto.igrejaId)
        .eq("status", "Ativo")
        .order("nome", { ascending: true })
        .limit(2000),
    ]);

    if (participantesResult.error || membrosResult.error) return respostaInterna();
    const membros = membrosResult.data || [];
    const nomes = new Map(membros.map((membro) => [membro.id, membro.nome]));
    const participantes = (participantesResult.data || []).map((participante) => ({
      ...participante,
      vendedor_nome: participante.vendedor_membro_id ? nomes.get(participante.vendedor_membro_id) || null : null,
    }));

    return Response.json(
      { sorteio: sorteioResult.data, participantes, membros },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return error instanceof Error && "status" in error
      ? Response.json({ error: error.message }, { status: Number((error as { status?: number }).status) || 500 })
      : respostaErroAcesso(error);
  }
}
