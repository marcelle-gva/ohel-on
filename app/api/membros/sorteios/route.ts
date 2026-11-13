import {
  AcessoError,
  respostaErroAcesso,
  resolverAcesso,
} from "@/lib/access-server";
import {
  obterDataAtualSaoPaulo,
  selecionarSorteiosAtivos,
  type SorteioMembroFonte,
} from "@/lib/member-raffles";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { service, contexto } = await resolverAcesso(request, true);
    const { data, error } = await service
      .from("sorteios")
      .select(
        "id, tipo, status, nome, descricao, valor_bilhete, data_sorteio, cartaz_url, created_at",
      )
      .eq("igreja_id", contexto.igrejaId)
      .eq("tipo", "sorteio")
      .eq("status", "ativo")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      throw new AcessoError(
        "Não foi possível carregar os sorteios ativos da sua igreja.",
        503,
      );
    }
    const sorteios = selecionarSorteiosAtivos(
      (data || []) as SorteioMembroFonte[],
      obterDataAtualSaoPaulo(),
    );
    return Response.json(
      { sorteios },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return respostaErroAcesso(error);
  }
}
