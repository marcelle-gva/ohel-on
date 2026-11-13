import { podeAcessar } from "@/lib/access";
import {
  resolverAcesso,
  respostaErroAcesso,
} from "@/lib/access-server";
import {
  criarLinkPublicoCongregado,
  criarLinkPublicoVisitante,
  type PublicQrCodeKind,
} from "@/lib/qrcode-public";

export const runtime = "nodejs";

function tipoValido(valor: string | null): PublicQrCodeKind | null {
  return valor === "congregado" || valor === "visitante" ? valor : null;
}

export async function GET(request: Request) {
  const tipo = tipoValido(new URL(request.url).searchParams.get("tipo"));
  if (!tipo) {
    return Response.json(
      { error: "Tipo de QR Code inválido." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const { contexto } = await resolverAcesso(request);
    const modulo = tipo === "congregado" ? "congregados" : "visitantes";
    if (!podeAcessar(contexto, modulo, "ler")) {
      return Response.json(
        { error: "Você não tem permissão para compartilhar este QR Code." },
        { status: 403, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const url = tipo === "congregado"
      ? criarLinkPublicoCongregado(contexto.igrejaId)
      : criarLinkPublicoVisitante(contexto.igrejaId);
    if (!url) {
      return Response.json(
        { error: "Sua conta não possui uma igreja válida para gerar o QR Code." },
        { status: 403, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    return Response.json(
      {
        tipo,
        igrejaId: contexto.igrejaId,
        igrejaNome: contexto.igrejaNome,
        url,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return respostaErroAcesso(error);
  }
}
