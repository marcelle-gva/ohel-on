import {
  resolverAcesso,
  respostaErroAcesso,
  AcessoError,
} from "@/lib/access-server";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { service, contexto } = await resolverAcesso(request, true);
    const { data: cestas, error } = await service
      .from("cestas_basicas")
      .select("id, nome, descricao, status")
      .eq("igreja_id", contexto.igrejaId)
      .eq("status", "aberta")
      .order("created_at", { ascending: false });
    if (error)
      throw new AcessoError(
        "Não foi possível consultar as campanhas da igreja.",
        503,
      );
    const ids = (cestas || []).map((cesta) => cesta.id);
    if (!ids.length)
      return Response.json(
        { cestas: [], itens: [], reservas: [] },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    const [itens, doacoes] = await Promise.all([
      service
        .from("cesta_itens")
        .select("id, cesta_id, nome, quantidade_necessaria, unidade")
        .eq("igreja_id", contexto.igrejaId)
        .in("cesta_id", ids)
        .order("created_at"),
      service
        .from("cesta_doacoes")
        .select("id, item_id, membro_id, quantidade, status, reservado_em")
        .eq("igreja_id", contexto.igrejaId)
        .in("cesta_id", ids),
    ]);
    if (itens.error || doacoes.error)
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
        cestas,
        itens: (itens.data || []).map((item) => ({
          ...item,
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
