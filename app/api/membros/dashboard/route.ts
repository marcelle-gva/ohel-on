import {
  AcessoError,
  respostaErroAcesso,
  resolverAcesso,
} from "@/lib/access-server";
import {
  criarMapaUrl,
  type AvisoDashboard,
  type DashboardMembroData,
} from "@/lib/member-dashboard";
import {
  encontrarProximoCulto,
  type ProgramacaoCultoFixa,
} from "@/lib/proximoCulto";

export const runtime = "nodejs";

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
        "Não foi possível carregar todos os conteúdos do dashboard. Tente atualizar novamente.",
        503,
      );
    }
    itens.push(...(data || []));
    if (!data || data.length < tamanhoPagina)
      return { data: itens, error: null };
  }
}

export async function GET(request: Request) {
  try {
    const { service, contexto } = await resolverAcesso(request, true);
    const igrejaId = contexto.igrejaId;
    const instanteConsulta = new Date().toISOString();
    const hoje = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Sao_Paulo",
    });
    const semana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Seleções explícitas: o dashboard nunca devolve dados administrativos,
    // contatos de visitantes, finanças ou pedidos de oração pendentes.
    const [avisos, eventos, louvores, oracoes, visitantes, culto, igreja, programacoesCulto] =
      await Promise.all([
        lerListaCompleta((inicio, fim) =>
          service
            .from("comunicacoes")
            .select("id, titulo, conteudo, imagem_url, created_at")
            .eq("igreja_id", igrejaId)
            .lte("created_at", instanteConsulta)
            .order("created_at", { ascending: false })
            .order("id")
            .range(inicio, fim),
        ),
        lerListaCompleta((inicio, fim) =>
          service
            .from("eventos")
            .select(
              "id, nome, descricao, cartaz_url, galeria_urls, preco_ingresso, pregador_convidados, informacoes_adicionais, data_inicio, data_fim, hora_abertura, created_at",
            )
            .eq("igreja_id", igrejaId)
            .eq("publicar_mural", true)
            .lte("created_at", instanteConsulta)
            .order("created_at", { ascending: false })
            .order("id")
            .range(inicio, fim),
        ),
        lerListaCompleta((inicio, fim) =>
          service
            .from("louvores")
            .select("id, titulo, tom, ministro, palavra_vinculada")
            .eq("igreja_id", igrejaId)
            .eq("data", hoje)
            .lte("created_at", instanteConsulta)
            .order("created_at")
            .order("id")
            .range(inicio, fim),
        ),
        lerListaCompleta((inicio, fim) =>
          service
            .from("pedidos_oracao")
            .select("id, nome_solicitante, descricao, created_at")
            .eq("igreja_id", igrejaId)
            .eq("status", "Em Oração")
            .gte("created_at", semana)
            .lte("created_at", instanteConsulta)
            .order("created_at", { ascending: false })
            .order("id")
            .range(inicio, fim),
        ),
        service
          .from("visitantes")
          .select("id", { count: "exact", head: true })
          .eq("igreja_id", igrejaId)
          .eq("data_visita", hoje),
        service
          .from("culto_sessoes")
          .select("id, titulo, link_ao_vivo")
          .eq("igreja_id", igrejaId)
          .eq("status", "aberto")
          .order("inicio_em", { ascending: false })
          .limit(1)
          .maybeSingle(),
        service
          .from("igrejas")
          .select("nome, endereco")
          .eq("id", contexto.igrejaId)
          .maybeSingle(),
        service
          .from("culto_modelos")
          .select("nome, tipo, dia_semana, horario_inicio, horario_fim, vigencia_desde")
          .eq("igreja_id", igrejaId)
          .eq("ativo", true),
      ]);

    if (
      [avisos, eventos, louvores, oracoes, visitantes, culto, programacoesCulto].some(
        (resultado) => resultado.error,
      )
    ) {
      throw new AcessoError(
        "Não foi possível carregar o dashboard. A secretaria deve conferir as migrations e a conexão do sistema.",
        503,
      );
    }
    if (igreja.error)
      throw new AcessoError(
        "Não foi possível carregar os dados da igreja.",
        503,
      );
    if (!igreja.data)
      throw new AcessoError("Igreja não encontrada para este acesso.", 403);

    let palavra: DashboardMembroData["palavra"] = null;
    if (culto.data) {
      const { data: registro } = await service
        .from("culto_registros")
        .select("titulo, payload")
        .eq("igreja_id", igrejaId)
        .eq("culto_id", culto.data.id)
        .eq("tipo", "projecao")
        .contains("payload", { tipo: "palavra" })
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (registro) {
        const payload = registro.payload as {
          referencia?: unknown;
          slides?: unknown;
        };
        palavra = {
          titulo: registro.titulo,
          referencia:
            typeof payload.referencia === "string" ? payload.referencia : null,
          slides: Array.isArray(payload.slides)
            ? payload.slides
                .filter((slide): slide is string => typeof slide === "string")
                .slice(0, 200)
            : [],
        };
      }
    }

    const comunicacoes: AvisoDashboard[] = (avisos.data || []).map((item) => ({
      id: item.id,
      tipo: "aviso",
      categoria: "aviso",
      titulo: item.titulo,
      conteudo: item.conteudo,
      imagem_url: item.imagem_url,
      fotos: item.imagem_url ? [item.imagem_url] : [],
      created_at: item.created_at,
    }));
    const eventosPublicados: AvisoDashboard[] = (eventos.data || []).map(
      (item) => ({
        id: item.id,
        tipo: "evento",
        categoria: "evento",
        titulo: item.nome,
        conteudo: item.descricao,
        imagem_url: item.cartaz_url,
        fotos: [item.cartaz_url, ...(item.galeria_urls || [])].filter(
          (url): url is string => typeof url === "string" && Boolean(url),
        ),
        created_at: item.created_at,
        preco_ingresso: item.preco_ingresso,
        pregador_convidados: item.pregador_convidados,
        informacoes_adicionais: item.informacoes_adicionais,
        data_inicio: item.data_inicio,
        data_fim: item.data_fim,
        hora_abertura: item.hora_abertura,
      }),
    );
    const oracoesPublicadas: AvisoDashboard[] = (oracoes.data || []).map((item) => ({
      id: `oracao-${item.id}`,
      tipo: "aviso",
      categoria: "oracao",
      titulo: `Pedido de oração · ${item.nome_solicitante || "Anônimo"}`,
      conteudo: item.descricao,
      imagem_url: null,
      fotos: [],
      created_at: item.created_at,
    }));
    const proximoCulto = encontrarProximoCulto(
      (programacoesCulto.data || []) as ProgramacaoCultoFixa[],
    );
    const avisoProximoCulto: AvisoDashboard[] = proximoCulto
      ? [{
          id: `proximo-culto-${proximoCulto.data_inicio}-${proximoCulto.hora_abertura}`,
          tipo: "aviso",
          categoria: "culto",
          titulo: `Próximo culto: ${proximoCulto.nome}`,
          conteudo: `${proximoCulto.tipo}. Este horário faz parte da programação fixa da igreja.`,
          imagem_url: null,
          fotos: [],
          created_at: instanteConsulta,
          data_inicio: proximoCulto.data_inicio,
          hora_abertura: proximoCulto.hora_abertura,
        }]
      : [];

    const igrejaNome =
      typeof igreja.data.nome === "string" && igreja.data.nome.trim()
        ? igreja.data.nome.trim()
        : contexto.igrejaNome;
    const endereco =
      typeof igreja.data.endereco === "string" && igreja.data.endereco.trim()
        ? igreja.data.endereco.trim()
        : null;
    const dashboard: DashboardMembroData = {
      avisos: [...comunicacoes, ...eventosPublicados, ...oracoesPublicadas, ...avisoProximoCulto].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      ),
      louvores: louvores.data || [],
      oracoes: oracoes.data || [],
      visitantes: visitantes.count || 0,
      culto: culto.data,
      palavra,
      igreja: {
        nome: igrejaNome,
        endereco,
        mapa_url: criarMapaUrl(igrejaNome, endereco),
      },
    };

    return Response.json(
      { dashboard },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return respostaErroAcesso(error);
  }
}
