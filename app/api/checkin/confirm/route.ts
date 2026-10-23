import { createHash } from "node:crypto";
import { ApiError, getApiContext, jsonApiError } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

type CheckinRequest = {
  memberId?: unknown;
  method?: unknown;
  token?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

type CheckinConfiguration = {
  nome_evento: string;
  horario_inicio: string;
  horario_fim: string;
  latitude_igreja: number | null;
  longitude_igreja: number | null;
  raio_metros: number | null;
};

type CheckinLocation = CheckinConfiguration & {
  latitude_igreja: number;
  longitude_igreja: number;
  raio_metros: number;
};

function distanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = radians(lat2 - lat1);
  const deltaLon = radians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function minutesSinceMidnight(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

export async function POST(request: Request) {
  try {
    const context = await getApiContext(request);
    let body: CheckinRequest;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "O corpo da solicitação não é um JSON válido.");
    }

    const memberId = typeof body.memberId === "string" ? body.memberId : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId)) {
      throw new ApiError(400, "Cadastro de membro inválido.");
    }
    const method = body.method === "GPS" || body.method === "QR Code" ? body.method : null;
    if (!method) throw new ApiError(400, "Método de check-in inválido.");

    const latitude = typeof body.latitude === "number" ? body.latitude : null;
    const longitude = typeof body.longitude === "number" ? body.longitude : null;
    if (method === "GPS" && (
      latitude === null || longitude === null
      || !Number.isFinite(latitude) || !Number.isFinite(longitude)
      || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
    )) {
      throw new ApiError(400, "Não foi possível validar uma localização GPS.");
    }

    const { data: member, error: memberError } = await context.admin
      .from("membros")
      .select("id, igreja_id, nome, email")
      .eq("id", memberId)
      .eq("igreja_id", context.churchId)
      .maybeSingle();
    if (memberError) throw new ApiError(500, "Não foi possível validar o cadastro do membro.");
    const userEmail = context.user.email?.trim().toLocaleLowerCase();
    if (!member || !userEmail || member.email?.trim().toLocaleLowerCase() !== userEmail) {
      throw new ApiError(403, "Este cadastro de membro não está vinculado à sua conta.");
    }

    const { data: serverTime, error: timeError } = await context.admin.rpc("get_server_time");
    if (timeError) throw new ApiError(500, "Não foi possível validar o horário do servidor.");
    const now = new Date(serverTime);
    if (Number.isNaN(now.getTime())) throw new ApiError(500, "O horário do servidor está indisponível.");

    if (method === "QR Code") {
      const token = typeof body.token === "string" ? body.token : "";
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
        throw new ApiError(403, "QR Code inválido. Escaneie o código ativo na recepção.");
      }
      const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
      const { data: validToken, error: tokenError } = await context.admin
        .from("checkin_qr_tokens")
        .select("id")
        .eq("igreja_id", context.churchId)
        .eq("token_hash", tokenHash)
        .gt("expires_at", now.toISOString())
        .maybeSingle();
      if (tokenError) throw new ApiError(500, "Não foi possível validar o QR Code.");
      if (!validToken) throw new ApiError(403, "Este QR Code expirou. Escaneie o código atualizado na recepção.");
    }

    const [
      { data: configurations, error: configurationsError },
      { data: timezoneSetting, error: timezoneError },
    ] = await Promise.all([
      context.admin
        .from("config_checkin")
        .select("nome_evento, horario_inicio, horario_fim, latitude_igreja, longitude_igreja, raio_metros")
        .eq("igreja_id", context.churchId),
      context.admin
        .from("config_checkin_fusos")
        .select("fuso_horario")
        .eq("igreja_id", context.churchId)
        .maybeSingle(),
    ]);
    if (configurationsError) throw new ApiError(500, "Não foi possível carregar as configurações de check-in.");
    if (timezoneError) throw new ApiError(500, "Não foi possível carregar o fuso horário da igreja.");

    let localTimeParts: Intl.DateTimeFormatPart[];
    try {
      localTimeParts = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezoneSetting?.fuso_horario ?? "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(now);
    } catch {
      throw new ApiError(500, "O fuso horário configurado para a igreja é inválido.");
    }
    const currentHour = Number(localTimeParts.find(part => part.type === "hour")?.value);
    const currentMinute = Number(localTimeParts.find(part => part.type === "minute")?.value);
    if (!Number.isInteger(currentHour) || !Number.isInteger(currentMinute)) {
      throw new ApiError(500, "Não foi possível validar o horário local do check-in.");
    }
    const currentMinutes = currentHour * 60 + currentMinute;
    const currentEvent = (configurations ?? []).find((configuration: CheckinConfiguration) => {
      const start = minutesSinceMidnight(configuration.horario_inicio);
      const end = minutesSinceMidnight(configuration.horario_fim);
      if (start === null || end === null) return false;
      return start <= end
        ? currentMinutes >= start && currentMinutes <= end
        : currentMinutes >= start || currentMinutes <= end;
    });
    const status = currentEvent ? "Normal" : "Fora de Horário";

    if (method === "GPS" && latitude !== null && longitude !== null) {
      const location = (configurations ?? []).find((configuration): configuration is CheckinLocation =>
        configuration.latitude_igreja !== null
        && configuration.longitude_igreja !== null
        && configuration.raio_metros !== null
        && Number.isFinite(configuration.latitude_igreja)
        && Number.isFinite(configuration.longitude_igreja)
        && Number.isFinite(configuration.raio_metros),
      );
      if (location) {
        const distance = distanceInMeters(latitude, longitude, location.latitude_igreja, location.longitude_igreja);
        if (distance > location.raio_metros) {
          throw new ApiError(403, `Você está fora do raio de ${location.raio_metros}m. Use o QR Code ativo na recepção.`);
        }
      }
    }

    const { error: insertError } = await context.admin.from("checkins").insert({
      igreja_id: context.churchId,
      membro_id: member.id,
      tipo_evento: currentEvent?.nome_evento ?? "Geral",
      metodo: method,
      latitude: method === "GPS" ? latitude : null,
      longitude: method === "GPS" ? longitude : null,
      status,
      observacao: "",
    });
    if (insertError) throw new ApiError(500, "Não foi possível registrar o check-in.");

    return Response.json({
      eventName: currentEvent?.nome_evento ?? "Fora de Horário",
      status,
      method,
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
