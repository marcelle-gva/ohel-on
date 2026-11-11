import {
  resolverAcesso,
  respostaErroAcesso,
  AcessoError,
} from "@/lib/access-server";
import type { AvisoMembro, MonitorMembroData } from "@/lib/member-monitor";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { service, contexto } = await resolverAcesso(request, true);
    const igrejaId = contexto.igrejaId;
    const hoje = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Sao_Paulo",
    });
    const semana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // Não consulta membros, finanças, visitantes com telefone nem orações pendentes.
    const [avisos, eventos, louvores, oracoes, visitantes, culto] =
      await Promise.all([
        service
          .from("comunicacoes")
          .select("id, titulo, conteudo, imagem_url, created_at")
          .eq("igreja_id", igrejaId)
          .order("created_at", { ascending: false })
          .limit(100),
        service
          .from("eventos")
          .select(
            "id, nome, descricao, cartaz_url, galeria_urls, preco_ingresso, pregador_convidados, informacoes_adicionais, created_at",
          )
          .eq("igreja_id", igrejaId)
          .eq("publicar_mural", true)
          .order("created_at", { ascending: false })
          .limit(100),
        service
          .from("louvores")
          .select("id, titulo, tom, ministro, palavra_vinculada")
          .eq("igreja_id", igrejaId)
          .eq("data", hoje)
          .order("created_at")
          .limit(100),
        service
          .from("pedidos_oracao")
          .select("id, nome_solicitante, descricao")
          .eq("igreja_id", igrejaId)
          .eq("status", "Em Oração")
          .gte("created_at", semana)
          .order("created_at", { ascending: false })
          .limit(100),
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
      ]);
    if (
      [avisos, eventos, louvores, oracoes, visitantes, culto].some(
        (r) => r.error,
      )
    )
      throw new AcessoError(
        "Não foi possível carregar o Monitor. A secretaria deve conferir as migrations e a conexão do sistema.",
        503,
      );
    let palavra: MonitorMembroData["palavra"] = null;
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
    const comunicacoes: AvisoMembro[] = (avisos.data || []).map((item) => ({
      id: item.id,
      tipo: "aviso",
      titulo: item.titulo,
      conteudo: item.conteudo,
      imagem_url: item.imagem_url,
      fotos: item.imagem_url ? [item.imagem_url] : [],
      created_at: item.created_at,
    }));
    const eventosPublicados: AvisoMembro[] = (eventos.data || []).map(
      (item) => ({
        id: item.id,
        tipo: "evento",
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
      }),
    );
    const monitor: MonitorMembroData = {
      avisos: [...comunicacoes, ...eventosPublicados].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      ),
      louvores: louvores.data || [],
      oracoes: oracoes.data || [],
      visitantes: visitantes.count || 0,
      culto: culto.data,
      palavra,
    };
    return Response.json(
      { monitor },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return respostaErroAcesso(error);
  }
}
