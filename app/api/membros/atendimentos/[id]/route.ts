import { cancelarAtendimento } from "@/lib/pastoral-server";
export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return cancelarAtendimento(request, (await params).id);
}
