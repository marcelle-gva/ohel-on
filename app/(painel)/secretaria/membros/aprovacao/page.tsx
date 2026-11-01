"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { FeedbackModal } from "@/components/ui/FeedbackModal";

interface PreCadastro {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  congregacao_id: string | null;
  created_at: string | null;
}

export default function AprovacaoPage() {
  const [preCadastros, setPreCadastros] = useState<PreCadastro[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const fetchPreCadastros = async () => {
    try {
      const { data, error } = await supabase
        .from("membros")
        .select("id, nome, telefone, email, congregacao_id, created_at")
        .eq("status", "Pré-Cadastro")
        .order("created_at", { ascending: false, nullsFirst: false });
      
      if (error) throw error;
      setPreCadastros(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchPreCadastros(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleAprovar = async (id: string) => {
    try {
      const { error } = await supabase.from("membros").update({ status: "Ativo" }).eq("id", id);
      if (error) throw error;
      
      setPreCadastros(preCadastros.filter(p => p.id !== id));
      setModal({ isOpen: true, type: "success", title: "Aprovado", message: "O pré-cadastro foi aprovado e o membro já está ativo no sistema." });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Não foi possível aprovar." });
    }
  };

  const handleRecusar = async (id: string) => {
    try {
      const { error } = await supabase.from("membros").delete().eq("id", id);
      if (error) throw error;
      
      setPreCadastros(preCadastros.filter(p => p.id !== id));
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Não foi possível recusar." });
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex items-center gap-4">
        <Link href="/secretaria/membros" className="text-gray-400 hover:text-white transition-colors mt-1">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Análise de Pré-Cadastros</h1>
          <p className="text-gray-400 text-sm mt-1">Aprove ou recuse os cadastros recebidos pelo QR Code.</p>
        </div>
      </div>

      <Card className="overflow-hidden p-0 border-gray-800">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-ohel-surface/80 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400">
              <th className="p-4 font-medium">Nome</th>
              <th className="p-4 font-medium">Telefone</th>
              <th className="p-4 font-medium">E-mail</th>
              <th className="p-4 font-medium">Recebido em</th>
              <th className="p-4 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Carregando...</td></tr>
            ) : preCadastros.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nenhum pré-cadastro pendente no momento.</td></tr>
            ) : (
              preCadastros.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <td className="p-4 text-white font-medium">{p.nome}</td>
                  <td className="p-4 text-gray-300">{p.telefone}</td>
                  <td className="p-4 text-gray-300">{p.email || "—"}</td>
                  <td className="p-4 text-gray-400 text-xs">{p.created_at ? new Date(p.created_at).toLocaleString("pt-BR") : "—"}</td>
                  <td className="p-4 flex items-center gap-3">
                    <button onClick={() => handleAprovar(p.id)} className="text-green-500 hover:text-green-400 flex items-center gap-1 text-xs font-medium" title="Aprovar">
                      <CheckCircle className="w-5 h-5" /> Aprovar
                    </button>
                    <button onClick={() => handleRecusar(p.id)} className="text-red-500 hover:text-red-400 flex items-center gap-1 text-xs font-medium" title="Recusar">
                      <XCircle className="w-5 h-5" /> Recusar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
