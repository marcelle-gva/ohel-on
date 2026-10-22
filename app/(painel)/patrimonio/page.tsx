"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Package, Search, Plus, Edit, Trash2, ArrowLeft, Wrench, Handshake, DollarSign, ArrowRightLeft, FileText } from "lucide-react";

interface Bem {
  id: string;
  codigo: string;
  descricao: string;
  tipo: string;
  localizacao: string;
  status: string;
  valor: number;
  quantidade: number;
  departamento: string;
  data_aquisicao: string;
  garantia_ate: string;
  nota_fiscal_url: string;
}

export default function PatrimonioPage() {
  const [loading, setLoading] = useState(true);
  const [bens, setBens] = useState<Bem[]>([]);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    fetchBens();
  }, []);

  const fetchBens = async () => {
    setLoading(true);
    const { data } = await supabase.from('patrimonio_bens').select('*').order('descricao');
    if (data) setBens(data as Bem[]);
    setLoading(false);
  };

  const totalItens = bens.reduce((acc, b) => acc + Number(b.quantidade || 1), 0);
  const valorTotal = bens.reduce((acc, b) => acc + Number(b.valor || 0), 0);
  const emManutencao = bens.filter(b => b.status === 'Em Manutenção').length;
  const emprestados = bens.filter(b => b.status === 'Emprestado').length;

  const bensFiltrados = bens.filter(b => 
    b.descricao.toLowerCase().includes(busca.toLowerCase()) || 
    (b.codigo && b.codigo.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-5 pb-10">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Package className="w-5 h-5 text-ohel-blue" /> Gestão de Patrimônio
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Controle de bens, inventário, empréstimos e manutenções.</p>
          </div>
        </div>
        
        {/* BOTÕES ATUALIZADOS */}
        <div className="flex items-center gap-3">
          <Link href="/patrimonio/inventario" className="bg-ohel-surface border border-gray-700 hover:border-ohel-blue text-white font-medium py-2 px-4 rounded-md transition-all flex items-center gap-2 text-xs">
            <FileText className="w-3.5 h-3.5" /> Inventário / PDF
          </Link>
          <Link href="/patrimonio/novo" className="w-auto px-5 py-2 text-xs bg-ohel-blue hover:bg-blue-600 text-white rounded-md flex items-center gap-2 font-medium transition-colors shadow-[0_0_15px_rgba(0,123,255,0.2)]">
            <Plus className="w-3.5 h-3.5" /> Cadastrar Bem
          </Link>
        </div>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-ohel-blue flex flex-col justify-between bg-ohel-surface border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Total de Itens</p>
            <Package className="w-4 h-4 text-ohel-blue" />
          </div>
          <h2 className="text-2xl font-bold text-white">{totalItens}</h2>
        </Card>
        
        <Card className="p-4 border-l-4 border-l-green-500 flex flex-col justify-between bg-ohel-surface border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <p className="text-green-400 text-[10px] font-bold uppercase tracking-wider">Valor do Patrimônio</p>
            <DollarSign className="w-4 h-4 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-green-500">R$ {valorTotal.toFixed(2).replace('.', ',')}</h2>
        </Card>

        <Card className="p-4 border-l-4 border-l-yellow-500 flex flex-col justify-between bg-ohel-surface border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <p className="text-yellow-400 text-[10px] font-bold uppercase tracking-wider">Em Manutenção</p>
            <Wrench className="w-4 h-4 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-bold text-yellow-500">{emManutencao}</h2>
        </Card>

        <Card className="p-4 border-l-4 border-l-purple-500 flex flex-col justify-between bg-ohel-surface border-gray-800">
          <div className="flex justify-between items-start mb-2">
            <p className="text-purple-400 text-[10px] font-bold uppercase tracking-wider">Emprestados</p>
            <Handshake className="w-4 h-4 text-purple-500" />
          </div>
          <h2 className="text-2xl font-bold text-purple-500">{emprestados}</h2>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-3 flex flex-col lg:flex-row gap-3 items-center bg-ohel-surface/50 border-gray-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
          <input 
            type="text" 
            placeholder="Buscar por descrição ou código..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-ohel-bg border border-gray-700 text-xs text-white rounded-md pl-9 pr-3 py-2 focus:border-ohel-blue outline-none"
          />
        </div>
      </Card>

      {/* Tabela */}
      <Card className="p-0 overflow-hidden border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#05080f] border-b border-gray-800 text-[9px] uppercase tracking-wider text-gray-400">
              <tr>
                <th className="p-3 font-medium">Ações</th>
                <th className="p-3 font-medium">Código</th>
                <th className="p-3 font-medium">Descrição do Bem</th>
                <th className="p-3 font-medium">Tipo</th>
                <th className="p-3 font-medium">Localização</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">Carregando patrimônio...</td></tr>
              ) : bensFiltrados.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">Nenhum bem cadastrado.</td></tr>
              ) : (
                bensFiltrados.map((bem) => (
                  <tr key={bem.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-3">
                      <div className="flex gap-3 items-center">
                        <Link href={`/patrimonio/movimentar/${bem.id}`} className="text-ohel-blue hover:text-blue-400 bg-ohel-blue/10 p-1.5 rounded transition-colors" title="Movimentar Bem">
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </Link>
                        <button className="text-gray-500 hover:text-white transition-colors" title="Editar"><Edit className="w-3.5 h-3.5" /></button>
                        <button className="text-red-500 hover:text-red-400 transition-colors" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    <td className="p-3 text-gray-400">{bem.codigo || "-"}</td>
                    <td className="p-3 text-white font-bold">{bem.descricao}</td>
                    <td className="p-3 text-gray-400">{bem.tipo}</td>
                    <td className="p-3 text-gray-400">{bem.localizacao || "-"}</td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider
                        ${bem.status === "Em Uso" ? "bg-green-500/10 text-green-500 border-green-500/20" : 
                          bem.status === "Em Manutenção" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : 
                          bem.status === "Emprestado" ? "bg-purple-500/10 text-purple-500 border-purple-500/20" : 
                          "bg-gray-500/10 text-gray-500 border-gray-500/20"}`}>
                        {bem.status}
                      </span>
                    </td>
                    <td className="p-3 text-right text-white font-bold">
                      R$ {Number(bem.valor).toFixed(2).replace('.', ',')}
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