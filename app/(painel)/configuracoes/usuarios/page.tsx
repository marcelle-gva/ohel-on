"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Users, Save, Shield, Mail, Loader2, UserPlus } from "lucide-react";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: string;
  perfil_id: string | null;
  perfis: { nome: string } | null;
}

interface Perfil {
  id: string;
  nome: string;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) {
          setIgrejaId(user.igreja_id);
          
          // Busca Perfis disponíveis
          const { data: perfisData } = await supabase
            .from('perfis')
            .select('id, nome')
            .eq('igreja_id', user.igreja_id)
            .order('nome');
          if (perfisData) setPerfis(perfisData);

          // Busca Usuários com seus perfis
          const { data: usuariosData } = await supabase
            .from('usuarios')
            .select('*, perfis(nome)')
            .eq('igreja_id', user.igreja_id)
            .order('nome');
          
          if (usuariosData) setUsuarios(usuariosData);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePerfil = (usuarioId: string, perfilId: string) => {
    setUsuarios(usuarios.map(u => 
      u.id === usuarioId ? { ...u, perfil_id: perfilId || null } : u
    ));
  };

  const handleSavePerfil = async (usuario: Usuario) => {
    setSavingId(usuario.id);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ perfil_id: usuario.perfil_id })
        .eq('id', usuario.id);

      if (error) throw error;
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: `Perfil de ${usuario.nome} atualizado!` });
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
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
            <p className="text-gray-400 text-sm mt-1">Vincule cada pessoa ao seu perfil de acesso.</p>
          </div>
        </div>
      </div>

      {/* Aviso para criar usuário no Supabase */}
      <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
        <p className="text-xs text-blue-400">
          <strong>Como adicionar novos usuários?</strong> Vá no painel do Supabase, em <strong>Authentication &gt; Users &gt; Add User</strong>. Após criar o login, ele aparecerá nesta lista para você vincular ao perfil de acesso.
        </p>
      </div>

      {/* Tabela de Usuários */}
      <Card className="overflow-hidden p-0 border-gray-800/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-ohel-surface/80 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400">
                <th className="p-4 font-medium">Nome / E-mail</th>
                <th className="p-4 font-medium">Perfil de Acesso</th>
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
                        value={user.perfil_id || ""}
                        onChange={(e) => handleChangePerfil(user.id, e.target.value)}
                        className="input-ohel w-full max-w-xs px-3 py-2 rounded-lg text-sm"
                      >
                        <option value="">Sem Perfil (Acesso Restrito)</option>
                        {perfis.map(p => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4 text-center">
                      <Button 
                        variant="primary" 
                        onClick={() => handleSavePerfil(user)}
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