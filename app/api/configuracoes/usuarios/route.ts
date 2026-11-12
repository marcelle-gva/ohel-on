import { resolverAcesso, respostaErroAcesso } from "@/lib/access-server";

export const runtime = "nodejs";
export const maxDuration = 20;

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

function codigoErro(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;
  return typeof code === "string" ? code : "indisponivel";
}

function erroSincronizacao() {
  return Response.json({ error: "Não foi possível sincronizar os usuários da igreja. Tente novamente." }, { status: 503 });
}

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
      console.error("[usuarios-sync] consulta inicial falhou", {
        membros: codigoErro(membrosResult.error),
        perfis: codigoErro(perfisResult.error),
        usuarios: codigoErro(usuariosResult.error),
        auth: codigoErro(authResult.error),
      });
      return erroSincronizacao();
    }

    const membros = membrosResult.data || [];
    const usuarios = usuariosResult.data || [];
    const authUsers = authResult.data.users || [];
    const authById = new Map(authUsers.map((authUser) => [authUser.id, authUser]));
    const authByEmail = new Map(
      authUsers
        .filter((authUser) => authUser.email)
        .map((authUser) => [authUser.email!.trim().toLowerCase(), authUser]),
    );
    const emailsAtivos = new Set(membros.map((membro) => membro.email?.trim().toLowerCase()).filter(Boolean));
    const idsPossiveis = [...new Set([
      ...authUsers.filter((authUser) => authUser.email && emailsAtivos.has(authUser.email.trim().toLowerCase())).map((authUser) => authUser.id),
      ...membros.map((membro) => membro.auth_user_id).filter((id): id is string => Boolean(id)),
    ])];
    const contasResult = idsPossiveis.length
      ? await service.from("usuarios").select("id, igreja_id, role").in("id", idsPossiveis)
      : { data: [], error: null };

    if (contasResult.error) {
      console.error("[usuarios-sync] verificação de tenant falhou", { code: codigoErro(contasResult.error) });
      return erroSincronizacao();
    }
    const contaPorId = new Map((contasResult.data || []).map((conta) => [conta.id, conta]));

    for (const membro of membros) {
      const email = membro.email?.trim().toLowerCase();
      const authUser = membro.auth_user_id
        ? authById.get(membro.auth_user_id)
        : email ? authByEmail.get(email) : undefined;
      if (!authUser) continue;
      if (email && authUser.email?.trim().toLowerCase() !== email) continue;

      const contaExistente = contaPorId.get(authUser.id);
      if (contaExistente?.role === "monitor" || (contaExistente && contaExistente.igreja_id !== contexto.igrejaId)) continue;

      if (!contaExistente) {
        const { data: novaConta, error: insertError } = await service
          .from("usuarios")
          .insert({
            id: authUser.id,
            igreja_id: contexto.igrejaId,
            nome: membro.nome,
            email: authUser.email?.trim().toLowerCase() || email,
            role: "membro",
            perfil_id: null,
            grupo_id: null,
          })
          .select("id, nome, email, role, perfil_id, grupo_id, perfis(nome)")
          .maybeSingle();

        if (insertError || !novaConta) {
          console.error("[usuarios-sync] criação de usuário falhou", { code: codigoErro(insertError) });
          return erroSincronizacao();
        }
        contaPorId.set(authUser.id, { id: authUser.id, igreja_id: contexto.igrejaId, role: "membro" });
        usuarios.push(novaConta);
      }

      if (!membro.auth_user_id) {
        const { data: atualizacao, error: updateError } = await service
          .from("membros")
          .update({ auth_user_id: authUser.id })
          .eq("id", membro.id)
          .eq("igreja_id", contexto.igrejaId)
          .is("auth_user_id", null)
          .select("id")
          .maybeSingle();

        if (updateError) {
          console.error("[usuarios-sync] vínculo do membro falhou", { code: codigoErro(updateError) });
          return erroSincronizacao();
        }
        if (!atualizacao) {
          const { data: maisRecente, error: leituraError } = await service
            .from("membros")
            .select("auth_user_id")
            .eq("id", membro.id)
            .eq("igreja_id", contexto.igrejaId)
            .maybeSingle();
          if (leituraError || maisRecente?.auth_user_id !== authUser.id) continue;
        }
        membro.auth_user_id = authUser.id;
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

export async function POST(request: Request) {
  try {
    const { contexto, service } = await resolverAcesso(request);
    if (contexto.role !== "admin") {
      return Response.json({ error: "Somente administradores podem convidar membros." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as { membroId?: unknown };
    const membroId = typeof body.membroId === "string" ? body.membroId : "";
    if (!UUID_PATTERN.test(membroId)) {
      return Response.json({ error: "Identificador de membro inválido." }, { status: 400 });
    }

    const { data: membro, error: membroError } = await service
      .from("membros")
      .select("id, nome, email, auth_user_id, status")
      .eq("id", membroId)
      .eq("igreja_id", contexto.igrejaId)
      .eq("status", "Ativo")
      .maybeSingle();

    if (membroError) {
      console.error("[usuarios-sync] leitura do membro para convite falhou", { code: codigoErro(membroError) });
      return erroSincronizacao();
    }
    if (!membro) return Response.json({ error: "Membro ativo não encontrado nesta igreja." }, { status: 404 });

    const email = membro.email?.trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return Response.json({ error: "Cadastre um e-mail válido para este membro antes de convidá-lo." }, { status: 400 });
    }

    const { data: authResult, error: authError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authError) {
      console.error("[usuarios-sync] leitura Auth para convite falhou", { code: codigoErro(authError) });
      return erroSincronizacao();
    }

    const authUser = membro.auth_user_id
      ? authResult.users.find((user) => user.id === membro.auth_user_id)
      : authResult.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (membro.auth_user_id && !authUser) {
      return Response.json({ error: "O vínculo Auth deste membro não foi localizado. Use Sincronizar agora e tente novamente." }, { status: 409 });
    }
    if (membro.auth_user_id && authUser?.email?.trim().toLowerCase() !== email) {
      return Response.json({ error: "O e-mail da conta vinculada é diferente do cadastro do membro. Revise os dados antes de sincronizar." }, { status: 409 });
    }

    let usuarioAuth = authUser;
    let conviteEnviado = false;
    if (!usuarioAuth) {
      const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).origin;
      const { data: convite, error: conviteError } = await service.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appUrl}/auth/membro/callback`,
        data: { tipo: "membro", nome: membro.nome },
      });
      if (conviteError || !convite.user) {
        console.error("[usuarios-sync] envio do convite falhou", { code: codigoErro(conviteError) });
        return Response.json({ error: "Não foi possível enviar o convite. Verifique o e-mail e tente novamente." }, { status: 502 });
      }
      usuarioAuth = convite.user;
      conviteEnviado = true;
    }

    const { data: contaExistente, error: contaError } = await service
      .from("usuarios")
      .select("id, igreja_id, role")
      .eq("id", usuarioAuth.id)
      .maybeSingle();
    if (contaError) {
      console.error("[usuarios-sync] validação da conta para convite falhou", { code: codigoErro(contaError) });
      return erroSincronizacao();
    }
    if (contaExistente?.igreja_id && contaExistente.igreja_id !== contexto.igrejaId) {
      return Response.json({ error: "Este e-mail já está associado a outra igreja. O vínculo não foi alterado." }, { status: 409 });
    }
    if (contaExistente?.role === "monitor") {
      return Response.json({ error: "Contas técnicas de monitor não podem ser vinculadas como membros." }, { status: 409 });
    }

    if (!contaExistente) {
      const { error: insertError } = await service.from("usuarios").insert({
        id: usuarioAuth.id,
        igreja_id: contexto.igrejaId,
        nome: membro.nome,
        email,
        role: "membro",
        perfil_id: null,
        grupo_id: null,
      });
      if (insertError) {
        console.error("[usuarios-sync] criação da conta convidada falhou", { code: codigoErro(insertError) });
        return Response.json({ error: conviteEnviado
          ? "O convite foi enviado, mas o usuário ainda não foi vinculado. Clique em Sincronizar agora para concluir."
          : "Não foi possível registrar o usuário na igreja. Tente sincronizar novamente." }, { status: 503 });
      }
    }

    if (membro.auth_user_id !== usuarioAuth.id) {
      const { data: atualizado, error: vinculoError } = await service
        .from("membros")
        .update({ auth_user_id: usuarioAuth.id })
        .eq("id", membro.id)
        .eq("igreja_id", contexto.igrejaId)
        .is("auth_user_id", membro.auth_user_id)
        .select("id")
        .maybeSingle();
      if (vinculoError || !atualizado) {
        console.error("[usuarios-sync] conclusão do convite falhou", { code: codigoErro(vinculoError) });
        return Response.json({ error: "O usuário foi criado, mas o vínculo do membro não foi concluído. Clique em Sincronizar agora." }, { status: 503 });
      }
    }

    return Response.json({
      ok: true,
      conviteEnviado,
      message: conviteEnviado
        ? "Convite enviado. O usuário já foi adicionado à lista de responsáveis; o membro poderá acessar após aceitar o convite."
        : "Conta existente sincronizada com este membro.",
    }, { status: conviteEnviado ? 201 : 200 });
  } catch (error) {
    return respostaErroAcesso(error);
  }
}
