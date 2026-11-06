import {
  resolverAcesso,
  respostaErroAcesso,
  AcessoError,
} from "@/lib/access-server";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { contexto } = await resolverAcesso(request, true);
    return Response.json(
      { membro: { ...contexto.membro, igreja_id: contexto.igrejaId } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return respostaErroAcesso(error);
  }
}

function distancia(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) *
      Math.cos(rad(lat2)) *
      Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export async function POST(request: Request) {
  try {
    const { contexto, service } = await resolverAcesso(request, true);
    const body = (await request.json().catch(() => null)) as {
      latitude?: unknown;
      longitude?: unknown;
    } | null;
    const latitude = body?.latitude;
    const longitude = body?.longitude;
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    )
      throw new AcessoError("Localização inválida.", 400);
    const { data: configs, error } = await service
      .from("config_checkin")
      .select(
        "nome_evento, horario_inicio, horario_fim, latitude_igreja, longitude_igreja, raio_metros",
      )
      .eq("igreja_id", contexto.igrejaId)
      .order("horario_inicio");
    if (error)
      throw new AcessoError(
        "Não foi possível consultar a configuração do check-in.",
        503,
      );
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const horaAtual =
      Number(parts.find((part) => part.type === "hour")?.value) * 60 +
      Number(parts.find((part) => part.type === "minute")?.value);
    const minutos = (horario: string) => {
      const [h, m] = horario.split(":").map(Number);
      return h * 60 + m;
    };
    const evento = (configs || []).find((conf) => {
      const inicio = minutos(conf.horario_inicio);
      const fim = minutos(conf.horario_fim);
      return inicio <= fim
        ? horaAtual >= inicio && horaAtual <= fim
        : horaAtual >= inicio || horaAtual <= fim;
    });
    const status = evento ? "Normal" : "Fora de Horário";
    const observacoes: string[] = [];
    if (
      evento?.nome_evento.toLowerCase().includes("louvor") &&
      !contexto.membro?.departamento?.toLowerCase().includes("louvor")
    )
      observacoes.push("Tentou check-in no louvor sem estar no ministério.");
    const local = evento || configs?.[0];
    if (
      local &&
      local.latitude_igreja != null &&
      local.longitude_igreja != null
    ) {
      const metros = distancia(
        latitude,
        longitude,
        Number(local.latitude_igreja),
        Number(local.longitude_igreja),
      );
      if (metros > Number(local.raio_metros))
        observacoes.push(
          `Fora do raio de ${local.raio_metros}m. Distância: ${metros.toFixed(0)}m.`,
        );
    }
    const { error: insertError } = await service
      .from("checkins")
      .insert({
        igreja_id: contexto.igrejaId,
        membro_id: contexto.membro!.id,
        tipo_evento: evento?.nome_evento || "Geral",
        metodo: "GPS",
        latitude,
        longitude,
        status,
        observacao: observacoes.join(" "),
      });
    if (insertError)
      throw new AcessoError(
        "Não foi possível registrar sua presença. Tente novamente.",
        409,
      );
    return Response.json({
      ok: true,
      status,
      evento: evento?.nome_evento || "Fora de Horário",
      mensagem: evento
        ? `Check-in realizado com sucesso no ${evento.nome_evento}!`
        : "Não há eventos acontecendo neste horário. Seu check-in foi registrado como Fora de Horário para análise da igreja.",
    });
  } catch (error) {
    return respostaErroAcesso(error);
  }
}
