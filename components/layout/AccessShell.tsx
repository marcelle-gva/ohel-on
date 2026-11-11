"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  acaoDaRota,
  moduloDaRota,
  MODULOS_ADMIN,
  podeAcessar,
  type ContextoAcesso,
} from "@/lib/access";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MemberHeader } from "./MemberHeader";

const AccessContext = createContext<ContextoAcesso | null>(null);
export const useAccess = () => useContext(AccessContext);

export function AccessShell({
  children,
  membro = false,
}: {
  children: React.ReactNode;
  membro?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [contexto, setContexto] = useState<ContextoAcesso | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setContexto(null);
        router.replace(membro ? "/login-membro" : "/login");
        return;
      }
      const response = await fetch(
        `/api/acesso${membro ? "?tipo=membro" : ""}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        },
      );
      const result = (await response.json()) as {
        contexto?: ContextoAcesso;
        error?: string;
      };
      if (!response.ok || !result.contexto) {
        setContexto(null);
        throw new Error(
          result.error || "Não foi possível conferir seu acesso.",
        );
      }
      setContexto(result.contexto);
      setErro("");
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar sua área.",
      );
    } finally {
      setLoading(false);
    }
  }, [membro, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => void carregar(), 0);
    const refresh = () => {
      if (!document.hidden) void carregar();
    };
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    window.addEventListener("ohel:perfil-atualizado", refresh);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setContexto(null);
        router.replace(membro ? "/login-membro" : "/login");
      }
    });
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("ohel:perfil-atualizado", refresh);
      subscription.unsubscribe();
    };
  }, [carregar, membro, router]);

  useEffect(() => {
    if (!loading && contexto?.role === "monitor" && !pathname.startsWith("/monitor-midia")) {
      router.replace("/monitor-midia");
    }
  }, [contexto, loading, pathname, router]);

  if (loading)
    return (
      <div className="flex h-dvh items-center justify-center gap-2 bg-ohel-bg text-sm text-gray-300">
        <Loader2 className="h-4 w-4 animate-spin" /> Conferindo acesso...
      </div>
    );
  if (!contexto)
    return (
      <div className="flex h-dvh flex-col items-center gap-4 overflow-y-auto bg-ohel-bg p-6 pt-16 text-center">
        <h1 className="text-lg font-bold text-white">Acesso indisponível</h1>
        <p role="alert" className="max-w-md text-sm text-gray-300">
          {erro || "Entre novamente para continuar."}
        </p>
        <button
          type="button"
          onClick={() => void carregar()}
          className="rounded-lg bg-ohel-blue px-4 py-2 text-sm text-white"
        >
          Tentar novamente
        </button>
        <Link
          href={membro ? "/login-membro" : "/login"}
          className="text-sm text-ohel-blue"
        >
          Voltar ao login
        </Link>
      </div>
    );

  const modoMembro =
    membro || (Boolean(contexto.membro) && contexto.role !== "admin");
  const modulo = membro ? null : moduloDaRota(pathname);
  const autorizado =
    membro ||
    (modulo !== null &&
      podeAcessar(contexto, modulo, "ler") &&
      podeAcessar(contexto, modulo, acaoDaRota(pathname)));
  const permissoes =
    contexto.role === "admin"
      ? MODULOS_ADMIN
      : [
          ...new Set(
            contexto.permissoes
              .filter((p) => p.acao === "ler")
              .map((p) => p.modulo),
          ),
        ];
  return (
    <AccessContext.Provider value={contexto}>
      <div className="flex h-dvh w-full overflow-hidden bg-ohel-bg">
        <Sidebar
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          permissoes={permissoes}
          membro={modoMembro}
          role={contexto.role}
        />
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-3 top-3 z-40 rounded-lg border border-gray-800 bg-ohel-surface p-2 text-white md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          {modoMembro ? <MemberHeader contexto={contexto} /> : <Header />}
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
            {autorizado ? (
              children
            ) : (
              <section className="mx-auto max-w-md rounded-xl border border-gray-800 p-5">
                <h1 className="text-lg font-bold text-white">
                  Você não tem permissão para esta seção
                </h1>
                <p className="mt-2 text-sm text-gray-400">
                  O administrador da igreja deve autorizar este módulo no seu
                  grupo de acesso.
                </p>
                <Link
                  href={contexto.membro ? "/area-membro" : "/login"}
                  className="mt-4 inline-block text-sm text-ohel-blue"
                >
                  {contexto.membro
                    ? "Voltar ao meu dashboard"
                    : "Voltar ao acesso"}
                </Link>
              </section>
            )}
          </main>
        </div>
      </div>
    </AccessContext.Provider>
  );
}
