"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Users, Save, Mail, Loader2 } from "lucide-react";

interface UsuarioGrupo {
  id: string;
  nome: string;
  email: string;
  role: string;
  grupo_id: string | null;
}

interface Grupo {
  id: string;
  nome: string;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioGrupo[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const fetchDados = useCallback(async () => {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authUser) throw new Error("Sessão não encontrada.");

      const { data: user, error: userError } = await supabase
        .from('usuarios')
        .select('igreja_id')
        .eq('id', authUser.id)
        .single();
      if (userError) throw userError;
      if (!user.igreja_id) throw new Error("Usuário sem igreja vinculada.");

      const { data: gruposData, error: gruposError } = await supabase
        .from('grupos')
        .select('id, nome')
        .eq('igreja_id', user.igreja_id)
        .order('nome');
      if (gruposError) throw gruposError;
      setGrupos(gruposData ?? []);

      const { data: usuariosData, error: usuariosError } = await supabase
        .from('usuarios')
        .select('id, nome, email, role, grupo_id')
        .eq('igreja_id', user.igreja_id)
        .order('nome');
      if (usuariosError) throw usuariosError;
      setUsuarios(usuariosData ?? []);
    } catch (error) {
      console.error("Falha ao carregar usuários e grupos:", error);
      setModal({
        isOpen: true,
        type: "error",
        title: "Erro ao carregar",
        message: error instanceof Error ? error.message : "Não foi possível carregar usuários e grupos.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchDados();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchDados]);

  const handleChangeGrupo = (usuarioId: string, grupoId: string) => {
    setUsuarios(usuarios.map(usuario =>
      usuario.id === usuarioId ? { ...usuario, grupo_id: grupoId || null } : usuario
    ));
  };

  const handleSaveGrupo = async (usuario: UsuarioGrupo) => {
    setSavingId(usuario.id);
    try {
      const { error } = await supabase.rpc("admin_set_user_group", {
        p_usuario_id: usuario.id,
        p_grupo_id: usuario.grupo_id,
      });

      if (error) throw error;
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: `Grupo de acesso de ${usuario.nome} atualizado!` });
    } catch (error: unknown) {
      console.error("Falha ao atualizar grupo do usuário:", error);
      setModal({
        isOpen: true,
        type: "error",
        title: "Erro",
        message: error instanceof Error ? error.message : "Não foi possível atualizar o grupo de acesso.",
      });
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando usuários...</div>;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/configuracoes" className="text-gray-400 hover:text-white transition-colors mt-1">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-ohel-blue" /> Gestão de Usuários
            </h1>
            <p className="text-gray-400 text-sm mt-1">Vincule cada pessoa a um grupo de acesso da igreja.</p>
          </div>
        </div>
      </div>

      {/* Aviso para criar usuário no Supabase */}
      <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
        <p className="text-xs text-blue-400">
          <strong>Como adicionar novos usuários?</strong> Vá no painel do Supabase, em <strong>Authentication &gt; Users &gt; Add User</strong>. Após criar o login, ele aparecerá nesta lista para você vincular a um grupo de acesso.
        </p>
      </div>

      {/* Tabela de Usuários */}
      <Card className="overflow-hidden p-0 border-gray-800/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-ohel-surface/80 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400">
                <th className="p-4 font-medium">Nome / E-mail</th>
                <th className="p-4 font-medium">Grupo de Acesso</th>
                <th className="p-4 font-medium text-center w-24">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {usuarios.length === 0 ? (
                <tr><td colSpan={3} className="p-8 text-center text-gray-400">Nenhum usuário cadastrado.</td></tr>
              ) : (
                usuarios.map(user => (
                  <tr key={user.id} className="hover:bg-white/[0.02]">
                    <td className="p-4">
                      <p className="text-white font-bold text-sm">{user.nome}</p>
                      <p className="text-gray-400 text-xs flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" /> {user.email}</p>
                    </td>
                    <td className="p-4">
                      <select 
                        value={user.grupo_id || ""}
                        onChange={(e) => handleChangeGrupo(user.id, e.target.value)}
                        className="input-ohel w-full max-w-xs px-3 py-2 rounded-lg text-sm"
                      >
                        <option value="">Sem grupo (acesso restrito)</option>
                        {grupos.map(grupo => (
                          <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4 text-center">
                      <Button 
                        variant="primary" 
                        onClick={() => handleSaveGrupo(user)}
                        disabled={savingId === user.id}
                        className="w-auto px-4 py-2 text-xs"
                      >
                        {savingId === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-1.5" /> Salvar</>}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}