import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ContextoAcesso, PermissaoAcesso } from "./access";

export class AcessoError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function responsavelLouvor(
  service: SupabaseClient,
  igrejaId: string,
  usuarioId: string,
) {
  const { data, error } = await service
    .from("departamentos")
    .select("id")
    .eq("igreja_id", igrejaId)
    .eq("responsavel_usuario_id", usuarioId)
    .eq("ativo", true)
    .ilike("nome", "%louvor%")
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new AcessoError("Não foi possível conferir a responsabilidade pelo departamento de Louvor.", 503);
  }
  return Boolean(data);
}

export async function resolverAcesso(request: Request, exigirMembro = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    throw new AcessoError("Serviço de acesso não configurado.", 503);
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token)
    throw new AcessoError("Entre novamente para acessar sua área.", 401);
  const service = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await service.auth.getUser(token);
  if (authError || !user?.email)
    throw new AcessoError("Sessão inválida ou expirada.", 401);

  const { data: usuarioInicial, error: usuarioError } = await service
    .from("usuarios")
    .select("id, igreja_id, role, grupo_id")
    .eq("id", user.id)
    .maybeSingle();
  let usuario = usuarioInicial;
  if (usuarioError)
    throw new AcessoError(
      "Não foi possível conferir as permissões. Tente novamente.",
      503,
    );
  if (!exigirMembro && usuario?.role === "admin" && usuario.igreja_id) {
    // O painel administrativo não depende das novas colunas do cadastro de membros.
    const { data: igreja, error } = await service
      .from("igrejas")
      .select("nome")
      .eq("id", usuario.igreja_id)
      .maybeSingle();
    if (error || !igreja)
      throw new AcessoError("Igreja não encontrada para este acesso.", 403);
    const contexto: ContextoAcesso = {
      usuarioId: user.id,
      igrejaId: usuario.igreja_id,
      igrejaNome: igreja.nome,
      role: "admin",
      grupoId: usuario.grupo_id,
      grupoNome: null,
      membro: null,
      permissoes: [],
    };
    return { contexto, service, user };
  }
  if (usuario?.role === "monitor") {
    if (exigirMembro)
      throw new AcessoError("A conta Monitor não possui Área do Membro.", 403);
    if (!usuario.igreja_id)
      throw new AcessoError("O acesso Monitor ainda não possui uma igreja.", 403);
    const { data: grupo, error: groupError } = await service
      .from("grupos")
      .select("id, nome")
      .eq("id", usuario.grupo_id || "")
      .eq("igreja_id", usuario.igreja_id)
      .maybeSingle();
    if (groupError || !grupo)
      throw new AcessoError("O grupo Monitor não está configurado.", 403);
    const { data: perms, error: permsError } = await service
      .from("grupos_permissoes")
      .select("modulo, acao")
      .eq("grupo_id", grupo.id);
    if (permsError)
      throw new AcessoError("Não foi possível consultar as permissões do Monitor.", 503);
    const permissoesMonitor = (perms || []) as PermissaoAcesso[];
    if (await responsavelLouvor(service, usuario.igreja_id, user.id)) {
      permissoesMonitor.push({ modulo: "monitor-louvores", acao: "ler" });
    }
    const { data: igreja, error: churchError } = await service
      .from("igrejas")
      .select("nome")
      .eq("id", usuario.igreja_id)
      .maybeSingle();
    if (churchError || !igreja)
      throw new AcessoError("Igreja não encontrada para este acesso.", 403);
    const contexto: ContextoAcesso = {
      usuarioId: user.id,
      igrejaId: usuario.igreja_id,
      igrejaNome: igreja.nome,
      role: "monitor",
      grupoId: grupo.id,
      grupoNome: grupo.nome,
      membro: null,
      permissoes: permissoesMonitor,
    };
    return { contexto, service, user };
  }
  if (!user.email_confirmed_at)
    throw new AcessoError(
      "Confirme seu e-mail para acessar a Área do Membro.",
      401,
    );
  const campos =
    "id, igreja_id, auth_user_id, nome, email, status, foto_url, cargo, departamento";
  const { data: vinculado, error: memberError } = await service
    .from("membros")
    .select(campos)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (memberError)
    throw new AcessoError(
      "Não foi possível conferir o cadastro de membro. Verifique as migrations da Área do Membro.",
      503,
    );
  let membro = vinculado;
  if (!membro) {
    // Compatibilidade apenas com cadastro legado ainda sem vínculo Auth: nunca substitui outra conta vinculada.
    const emailLiteral = user.email.trim().replace(/[\\%_]/g, "\\$&");
    const { data: legado, error: legacyError } = await service
      .from("membros")
      .select(campos)
      .is("auth_user_id", null)
      .ilike("email", emailLiteral)
      .maybeSingle();
    if (legacyError)
      throw new AcessoError(
        "Cadastro duplicado ou indisponível. Procure a secretaria.",
        403,
      );
    membro = legado;
  }
  if (exigirMembro && !membro)
    throw new AcessoError(
      "Seu acesso ainda não está vinculado a um membro. Procure a secretaria.",
      403,
    );
  if (
    (exigirMembro || usuario?.role !== "admin") &&
    membro &&
    membro.status !== "Ativo"
  ) {
    throw new AcessoError(
      membro.status === "Pré-Cadastro"
        ? "Seu cadastro está aguardando a aprovação do administrador da igreja."
        : "Seu cadastro não está ativo. Procure a secretaria da igreja.",
      403,
    );
  }
  if (
    membro &&
    usuario?.igreja_id &&
    membro.igreja_id !== usuario.igreja_id &&
    (exigirMembro || usuario.role !== "admin")
  ) {
    throw new AcessoError(
      "O vínculo da conta precisa ser conferido pela secretaria.",
      403,
    );
  }

  if (membro?.status === "Ativo") {
    // Pré-cadastros já criam a conta Auth, mas versões antigas não garantiam
    // o espelho em usuarios. Corrigimos somente esse vínculo no primeiro login
    // e nunca sobrescrevemos grupo, perfil ou permissões existentes.
    if (!membro.auth_user_id) {
      const { data: vinculo, error: vinculoError } = await service
        .from("membros")
        .update({ auth_user_id: user.id })
        .eq("id", membro.id)
        .is("auth_user_id", null)
        .select("id, auth_user_id")
        .maybeSingle();
      if (vinculoError || !vinculo) {
        throw new AcessoError("Não foi possível vincular seu acesso ao cadastro de membro.", 503);
      }
      membro.auth_user_id = vinculo.auth_user_id;
    }

    if (!usuario) {
      const { data: sincronizado, error: sincronizacaoError } = await service
        .from("usuarios")
        .insert({
          id: user.id,
          igreja_id: membro.igreja_id,
          nome: membro.nome,
          email: user.email,
          role: "membro",
          grupo_id: null,
        })
        .select("id, igreja_id, role, grupo_id")
        .maybeSingle();
      if (sincronizacaoError || !sincronizado) {
        throw new AcessoError("Não foi possível sincronizar seu acesso à igreja.", 503);
      }
      usuario = sincronizado;
    }
  }

  // A igreja pode manter vários e-mails autorizados exclusivamente para o Monitor.
  // O vínculo é aplicado no login sem promover a conta a administrador.
  const { data: monitorAcessos, error: monitorAcessosError } = await service
    .from("igreja_monitor_acessos")
    .select("igreja_id")
    .eq("email", user.email.trim().toLowerCase())
    .eq("ativo", true)
    .limit(20);
  if (monitorAcessosError)
    throw new AcessoError("Não foi possível conferir os acessos do Monitor.", 503);
  const igrejaAtual = usuario?.igreja_id || membro?.igreja_id;
  const acessoMonitor = (monitorAcessos || []).find(
    (acesso) => !igrejaAtual || acesso.igreja_id === igrejaAtual,
  );
  if (acessoMonitor) {
    const { data: grupoMonitor, error: grupoMonitorError } = await service
      .from("grupos")
      .select("id")
      .eq("igreja_id", acessoMonitor.igreja_id)
      .ilike("nome", "Monitor")
      .limit(1)
      .maybeSingle();
    if (grupoMonitorError || !grupoMonitor)
      throw new AcessoError("O grupo padrão Monitor ainda não está configurado.", 503);

    if (!usuario) {
      const { data: monitorUsuario, error: monitorUsuarioError } = await service
        .from("usuarios")
        .insert({
          id: user.id,
          igreja_id: acessoMonitor.igreja_id,
          nome: "Monitor",
          email: user.email,
          role: "membro",
          grupo_id: grupoMonitor.id,
        })
        .select("id, igreja_id, role, grupo_id")
        .maybeSingle();
      if (monitorUsuarioError || !monitorUsuario)
        throw new AcessoError("Não foi possível criar o acesso do Monitor.", 503);
      usuario = monitorUsuario;
    } else if (usuario.role !== "admin" && !usuario.grupo_id && usuario.igreja_id === acessoMonitor.igreja_id) {
      const { data: monitorUsuario, error: monitorUsuarioError } = await service
        .from("usuarios")
        .update({ grupo_id: grupoMonitor.id })
        .eq("id", user.id)
        .select("id, igreja_id, role, grupo_id")
        .maybeSingle();
      if (monitorUsuarioError || !monitorUsuario)
        throw new AcessoError("Não foi possível vincular o grupo Monitor.", 503);
      usuario = monitorUsuario;
    }
  }

  const igrejaId = exigirMembro
    ? membro?.igreja_id
    : usuario?.igreja_id || membro?.igreja_id;
  if (!igrejaId)
    throw new AcessoError("Sua conta não possui uma igreja autorizada.", 403);
  const perfilDaIgreja = usuario?.igreja_id === igrejaId ? usuario : null;
  const role = perfilDaIgreja?.role || "membro";
  let grupoNome: string | null = null;
  let grupoId: string | null = null;
  let permissoes: PermissaoAcesso[] = [];
  if (perfilDaIgreja?.grupo_id) {
    const { data: grupo, error: groupError } = await service
      .from("grupos")
      .select("id, nome")
      .eq("id", perfilDaIgreja.grupo_id)
      .eq("igreja_id", igrejaId)
      .maybeSingle();
    if (groupError)
      throw new AcessoError(
        "Não foi possível consultar seu grupo de acesso.",
        503,
      );
    if (grupo) {
      grupoId = grupo.id;
      grupoNome = grupo.nome;
      const { data: perms, error: permsError } = await service
        .from("grupos_permissoes")
        .select("modulo, acao")
        .eq("grupo_id", grupo.id);
      if (permsError)
        throw new AcessoError(
          "Não foi possível consultar as permissões do grupo.",
          503,
        );
      permissoes = (perms || []) as PermissaoAcesso[];
    }
  }
  if (await responsavelLouvor(service, igrejaId, user.id) &&
      !permissoes.some((permissao) => permissao.modulo === "monitor-louvores" && permissao.acao === "ler")) {
    permissoes.push({ modulo: "monitor-louvores", acao: "ler" });
  }
  const { data: igreja, error: churchError } = await service
    .from("igrejas")
    .select("nome")
    .eq("id", igrejaId)
    .maybeSingle();
  if (churchError || !igreja)
    throw new AcessoError("Igreja não encontrada para este acesso.", 403);
  const contexto: ContextoAcesso = {
    usuarioId: user.id,
    igrejaId,
    igrejaNome: igreja.nome,
    role,
    grupoId,
    grupoNome,
    permissoes,
    membro:
      membro?.status === "Ativo" && membro.igreja_id === igrejaId
        ? {
            id: membro.id,
            nome: membro.nome,
            foto_url: membro.foto_url,
            cargo: membro.cargo,
            departamento: membro.departamento,
          }
        : null,
  };
  return { contexto, service, user };
}

export function respostaErroAcesso(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof AcessoError
          ? error.message
          : "Não foi possível carregar sua área. Tente novamente.",
    },
    {
      status: error instanceof AcessoError ? error.status : 500,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
