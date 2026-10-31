"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Menu } from "lucide-react";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [permissoes, setPermissoes] = useState<string[]>([]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      // Busca o grupo e a role (admin, pastor, membro) do usuário
      const { data: user } = await supabase
        .from('usuarios')
        .select('grupo_id, role')
        .eq('id', session.user.id)
        .single();

      if (user?.role === 'admin') {
        // REGRA DE OURO: Se for admin, libera TUDO.
        setPermissoes([
          'dashboard', 'membros', 'congregacoes', 'congregados', 
          'visitantes', 'eventos', 'financeiro', 'mural', 
          'monitor-midia', 'monitor-oracoes', 'escalas', 'configuracoes', 'patrimonio', 'gabinete', 'ensino', 'sorteios', 'kids-teens'
        ]);
      } else if (user?.grupo_id) {
        // Se não for admin, busca as permissões do grupo dele
        const { data: perms } = await supabase
          .from('grupos_permissoes')
          .select('modulo')
          .eq('grupo_id', user.grupo_id)
          .eq('acao', 'ler');
        
        if (perms) {
          setPermissoes(perms.map(p => p.modulo));
        }
      } else {
        // Se não for admin e não tiver grupo, só vê o básico
        setPermissoes(['dashboard', 'monitor-midia']);
      }

      setLoading(false);
    };
    checkUser();
  }, [router]);

  if (loading) {
    return (
      <div className="w-full h-screen bg-ohel-bg flex items-center justify-center text-white">
        Carregando sistema...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-ohel-bg overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} permissoes={permissoes} />

      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        <div className="md:hidden absolute top-4 left-4 z-50">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-ohel-surface border border-gray-800 rounded-lg text-white">
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <Header />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-16 md:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}