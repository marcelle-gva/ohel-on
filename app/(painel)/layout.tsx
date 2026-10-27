"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPostAuthenticationPath } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Menu } from "lucide-react";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [permissoes, setPermissoes] = useState<string[]>([]);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          router.replace("/");
          return;
        }

        const authPath = await getPostAuthenticationPath(supabase);
        if (authPath !== "/dashboard") {
          router.replace(authPath);
          return;
        }

        // Busca o grupo e a role (admin, pastor, membro) do usuário
        const { data: user, error: userError } = await supabase
          .from('usuarios')
          .select('grupo_id, role')
          .eq('id', session.user.id)
          .single();
        if (userError) throw userError;
        const { data: platformAdmin, error: platformAdminError } = await supabase.rpc('is_platform_admin');
        if (platformAdminError) throw platformAdminError;
        const hasPlatformAccess = platformAdmin === true;
        const hasAdminAccess = user.role === 'admin' || hasPlatformAccess;
        setIsPlatformAdmin(hasPlatformAccess);
        setIsAdmin(hasAdminAccess);

        if (hasAdminAccess) {
          // REGRA DE OURO: Se for admin, libera TUDO.
          setPermissoes([
            'dashboard', 'membros', 'congregacoes', 'congregados',
            'visitantes', 'oracoes', 'mural', 'escalas', 'reunioes',
            'visitas', 'fichas', 'cartas', 'certificados', 'credenciais',
            'eventos', 'financeiro', 'monitor-midia', 'monitor-oracoes',
            'configuracoes', 'patrimonio', 'gabinete', 'ensino',
            'infantil', 'comunicacoes', 'relatorios',
            ...(hasPlatformAccess ? ['plataforma'] : [])
          ]);
        } else if (user.grupo_id) {
          // Se não for admin, busca as permissões do grupo dele
          const { data: perms, error: permissionsError } = await supabase
            .from('grupos_permissoes')
            .select('modulo')
            .eq('grupo_id', user.grupo_id)
            .eq('acao', 'ler');
          if (permissionsError) throw permissionsError;

          if (perms) {
            setPermissoes(perms.map(p => p.modulo));
          }
        } else {
          // Se não for admin e não tiver grupo, só vê o básico
          setPermissoes(['dashboard', 'monitor-midia']);
        }

        setLoading(false);
      } catch (error) {
        console.error("Falha ao validar a sessão:", error);
        router.replace("/");
      }
    };
    checkUser();
  }, [router]);

  const adminOnlyRoute = pathname.startsWith("/configuracoes/grupos")
    || pathname.startsWith("/configuracoes/usuarios");
  const platformAdminRoute = pathname.startsWith("/plataforma");

  useEffect(() => {
    if (!loading && adminOnlyRoute && !isAdmin) {
      router.replace("/configuracoes");
    }
  }, [adminOnlyRoute, isAdmin, loading, router]);

  useEffect(() => {
    if (!loading && platformAdminRoute && !isPlatformAdmin) {
      router.replace("/dashboard");
    }
  }, [isPlatformAdmin, loading, platformAdminRoute, router]);

  if (loading || (adminOnlyRoute && !isAdmin) || (platformAdminRoute && !isPlatformAdmin)) {
    return (
      <div className="w-full h-screen bg-ohel-bg flex items-center justify-center text-white">
        Carregando sistema...
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-ohel-bg">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} permissoes={permissoes} isAdmin={isAdmin} />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="md:hidden absolute top-4 left-4 z-50">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-ohel-surface border border-gray-800 rounded-lg text-white">
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <div className="shrink-0">
          <Header />
        </div>
        
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16 md:p-8 md:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}