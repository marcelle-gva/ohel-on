"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Printer, FileText, Search } from "lucide-react";

export default function InventarioPatrimonioPage() {
  const [loading, setLoading] = useState(true);
  const [igreja, setIgreja] = useState<any>(null);
  const [bens, setBens] = useState<any[]>([]);
  
  // Filtros
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) {
          const [igrejaRes, bensRes] = await Promise.all([
            supabase.from('igrejas').select('*').eq('id', user.igreja_id).single(),
            supabase.from('patrimonio_bens').select('*').eq('igreja_id', user.igreja_id).order('descricao')
          ]);
          if (igrejaRes.data) setIgreja(igrejaRes.data);
          if (bensRes.data) setBens(bensRes.data);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  // Lista única de tipos para o filtro
  const tiposDisponiveis = Array.from(new Set(bens.map(b => b.tipo))).filter(Boolean);

  const bensFiltrados = bens.filter(b => {
    const matchBusca = b.descricao.toLowerCase().includes(busca.toLowerCase()) || 
                       (b.codigo && b.codigo.toLowerCase().includes(busca.toLowerCase()));
    const matchTipo = filtroTipo === "todos" || b.tipo === filtroTipo;
    const matchStatus = filtroStatus === "todos" || b.status === filtroStatus;
    return matchBusca && matchTipo && matchStatus;
  });

  const totalItens = bensFiltrados.reduce((acc, b) => acc + Number(b.quantidade || 1), 0);
  const totalValor = bensFiltrados.reduce((acc, b) => acc + (Number(b.valor) * Number(b.quantidade || 1)), 0);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-5 pb-10">
      
      {/* HEADER (Esconde na impressão) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/patrimonio" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-ohel-blue" /> Inventário de Patrimônio
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Relatório de conferência de bens e valores.</p>
          </div>
        </div>
        <Button onClick={() => window.print()} className="w-auto px-6 py-2 text-xs bg-ohel-blue hover:bg-blue-600 text-white shadow-lg">
          <Printer className="w-4 h-4 mr-2" /> Imprimir / PDF
        </Button>
      </div>

      {/* FILTROS (Esconde na impressão) */}
      <Card className="p-4 flex flex-col md:flex-row gap-3 items-center bg-ohel-surface border-gray-800 print:hidden">
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
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="bg-ohel-bg border border-gray-700 text-xs text-white rounded-md px-3 py-2 outline-none w-full md:w-48">
          <option value="todos">Todos os Tipos</option>
          {tiposDisponiveis.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="bg-ohel-bg border border-gray-700 text-xs text-white rounded-md px-3 py-2 outline-none w-full md:w-40">
          <option value="todos">Todos os Status</option>
          <option value="Em Uso">Em Uso</option>
          <option value="Em Manutenção">Em Manutenção</option>
          <option value="Emprestado">Emprestado</option>
          <option value="Baixado">Baixado</option>
        </select>
      </Card>

      {/* ========================================================= */}
      {/* ÁREA DE IMPRESSÃO (A4) */}
      {/* ========================================================= */}
      <div id="print-area" className="bg-white text-black p-8 shadow-2xl print:shadow-none print:p-0 min-h-[297mm] rounded-lg print:rounded-none">
        
        {/* Cabeçalho do Relatório */}
        <div className="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex items-center gap-4">
            {igreja?.logo_url ? (
              <div className="relative w-32 h-16">
                <img src={igreja.logo_url} alt="Logo" className="object-contain h-full w-full object-left" />
              </div>
            ) : (
              <div className="w-24 h-16 bg-gray-100 flex items-center justify-center border border-gray-300 text-xs text-gray-400">LOGO</div>
            )}
            <div>
              <h1 className="text-xl font-bold uppercase">{igreja?.nome || "IGREJA"}</h1>
              <p className="text-xs text-gray-500">Relatório de Inventário Patrimonial</p>
            </div>
          </div>
          <div className="text-[10px] text-gray-600 text-right">
            <p><strong>Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
            <p><strong>Filtros:</strong> {filtroTipo === 'todos' ? 'Geral' : filtroTipo} / {filtroStatus === 'todos' ? 'Todos Status' : filtroStatus}</p>
          </div>
        </div>

        {/* Tabela de Bens */}
        <table className="w-full text-left text-xs border-collapse mb-8">
          <thead>
            <tr className="bg-gray-200 border-b border-gray-400">
              <th className="p-2 border-r border-gray-300">Código</th>
              <th className="p-2 border-r border-gray-300">Descrição do Bem</th>
              <th className="p-2 border-r border-gray-300 text-center">Qtd</th>
              <th className="p-2 border-r border-gray-300">Localização</th>
              <th className="p-2 border-r border-gray-300">Status</th>
              <th className="p-2 text-right">V. Unit (R$)</th>
              <th className="p-2 text-right">V. Total (R$)</th>
            </tr>
          </thead>
          <tbody>
            {bensFiltrados.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-gray-500 italic">Nenhum bem encontrado com estes filtros.</td></tr>
            ) : bensFiltrados.map((bem) => {
              const qtd = Number(bem.quantidade || 1);
              const valorUnit = Number(bem.valor || 0);
              const valorTotalItem = qtd * valorUnit;

              return (
                <tr key={bem.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="p-2 border-r border-gray-200 text-gray-600">{bem.codigo || "-"}</td>
                  <td className="p-2 border-r border-gray-200 font-bold">{bem.descricao}</td>
                  <td className="p-2 border-r border-gray-200 text-center">{qtd}</td>
                  <td className="p-2 border-r border-gray-200">{bem.localizacao || "-"}</td>
                  <td className="p-2 border-r border-gray-200">{bem.status}</td>
                  <td className="p-2 text-right font-mono">{valorUnit.toFixed(2).replace('.', ',')}</td>
                  <td className="p-2 text-right font-mono font-bold">{valorTotalItem.toFixed(2).replace('.', ',')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Rodapé do Relatório (Totais) */}
        <div className="border-t-2 border-gray-800 pt-4 flex flex-col items-end gap-1">
          <div className="flex justify-between w-72 text-xs border-b border-gray-300 pb-1">
            <span className="font-bold">Total de Itens (Qtd):</span>
            <span className="font-mono font-bold">{totalItens}</span>
          </div>
          <div className="flex justify-between w-72 text-sm pt-1">
            <span className="font-bold">Avaliação Total do Patrimônio:</span>
            <span className="font-mono font-bold text-blue-700">R$ {totalValor.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>

        {/* Assinaturas (Apenas na impressão) */}
        <div className="hidden print:flex justify-between mt-24 px-12 text-xs text-center">
          <div className="w-64 border-t border-black pt-2">Responsável pelo Patrimônio</div>
          <div className="w-64 border-t border-black pt-2">Tesoureiro / Pastor</div>
        </div>

      </div>

      {/* CSS PARA IMPRESSÃO */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 15mm;
          }
          @page { size: A4 portrait; margin: 0; }
        }
      `}} />

    </div>
  );
}