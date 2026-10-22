"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowLeft, Printer, FileText, Search, RefreshCw } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function RelatoriosFinanceirosPage() {
  const [loading, setLoading] = useState(false);
  const [igreja, setIgreja] = useState<any>(null);
  
  // Filtros
  const [tipoRelatorio, setTipoRelatorio] = useState("categoria");
  const [dataInicio, setDataInicio] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  
  // Dados processados
  const [dados, setDados] = useState<any[]>([]);
  const [totais, setTotais] = useState({ receitas: 0, despesas: 0, saldo: 0 });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) {
          const { data: igrejaData } = await supabase.from('igrejas').select('*').eq('id', user.igreja_id).single();
          if (igrejaData) setIgreja(igrejaData);
        }
      }
    };
    init();
  }, []);

  const gerarRelatorio = async () => {
    setLoading(true);
    setDados([]);
    try {
      let query = supabase.from('transacoes')
        .select('*, categorias_financeiras(nome), caixas(nome), membros(nome)')
        .gte('data', dataInicio)
        .lte('data', dataFim);

      const { data: transacoes, error } = await query;
      if (error) throw error;

      let processedData: any[] = [];
      let rec = 0;
      let desp = 0;

      if (tipoRelatorio === 'categoria') {
        // Agrupar por Categoria
        const agrupado = transacoes.reduce((acc: any, t: any) => {
          const catNome = t.categorias_financeiras?.nome || "Sem Categoria";
          const key = `${t.tipo}-${catNome}`;
          if (!acc[key]) acc[key] = { tipo: t.tipo, categoria: catNome, total: 0 };
          acc[key].total += Number(t.valor);
          return acc;
        }, {});
        
        processedData = Object.values(agrupado).sort((a: any, b: any) => a.tipo.localeCompare(b.tipo) || b.total - a.total);
        
        rec = processedData.filter((d: any) => d.tipo === 'Receita').reduce((a: any, b: any) => a + b.total, 0);
        desp = processedData.filter((d: any) => d.tipo === 'Despesa').reduce((a: any, b: any) => a + b.total, 0);

      } else if (tipoRelatorio === 'caixa') {
        // Agrupar por Caixa
        const agrupado = transacoes.reduce((acc: any, t: any) => {
          const cxNome = t.caixas?.nome || "Caixa Não Informado";
          if (!acc[cxNome]) acc[cxNome] = { caixa: cxNome, receitas: 0, despesas: 0, saldo: 0 };
          if (t.tipo === 'Receita') acc[cxNome].receitas += Number(t.valor);
          if (t.tipo === 'Despesa') acc[cxNome].despesas += Number(t.valor);
          acc[cxNome].saldo = acc[cxNome].receitas - acc[cxNome].despesas;
          return acc;
        }, {});
        
        processedData = Object.values(agrupado);
        rec = processedData.reduce((a: any, b: any) => a + b.receitas, 0);
        desp = processedData.reduce((a: any, b: any) => a + b.despesas, 0);

      } else if (tipoRelatorio === 'membro') {
        // Filtrar apenas Dízimos e Ofertas
        const transFiltradas = transacoes.filter((t: any) => 
          t.tipo === 'Receita' && 
          (t.categorias_financeiras?.nome.includes('Dízimo') || t.categorias_financeiras?.nome.includes('Oferta'))
        );

        const agrupado = transFiltradas.reduce((acc: any, t: any) => {
          const memNome = t.membros?.nome || t.origem_nome_manual || "Não Identificado";
          if (!acc[memNome]) acc[memNome] = { membro: memNome, valor: 0 };
          acc[memNome].valor += Number(t.valor);
          return acc;
        }, {});

        processedData = Object.values(agrupado).sort((a: any, b: any) => b.valor - a.valor);
        rec = processedData.reduce((a: any, b: any) => a + b.valor, 0);
      }

      setDados(processedData);
      setTotais({ receitas: rec, despesas: desp, saldo: rec - desp });

    } catch (error) {
      console.error(error);
      alert("Erro ao gerar relatório.");
    } finally {
      setLoading(false);
    }
  };

  // Gera automaticamente ao abrir a tela
  useEffect(() => {
    gerarRelatorio();
  }, []);

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-5 pb-10">
      
      {/* HEADER DA PÁGINA (Esconde na impressão) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/financeiro" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-ohel-blue" /> Relatórios Financeiros
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Gere relatórios analíticos e sintéticos para impressão.</p>
          </div>
        </div>
        <Button onClick={() => window.print()} className="w-auto px-6 py-2 text-xs bg-ohel-blue hover:bg-blue-600 text-white shadow-lg">
          <Printer className="w-4 h-4 mr-2" /> Imprimir / PDF
        </Button>
      </div>

      {/* FILTROS */}
      <Card className="p-4 flex flex-col md:flex-row gap-4 items-end bg-ohel-surface border-gray-800 print:hidden">
        <div className="flex-1 w-full">
          <label className="text-[10px] font-semibold text-ohel-silver uppercase mb-1.5 block">Tipo de Relatório</label>
          <select value={tipoRelatorio} onChange={e => setTipoRelatorio(e.target.value)} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
            <option value="categoria">Entradas e Saídas por Categoria</option>
            <option value="caixa">Movimentação por Caixa / Banco</option>
            <option value="membro">Dízimos e Ofertas por Membro</option>
          </select>
        </div>
        <div className="w-full md:w-40">
          <Input label="Data Início" type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="py-2 text-xs" />
        </div>
        <div className="w-full md:w-40">
          <Input label="Data Fim" type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="py-2 text-xs" />
        </div>
        <Button onClick={gerarRelatorio} disabled={loading} className="w-full md:w-auto px-6 py-2 text-xs bg-ohel-surface border border-gray-700 hover:border-ohel-blue text-white">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />} Gerar
        </Button>
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
                <Image src={igreja.logo_url} alt="Logo" fill className="object-contain object-left" />
              </div>
            ) : (
              <div className="w-24 h-16 bg-gray-100 flex items-center justify-center border border-gray-300 text-xs text-gray-400">LOGO</div>
            )}
            <div>
              <h1 className="text-xl font-bold uppercase">{igreja?.nome || "IGREJA"}</h1>
              <p className="text-xs text-gray-500">Relatório Financeiro Oficial</p>
            </div>
          </div>
          <div className="text-[10px] text-gray-600 text-right">
            <p><strong>Período:</strong> {new Date(`${dataInicio}T12:00:00`).toLocaleDateString('pt-BR')} a {new Date(`${dataFim}T12:00:00`).toLocaleDateString('pt-BR')}</p>
            <p><strong>Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* Título do Relatório */}
        <h2 className="text-lg font-bold uppercase mb-4 text-center">
          {tipoRelatorio === 'categoria' && "Resumo de Entradas e Saídas por Categoria"}
          {tipoRelatorio === 'caixa' && "Movimentação por Caixa / Banco"}
          {tipoRelatorio === 'membro' && "Relatório de Dízimos e Ofertas por Membro"}
        </h2>

        {/* Tabela de Dados */}
        <table className="w-full text-left text-xs border-collapse mb-8">
          <thead>
            <tr className="bg-gray-200 border-b border-gray-400">
              {tipoRelatorio === 'categoria' && (
                <><th className="p-2 border-r border-gray-300">Tipo</th><th className="p-2 border-r border-gray-300">Categoria</th><th className="p-2 text-right">Valor (R$)</th></>
              )}
              {tipoRelatorio === 'caixa' && (
                <><th className="p-2 border-r border-gray-300">Caixa / Banco</th><th className="p-2 text-right border-r border-gray-300">Entradas</th><th className="p-2 text-right border-r border-gray-300">Saídas</th><th className="p-2 text-right">Saldo</th></>
              )}
              {tipoRelatorio === 'membro' && (
                <><th className="p-2 border-r border-gray-300">Nome do Membro</th><th className="p-2 text-right">Total Contribuído (R$)</th></>
              )}
            </tr>
          </thead>
          <tbody>
            {dados.length === 0 ? (
              <tr><td colSpan={4} className="p-4 text-center text-gray-500 italic">Nenhum dado encontrado neste período.</td></tr>
            ) : dados.map((d: any, index: number) => (
              <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                {tipoRelatorio === 'categoria' && (
                  <>
                    <td className={`p-2 border-r border-gray-200 font-bold ${d.tipo === 'Receita' ? 'text-green-600' : 'text-red-600'}`}>{d.tipo}</td>
                    <td className="p-2 border-r border-gray-200">{d.categoria}</td>
                    <td className="p-2 text-right font-mono">{d.total.toFixed(2).replace('.', ',')}</td>
                  </>
                )}
                {tipoRelatorio === 'caixa' && (
                  <>
                    <td className="p-2 border-r border-gray-200 font-bold">{d.caixa}</td>
                    <td className="p-2 text-right text-green-600 font-mono">{d.receitas.toFixed(2).replace('.', ',')}</td>
                    <td className="p-2 text-right text-red-600 font-mono border-r border-gray-200">{d.despesas.toFixed(2).replace('.', ',')}</td>
                    <td className={`p-2 text-right font-mono font-bold ${d.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{d.saldo.toFixed(2).replace('.', ',')}</td>
                  </>
                )}
                {tipoRelatorio === 'membro' && (
                  <>
                    <td className="p-2 border-r border-gray-200">{d.membro}</td>
                    <td className="p-2 text-right font-mono text-green-600">{d.valor.toFixed(2).replace('.', ',')}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Rodapé do Relatório (Totais) */}
        {dados.length > 0 && (
          <div className="border-t-2 border-gray-800 pt-4 flex flex-col items-end gap-1">
            <div className="flex justify-between w-64 text-xs">
              <span className="font-bold">Total de Receitas:</span>
              <span className="font-mono text-green-600">R$ {totais.receitas.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between w-64 text-xs">
              <span className="font-bold">Total de Despesas:</span>
              <span className="font-mono text-red-600">R$ {totais.despesas.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between w-64 text-sm border-t border-gray-300 pt-1 mt-1">
              <span className="font-bold">Saldo Final:</span>
              <span className={`font-mono font-bold ${totais.saldo >= 0 ? 'text-blue-700' : 'text-red-700'}`}>R$ {totais.saldo.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>
        )}

        {/* Assinaturas (Apenas na impressão) */}
        <div className="hidden print:flex justify-between mt-24 px-12 text-xs text-center">
          <div className="w-64 border-t border-black pt-2">Tesoureiro(a)</div>
          <div className="w-64 border-t border-black pt-2">Pastor / Presidente</div>
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