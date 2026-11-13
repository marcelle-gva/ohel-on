export interface PermissaoAcesso {
  modulo: string;
  acao: string;
}
export interface ContextoAcesso {
  usuarioId: string;
  igrejaId: string;
  igrejaNome: string;
  role: string;
  grupoId: string | null;
  grupoNome: string | null;
  membro: {
    id: string;
    nome: string;
    foto_url: string | null;
    cargo: string | null;
    departamento: string | null;
  } | null;
  permissoes: PermissaoAcesso[];
}

export const MODULOS_ADMIN = [
  "dashboard",
  "membros",
  "congregacoes",
  "congregados",
  "visitantes",
  "visitas",
  "eventos",
  "financeiro",
  "mural",
  "monitor-midia",
  "monitor-louvores",
  "monitor-oracoes",
  "escalas",
  "reunioes",
  "oracoes",
  "cartas",
  "certificados",
  "credenciais",
  "cestas",
  "fichas",
  "configuracoes",
  "patrimonio",
  "gabinete",
  "ensino",
  "sorteios",
  "kids-teens",
];

export function podeAcessar(
  contexto: ContextoAcesso,
  modulo: string,
  acao = "ler",
) {
  return (
    contexto.role === "admin" ||
    contexto.permissoes.some((p) => p.modulo === modulo && p.acao === acao)
  );
}

export function moduloDaRota(pathname: string): string | null {
  if (pathname === "/dashboard") return "dashboard";
  if (pathname === "/monitor-midia/louvores/pendentes" || pathname.startsWith("/monitor-midia/louvores/pendentes/"))
    return "monitor-louvores";
  if (pathname === "/monitor-midia" || pathname.startsWith("/monitor-midia/"))
    return "monitor-midia";
  const match = pathname.match(/^\/secretaria\/([^/]+)/);
  if (match) return match[1];
  const prefix = pathname.split("/")[1];
  return [
    "configuracoes",
    "financeiro",
    "gabinete",
    "patrimonio",
    "ensino",
    "eventos",
    "sorteios",
  ].includes(prefix)
    ? prefix
    : null;
}

export function acaoDaRota(pathname: string) {
  if (/\/editar\//.test(pathname) || /\/movimentar\//.test(pathname))
    return "editar";
  if (/\/(novo|nova|importar)$/.test(pathname)) return "criar";
  return "ler";
}
