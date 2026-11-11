import { resolverAcesso, respostaErroAcesso } from "@/lib/access-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { contexto, service } = await resolverAcesso(request);
    if (contexto.role !== "admin") {
      return Response.json({ error: "Somente administradores podem editar o Monitor." }, { status: 403 });
    }

    const body = (await request.json()) as { usuarioId?: string; fotoUrl?: string };
    if (!body.usuarioId || !body.fotoUrl) {
      return Response.json({ error: "Usuário e foto são obrigatórios." }, { status: 400 });
    }

    const { data, error } = await service
      .from("usuarios")
      .update({ foto_url: body.fotoUrl })
      .eq("id", body.usuarioId)
      .eq("igreja_id", contexto.igrejaId)
      .eq("role", "monitor")
      .select("id, foto_url")
      .maybeSingle();

    if (error || !data) {
      return Response.json({ error: error?.message || "Usuário Monitor não encontrado." }, { status: 400 });
    }
    return Response.json({ usuario: data });
  } catch (error) {
    return respostaErroAcesso(error);
  }
}
