import { resolverAcesso, respostaErroAcesso } from "@/lib/access-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { contexto, service } = await resolverAcesso(request);
    if (contexto.role !== "admin") {
      return Response.json({ error: "Somente administradores podem sincronizar usuários." }, { status: 403 });
    }

    const [membrosResult, perfisResult, usuariosResult, authResult] = await Promise.all([
      service
        .from("membros")
        .select("id, nome, email, auth_user_id, status, igreja_id")
        .eq("igreja_id", contexto.igrejaId)
        .eq("status", "Ativo")
        .order("nome")
        .limit(500),
      service.from("perfis").select("id, nome").eq("igreja_id", contexto.igrejaId).order("nome").limit(100),
      service
        .from("usuarios")
        .select("id, nome, email, role, perfil_id, grupo_id, perfis(nome)")
        .eq("igreja_id", contexto.igrejaId)
        .order("nome")
        .limit(500),
      service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    if (membrosResult.error || perfisResult.error || usuariosResult.error || authResult.error) {
      return Response.json({ error: "Não foi possível sincronizar os usuários da igreja." }, { status: 503 });
    }

    const membros = membrosResult.data || [];
    const usuarios = usuariosResult.data || [];
    const porEmail = new Map(
      (authResult.data.users || [])
        .filter((authUser) => authUser.email)
        .map((authUser) => [authUser.email!.trim().toLowerCase(), authUser]),
    );
    const usuarioIds = new Set(usuarios.map((usuario) => usuario.id));

    for (const membro of membros) {
      const email = membro.email?.trim().toLowerCase();
      if (!email) continue;
      const authUser = porEmail.get(email);
      if (!authUser) continue;

      if (!membro.auth_user_id) {
        await service
          .from("membros")
          .update({ auth_user_id: authUser.id })
          .eq("id", membro.id)
          .eq("igreja_id", contexto.igrejaId)
          .is("auth_user_id", null);
        membro.auth_user_id = authUser.id;
      }

      if (!usuarioIds.has(authUser.id)) {
        const { data: novoUsuario } = await service
          .from("usuarios")
          .insert({
            id: authUser.id,
            igreja_id: contexto.igrejaId,
            nome: membro.nome,
            email,
            role: "membro",
            grupo_id: null,
          })
          .select("id, nome, email, role, perfil_id, grupo_id, perfis(nome)")
          .maybeSingle();
        if (novoUsuario) usuarios.push(novoUsuario);
      }
    }

    return Response.json({
      membros,
      usuarios,
      perfis: perfisResult.data || [],
      sincronizados: membros.filter((membro) => Boolean(membro.auth_user_id)).length,
    });
  } catch (error) {
    return respostaErroAcesso(error);
  }
}
