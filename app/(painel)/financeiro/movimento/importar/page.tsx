"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Upload, Check, X, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";

interface TransacaoOFX {
  id: string;
  data: string;
  valor: number;
  descricao: string;
  tipo: 'Receita' | 'Despesa';
  selected: boolean;
}

export default function ImportarOFXPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });
  
  const [transacoes, setTransacoes] = useState<TransacaoOFX[]>([]);
  const [caixas, setCaixas] = useState<any[]>([]);
  const [caixaSelecionado, setCaixaSelecionado] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) {
          setIgrejaId(user.igreja_id);
          const { data: cx } = await supabase.from('caixas').select('*').eq('igreja_id', user.igreja_id);
          if (cx) setCaixas(cx);
        }
      }
    };
    init();
  }, []);

  // Função que lê o arquivo OFX
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      // Parser simples de OFX (SGML/XML)
      const blocks = content.split("<STMTTRN>").slice(1);
      const parsed: TransacaoOFX[] = blocks.map((block, index) => {
        const getTag = (tag: string) => {
          const match = block.match(new RegExp(`<${tag}>([^<\n]+)`));
          return match ? match[1].trim() : "";
        };

        const valorStr = getTag("TRNAMT");
        const dataStr = getTag("DTPOSTED").substring(0, 8); // Pega apenas YYYYMMDD
        const desc = getTag("MEMO") || "Sem descrição";

        const valor = parseFloat(valorStr) || 0;
        // Formata a data de YYYYMMDD para YYYY-MM-DD
        const dataFormatada = `${dataStr.substring(0,4)}-${dataStr.substring(4,6)}-${dataStr.substring(6,8)}`;

        return {
          id: index.toString(),
          data: dataFormatada,
          valor: Math.abs(valor), // Sempre positivo na tabela, o tipo define a direção
          descricao: desc,
          tipo: valor < 0 ? 'Despesa' : 'Receita', // OFX usa negativo para saídas
          selected: true
        };
      });

      setTransacoes(parsed);
    };
    reader.readAsText(file);
  };

  const toggleSelect = (id: string) => {
    setTransacoes(transacoes.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
  };

  const handleImportar = async () => {
    if (!caixaSelecionado) return setModal({ isOpen: true, type: "error", title: "Atenção", message: "Selecione o Caixa/Banco de destino." });
    const paraImportar = transacoes.filter(t => t.selected);
    if (paraImportar.length === 0) return setModal({ isOpen: true, type: "error", title: "Atenção", message: "Selecione pelo menos uma transação." });

    setLoading(true);
    try {
      const inserts = paraImportar.map(t => ({
        igreja_id: igrejaId,
        tipo: t.tipo,
        data: t.data,
        mes_referencia: t.data.substring(0, 7),
        valor: t.valor,
        caixa_id: caixaSelecionado,
        descricao: `[OFX] ${t.descricao}`,
        conciliado: true // Importado do banco já entra conciliado
      }));

      const { error } = await supabase.from('transacoes').insert(inserts);
      if (error) throw error;

      setModal({ isOpen: true, type: "success", title: "Sucesso", message: `${paraImportar.length} transações importadas!` });
      setTimeout(() => router.push("/financeiro/movimento"), 1500);

    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Upload className="w-5 h-5 text-ohel-blue" /> Importar Extrato OFX
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">Importe transações do seu internet banking e concilie automaticamente.</p>
        </div>
      </div>

      <Card className="p-6 border-gray-800 bg-ohel-surface">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider mb-2 block">1. Selecione o arquivo OFX</label>
            <div className="border-2 border-dashed border-gray-700 hover:border-ohel-blue rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-ohel-bg relative">
              <input type="file" accept=".ofx" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
              <FileText className="w-8 h-8 text-gray-500 mb-2" />
              <p className="text-xs text-gray-400 font-medium">Clique para buscar o arquivo .ofx</p>
            </div>
          </div>
          
          <div>
            <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider mb-2 block">2. Caixa / Conta de Destino</label>
            <select value={caixaSelecionado} onChange={e => setCaixaSelecionado(e.target.value)} className="input-ohel w-full px-3 py-2.5 rounded-md text-sm mb-4">
              <option value="">Selecione o banco...</option>
              {caixas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <p className="text-[10px] text-gray-500">As transações importadas serão atreladas a esta conta e já entrarão como "Conciliadas".</p>
          </div>
        </div>
      </Card>

      {transacoes.length > 0 && (
        <Card className="p-0 overflow-hidden border-gray-800">
          <div className="p-4 border-b border-gray-800 bg-ohel-surface/50 flex justify-between items-center">
            <h3 className="text-sm font-bold text-white">Transações Encontradas ({transacoes.filter(t => t.selected).length} selecionadas)</h3>
            <Button onClick={handleImportar} disabled={loading} className="w-auto px-5 py-2 text-xs bg-green-500 hover:bg-green-600 text-white">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />} Confirmar Importação
            </Button>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-ohel-surface text-[10px] uppercase text-gray-500 border-b border-gray-800">
              <tr>
                <th className="p-3 text-center w-12">Importar</th>
                <th className="p-3">Data</th>
                <th className="p-3">Descrição Original</th>
                <th className="p-3 text-center">Tipo</th>
                <th className="p-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {transacoes.map(t => (
                <tr key={t.id} className={`transition-colors ${t.selected ? 'bg-ohel-blue/5' : 'opacity-50'}`}>
                  <td className="p-3 text-center">
                    <input type="checkbox" checked={t.selected} onChange={() => toggleSelect(t.id)} className="w-4 h-4 accent-ohel-blue cursor-pointer" />
                  </td>
                  <td className="p-3 text-gray-300">{new Date(`${t.data}T12:00:00`).toLocaleDateString('pt-BR')}</td>
                  <td className="p-3 text-white font-medium">{t.descricao}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${t.tipo === 'Receita' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {t.tipo}
                    </span>
                  </td>
                  <td className={`p-3 text-right font-bold ${t.tipo === 'Receita' ? 'text-green-500' : 'text-red-500'}`}>
                    {formatCurrency(t.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}