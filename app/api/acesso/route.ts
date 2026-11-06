import { resolverAcesso, respostaErroAcesso } from "@/lib/access-server";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { contexto } = await resolverAcesso(
      request,
      new URL(request.url).searchParams.get("tipo") === "membro",
    );
    return Response.json(
      { contexto },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return respostaErroAcesso(error);
  }
}
