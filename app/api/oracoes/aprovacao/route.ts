import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { ApiError, getApiContext, jsonApiError, requireModulePermission } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

const PIN_LENGTH = 6;
const PRAYER_APPROVAL_MODULE = "monitor-oracoes";

type ApprovalRequest = {
  action?: unknown;
  pin?: unknown;
  decision?: unknown;
  prayerId?: unknown;
};

function isPin(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function hashPin(pin: string, salt: string) {
  return scryptSync(pin, salt, 64);
}

async function parseBody(request: Request): Promise<ApprovalRequest> {
  try {
    return await request.json() as ApprovalRequest;
  } catch {
    throw new ApiError(400, "O corpo da solicitação não é um JSON válido.");
  }
}

export async function GET(request: Request) {
  try {
    const context = await getApiContext(request);
    await requireModulePermission(context, PRAYER_APPROVAL_MODULE, ["aprovar"]);

    const [{ data: pin, error: pinError }, { data: audit, error: auditError }] = await Promise.all([
      context.admin
        .from("pedidos_oracao_pins")
        .select("usuario_id")
        .eq("usuario_id", context.user.id)
        .eq("igreja_id", context.churchId)
        .maybeSingle(),
      context.admin
        .from("pedidos_oracao_aprovacoes_log")
        .select("id, pedido_id, pedido_nome, acao, metodo, ator_nome, ator_email, created_at")
        .eq("igreja_id", context.churchId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (pinError) throw new ApiError(500, "Não foi possível verificar o PIN de aprovação.");
    if (auditError) throw new ApiError(500, "Não foi possível carregar o histórico de aprovações.");

    return Response.json({ pinConfigured: Boolean(pin), audit: audit ?? [] });
  } catch (error) {
    return jsonApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getApiContext(request);
    await requireModulePermission(context, PRAYER_APPROVAL_MODULE, ["aprovar"]);
    const body = await parseBody(request);

    if (body.action === "set_pin") {
      if (!isPin(body.pin)) {
        throw new ApiError(400, `O PIN deve conter exatamente ${PIN_LENGTH} números.`);
      }

      const salt = randomBytes(16).toString("hex");
      const pinHash = hashPin(body.pin, salt).toString("hex");
      const { error } = await context.admin.from("pedidos_oracao_pins").insert({
        usuario_id: context.user.id,
        igreja_id: context.churchId,
        pin_salt: salt,
        pin_hash: pinHash,
      });
      if (error?.code === "23505") throw new ApiError(409, "Seu PIN já foi configurado.");
      if (error) throw new ApiError(500, "Não foi possível salvar seu PIN.");

      return Response.json({ pinConfigured: true }, { status: 201 });
    }

    if (body.action !== "decide" || !isUuid(body.prayerId)) {
      throw new ApiError(400, "A solicitação de aprovação é inválida.");
    }
    if (body.decision !== "approve" && body.decision !== "reject") {
      throw new ApiError(400, "A decisão informada é inválida.");
    }

    const isAdmin = context.role === "admin";
    let method: "admin" | "pin" = "admin";

    if (!isAdmin) {
      if (!isPin(body.pin)) throw new ApiError(400, `O PIN deve conter exatamente ${PIN_LENGTH} números.`);
      method = "pin";

      const { data: storedPin, error: pinError } = await context.admin
        .from("pedidos_oracao_pins")
        .select("pin_salt, pin_hash, bloqueado_ate")
        .eq("usuario_id", context.user.id)
        .eq("igreja_id", context.churchId)
        .maybeSingle();
      if (pinError) throw new ApiError(500, "Não foi possível validar seu PIN.");
      if (!storedPin) throw new ApiError(409, "Configure seu PIN antes de aprovar pedidos.");
      if (storedPin.bloqueado_ate && new Date(storedPin.bloqueado_ate).getTime() > Date.now()) {
        throw new ApiError(429, "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.");
      }

      const storedHash = Buffer.from(storedPin.pin_hash, "hex");
      const submittedHash = hashPin(body.pin, storedPin.pin_salt);
      if (storedHash.length !== submittedHash.length || !timingSafeEqual(storedHash, submittedHash)) {
        const { error: attemptError } = await context.admin.rpc("record_prayer_pin_failure", {
          p_usuario_id: context.user.id,
          p_igreja_id: context.churchId,
        });
        if (attemptError) throw new ApiError(500, "Não foi possível registrar a tentativa de PIN.");
        throw new ApiError(401, "PIN incorreto.");
      }
    }

    const { error: decisionError } = await context.admin.rpc("finalize_prayer_request", {
      p_pedido_id: body.prayerId,
      p_igreja_id: context.churchId,
      p_ator_id: context.user.id,
      p_acao: body.decision === "approve" ? "Aprovado" : "Rejeitado",
      p_metodo: method,
    });
    if (decisionError?.code === "P0002") throw new ApiError(409, "Este pedido já foi processado ou não está disponível.");
    if (decisionError?.code === "42501") throw new ApiError(403, "Você não está autorizado a processar este pedido.");
    if (decisionError) throw new ApiError(500, "Não foi possível concluir a decisão.");

    return Response.json({ success: true });
  } catch (error) {
    return jsonApiError(error);
  }
}
