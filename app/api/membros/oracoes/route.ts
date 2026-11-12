import {
  AcessoError,
  resolverAcesso,
  respostaErroAcesso,
} from "@/lib/access-server";
import { VISIBILIDADE_ORACAO_PUBLICA } from "@/lib/mural-rules";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    // Preserva também o envio do administrador sem exigir uma ficha de membro.
    // Para outras contas, o resolvedor exige aprovação e a verificação abaixo
    // exige o vínculo ativo; cargo declarado não concede este acesso.
    const { contexto, service } = await resolverAcesso(request);
    if (!contexto.membro && contexto.role !== "admin") {
      throw new AcessoError(
        "Seu acesso precisa estar vinculado a um membro ativo. Procure a secretaria.",
        403,
      );
    }

    const body = (await request.json().catch(() => null)) as {
      igreja_id?: unknown;
      nome_solicitante?: unknown;
      descricao?: unknown;
    } | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new AcessoError("Solicitação inválida. Tente enviar novamente.", 400);
    }
    if (body?.igreja_id !== contexto.igrejaId) {
      throw new AcessoError(
        "Envie o pedido pelo Monitor da sua própria igreja.",
        403,
      );
    }
    if (
      typeof body.descricao !== "string" ||
      !body.descricao.trim() ||
      body.descricao.trim().length > 5000 ||
      (body.nome_solicitante !== undefined &&
        typeof body.nome_solicitante !== "string") ||
      (typeof body.nome_solicitante === "string" &&
        body.nome_solicitante.trim().length > 150)
    ) {
      throw new AcessoError(
        "Informe um pedido de até 5.000 caracteres e um nome de até 150 caracteres.",
        400,
      );
    }

    // O membro pode solicitar oração, não decidir nem acessar pedidos privados.
    // A identidade/igreja vêm da sessão verificada; nunca aceitar status do cliente.
    const { error } = await service.from("pedidos_oracao").insert({
      igreja_id: contexto.igrejaId,
      nome_solicitante:
        typeof body.nome_solicitante === "string"
          ? body.nome_solicitante.trim() || "Anônimo"
          : "Anônimo",
      descricao: body.descricao.trim(),
      visibilidade: VISIBILIDADE_ORACAO_PUBLICA,
      status: "Pendente",
    });
    if (error) {
      console.error("Falha no envio autenticado de oração", { code: error.code });
      throw new AcessoError(
        "Não foi possível registrar seu pedido. Tente novamente.",
        503,
      );
    }
    return Response.json(
      { ok: true, status: "Pendente" },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return respostaErroAcesso(error);
  }
}
