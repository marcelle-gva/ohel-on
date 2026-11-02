"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, Package, Store, Users } from "lucide-react";

interface Departamento { id: string; nome: string; responsavel_usuario_id: string | null; usuarios?: { nome: string | null; email: string | null } | { nome: string | null; email: string | null }[] | null; }

export default function DepartamentosFinanceiroPage() {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: usuario } = await supabase.from("usuarios").select("igreja_id").eq("id", session.user.id).maybeSingle();
      if (!usuario?.igreja_id) return;
      const { data } = await supabase.from("departamentos").select("id, nome, responsavel_usuario_id, usuarios:responsavel_usuario_id(nome, email)").eq("igreja_id", usuario.igreja_id).eq("ativo", true).order("nome");
      setDepartamentos(data || []); setLoading(false);
    };
    void load();
  }, []);
  const responsavel = (departamento: Departamento) => { const usuario = Array.isArray(departamento.usuarios) ? departamento.usuarios[0] : departamento.usuarios; return usuario?.nome || usuario?.email || "Responsável não definido"; };
  return <div className="max-w-6xl mx-auto flex flex-col gap-5 pb-10"><div className="flex items-center gap-3"><Link href="/financeiro" className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link><div><h1 className="text-xl font-bold text-white">Departamentos e catálogos</h1><p className="text-gray-400 text-xs mt-1">Cada responsável administra os produtos e fornecedores do seu departamento.</p></div></div><Card className="border-gray-800 bg-blue-500/5"><p className="text-xs text-gray-300">A administração geral continua vendo todos os registros em <strong>Produtos gerais</strong> e <strong>Fornecedores gerais</strong>. O departamento organiza os registros sem duplicar cadastros.</p></Card>{loading ? <p className="text-gray-400 text-sm">Carregando departamentos...</p> : departamentos.length === 0 ? <Card className="text-center text-gray-400 text-sm">Nenhum departamento ativo foi criado. Cadastre departamentos em Configurações da Igreja.</Card> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{departamentos.map((departamento) => <Card key={departamento.id} className="border-gray-800"><div className="flex items-start justify-between gap-3"><div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center"><Users className="w-5 h-5 text-purple-300" /></div><span className="text-[10px] uppercase tracking-wider text-gray-500">Departamento</span></div><h2 className="text-white font-bold mt-4">{departamento.nome}</h2><p className="text-xs text-gray-400 mt-1">Responsável: <span className="text-gray-300">{responsavel(departamento)}</span></p><div className="grid grid-cols-2 gap-2 mt-5"><Link href={`/financeiro/produtos?departamento=${departamento.id}`} className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:border-ohel-blue hover:text-white"><Package className="w-3.5 h-3.5" /> Produtos</Link><Link href={`/financeiro/fornecedores?departamento=${departamento.id}`} className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:border-ohel-blue hover:text-white"><Store className="w-3.5 h-3.5" /> Fornecedores</Link></div></Card>)}</div>}</div>;
}
