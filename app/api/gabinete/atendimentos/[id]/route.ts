import { consultarAtendimentoEquipe, editarAtendimentoEquipe } from "@/lib/pastoral-server";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  return consultarAtendimentoEquipe(request, (await params).id);
}
export async function PATCH(request: Request, { params }: Context) {
  return editarAtendimentoEquipe(request, (await params).id);
}
