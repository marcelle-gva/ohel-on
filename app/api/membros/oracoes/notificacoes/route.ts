import {
  AcessoError,
  respostaErroAcesso,
  resolverAcesso,
} from "@/lib/access-server";
import {
  projetarOracaoPublicada,
  ordenarNotificacoesOracao,
  type PrayerNotificationRow,
} from "@/lib/member-prayer-notifications";
import {
  STATUS_ORACAO_PUBLICADA,
  VISIBILIDADE_ORACAO_PUBLICA,
} from "@/lib/mural-rules";

export const runtime = "nodejs";

const CAMPOS_PUBLICOS_ORACAO =
  "id, nome_solicitante, descricao, created_at, status, visibilidade";

async function lerListaCompleta<T>(
  criarConsulta: (
    inicio: number,
    fim: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const itens: T[] = [];
  const tamanhoPagina = 100;
  for (let inicio = 0; ; inicio += tamanhoPagina) {
    const { data, error } = await criarConsulta(
      inicio,
      inicio + tamanhoPagina - 1,
    );
    if (error) {
      throw new AcessoError(
        "Não foi possível carregar as notificações de oração. Tente novamente.",
        503,
      );
    }
    itens.push(...(data || []));
    if (!data || data.length < tamanhoPagina) return itens;
  }
}

export async function GET(request: Request) {
  try {
    const { contexto, service } = await resolverAcesso(request, true);
    if (!contexto.membro) {
      throw new AcessoError(
        "Seu acesso precisa estar vinculado a um membro ativo. Procure a secretaria.",
        403,
      );
    }

    // O filtro é repetido no servidor e na projeção para que nenhuma oração
    // pendente/privada chegue ao membro mesmo que a política evolua depois.
    const data = await lerListaCompleta((inicio, fim) =>
      service
        .from("pedidos_oracao")
        .select(CAMPOS_PUBLICOS_ORACAO)
        .eq("igreja_id", contexto.igrejaId)
        .eq("status", STATUS_ORACAO_PUBLICADA)
        .eq("visibilidade", VISIBILIDADE_ORACAO_PUBLICA)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(inicio, fim),
    );

    const notifications = ordenarNotificacoesOracao(
      ((data || []) as PrayerNotificationRow[])
        .map((row) => projetarOracaoPublicada(row, contexto.igrejaId))
        .filter((item) => item !== null),
    );

    return Response.json(
      {
        notifications,
        scope: {
          membroId: contexto.membro.id,
          igrejaId: contexto.igrejaId,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return respostaErroAcesso(error);
  }
}
