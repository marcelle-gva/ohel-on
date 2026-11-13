import {
  resolverAcesso,
  respostaErroAcesso,
  AcessoError,
} from "@/lib/access-server";

export const runtime = "nodejs";

function colunaAusente(error: { code?: string; message?: string } | null | undefined) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("pgrst204") || text.includes("quantidade_cestas") || text.includes("quantidade_por_cesta");
}

export async function GET(request: Request) {
  try {
    const { service, contexto } = await resolverAcesso(request, true);
    const moderna = await service
      .from("cestas_basicas")
      .select("id, nome, descricao, status, quantidade_cestas")
      .eq("igreja_id", contexto.igrejaId)
      .eq("status", "aberta")
      .order("created_at", { ascending: false });
    let cestas = moderna.data as Array<{ id: string; nome: string; descricao: string | null; status: string; quantidade_cestas?: number | null }> | null;
    if (moderna.error && colunaAusente(moderna.error)) {
      const legada = await service
        .from("cestas_basicas")
        .select("id, nome, descricao, status")
        .eq("igreja_id", contexto.igrejaId)
        .eq("status", "aberta")
        .order("created_at", { ascending: false });
      if (legada.error) throw new AcessoError("Não foi possível consultar as campanhas da igreja.", 503);
      cestas = (legada.data || []).map((cesta) => ({ ...cesta, quantidade_cestas: 1 }));
    } else if (moderna.error) {
      throw new AcessoError(
        "Não foi possível consultar as campanhas da igreja.",
        503,
      );
    }
    cestas = cestas || [];
    const ids = (cestas || []).map((cesta) => cesta.id);
    if (!ids.length)
      return Response.json(
        { cestas: cestas || [], itens: [], reservas: [] },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    const modernaItens = await service
        .from("cesta_itens")
        .select("id, cesta_id, nome, quantidade_necessaria, quantidade_por_cesta, unidade")
        .eq("igreja_id", contexto.igrejaId)
        .in("cesta_id", ids)
        .order("created_at");
    let itens = modernaItens.data as Array<{ id: string; cesta_id: string; nome: string; quantidade_necessaria: number; quantidade_por_cesta?: number | null; unidade: string }> | null;
    if (modernaItens.error && colunaAusente(modernaItens.error)) {
      const legadaItens = await service
        .from("cesta_itens")
        .select("id, cesta_id, nome, quantidade_necessaria, unidade")
        .eq("igreja_id", contexto.igrejaId)
        .in("cesta_id", ids)
        .order("created_at");
      if (legadaItens.error) throw new AcessoError("Não foi possível atualizar o estoque das cestas.", 503);
      itens = (legadaItens.data || []).map((item) => ({ ...item, quantidade_por_cesta: null }));
    } else if (modernaItens.error) {
      throw new AcessoError("Não foi possível atualizar o estoque das cestas.", 503);
    }
    const [doacoes] = await Promise.all([
      service
        .from("cesta_doacoes")
        .select("id, item_id, membro_id, quantidade, status, reservado_em")
        .eq("igreja_id", contexto.igrejaId)
        .in("cesta_id", ids),
    ]);
    if (doacoes.error)
      throw new AcessoError(
        "Não foi possível atualizar o estoque das cestas.",
        503,
      );
    const totais = new Map<string, number>();
    for (const doacao of doacoes.data || [])
      if (doacao.status !== "cancelado")
        totais.set(
          doacao.item_id,
          (totais.get(doacao.item_id) || 0) + doacao.quantidade,
        );
    // Não retorna nomes, telefones ou reservas identificáveis de outros doadores.
    const reservas = (doacoes.data || [])
      .filter((doacao) => doacao.membro_id === contexto.membro!.id)
      .map(({ id, item_id, quantidade, status, reservado_em }) => ({
        id,
        item_id,
        quantidade,
        status,
        reservado_em,
      }));
    return Response.json(
      {
        cestas: (cestas || []).map((cesta) => ({ ...cesta, quantidade_cestas: Number(cesta.quantidade_cestas) || 1 })),
        itens: (itens || []).map((item) => ({
          ...item,
          quantidade_por_cesta: item.quantidade_por_cesta ?? null,
          quantidade_reservada: totais.get(item.id) || 0,
        })),
        reservas,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return respostaErroAcesso(error);
  }
}
