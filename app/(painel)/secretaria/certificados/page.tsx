"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, Printer, Search, RefreshCw, CheckSquare, Square, Award } from "lucide-react";
import Image from "next/image";

export default function CertificadosPage() {
  const [loading, setLoading] = useState(true);
  const [igreja, setIgreja] = useState<any>(null);
  const [modelos, setModelos] = useState<any[]>([]);
  const [pessoas, setPessoas] = useState<any[]>([]);
  
  const [modeloSelecionado, setModeloSelecionado] = useState<any>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
      if (!user) return;

      const [igrejaRes, modelosRes, membrosRes, congregadosRes] = await Promise.all([
        supabase.from('igrejas').select('*').eq('id', user.igreja_id).single(),
        supabase.from('modelos_certificados').select('*').eq('igreja_id', user.igreja_id),
        supabase.from('membros').select('id, nome, foto_url, cargo').eq('igreja_id', user.igreja_id),
        supabase.from('congregados').select('id, nome, foto_url, status').eq('igreja_id', user.igreja_id)
      ]);

      if (igrejaRes.data) setIgreja(igrejaRes.data);
      if (modelosRes.data) {
        setModelos(modelosRes.data);
        if (modelosRes.data.length > 0) setModeloSelecionado(modelosRes.data[0]);
      }

      // Unificar pessoas
      const listaMembros = (membrosRes.data || []).map(m => ({ ...m, tipo: "Membro", cargo: m.cargo }));
      const listaCongregados = (congregadosRes.data || []).map(c => ({ ...c, tipo: "Congregado", cargo: "Congregado" }));
      const todasPessoas = [...listaMembros, ...listaCongregados].sort((a, b) => a.nome.localeCompare(b.nome));
      
      setPessoas(todasPessoas);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePrint = () => {
    if (selecionados.length === 0) return alert("Selecione pelo menos uma pessoa.");
    if (!modeloSelecionado) return alert("Selecione um modelo de certificado.");
    window.print();
  };

  const toggleSelecionado = (id: string) => {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter(i => i !== id));
    } else {
      setSelecionados([...selecionados, id]);
    }
  };

  const filtradas = pessoas.filter(p => {
    const matchBusca = p.nome.toLowerCase().includes(busca.toLowerCase());
    const matchFiltro = filtro === "todos" || p.tipo.toLowerCase() === filtro.toLowerCase();
    return matchBusca && matchFiltro;
  });

  const selecionarTodos = () => {
    if (selecionados.length === filtradas.length) {
      setSelecionados([]);
    } else {
      setSelecionados(filtradas.map(p => p.id));
    }
  };

  // Função que substitui as variáveis no certificado
  const gerarTextoCertificado = (pessoa: any) => {
    if (!modeloSelecionado || !pessoa) return "";
    let texto = modeloSelecionado.conteudo;
    const dataAtual = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    
    texto = texto.replace(/{{nome}}/g, pessoa.nome || "");
    texto = texto.replace(/{{cargo}}/g, pessoa.cargo || "Membro");
    texto = texto.replace(/{{data_atual}}/g, dataAtual);
    
    return texto;
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando...</div>;

  return (
    <div className="w-full flex flex-col gap-5 pb-10 print:p-0 print:m-0">
      
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/secretaria" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Award className="w-5 h-5 text-ohel-blue" /> Impressão de Certificados
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Selecione o modelo e as pessoas para gerar a impressão ou PDF.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* BOTÃO ADICIONADO AQUI */}
          <Link href="/secretaria/certificados/modelos" className="bg-ohel-surface border border-gray-700 hover:border-gray-500 text-gray-300 text-xs font-medium py-2 px-4 rounded-md flex items-center gap-2 transition-colors">
            <Award className="w-3.5 h-3.5" /> Gerenciar Modelos
          </Link>
          <button onClick={fetchData} className="bg-ohel-surface border border-gray-700 hover:border-gray-500 text-gray-300 text-xs font-medium py-2 px-4 rounded-md flex items-center gap-2 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Recarregar
          </button>
          <Button onClick={handlePrint} className="w-auto px-6 py-2 text-xs bg-ohel-blue hover:bg-blue-600 text-white shadow-lg">
            <Printer className="w-4 h-4 mr-2" /> Visualizar / Imprimir ({selecionados.length})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        
        {/* COLUNA 1: MODELOS */}
        <div className="md:col-span-1">
          <Card className="p-5 border-gray-800 bg-ohel-surface">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-ohel-blue/10 text-ohel-blue flex items-center justify-center text-[10px]">1</span>
              Selecione o Modelo
            </h2>
            {modelos.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-gray-400 mb-2">Nenhum modelo cadastrado.</p>
                <Link href="/secretaria/certificados/modelos/novo" className="text-xs text-ohel-blue hover:underline">Criar primeiro modelo</Link>
              </div>
            ) : (
              <select 
                value={modeloSelecionado?.id || ""} 
                onChange={(e) => setModeloSelecionado(modelos.find(m => m.id === e.target.value))}
                className="w-full bg-ohel-bg border border-gray-700 text-sm text-white rounded-md px-3 py-2.5 outline-none focus:border-ohel-blue"
              >
                <option value="" disabled>-- Selecione o Modelo --</option>
                {modelos.map(m => <option key={m.id} value={m.id}>{m.nome} (Certificado)</option>)}
              </select>
            )}
          </Card>
        </div>

        {/* COLUNA 2: PESSOAS */}
        <div className="md:col-span-2">
          <Card className="p-5 border-gray-800 bg-ohel-surface">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-ohel-blue/10 text-ohel-blue flex items-center justify-center text-[10px]">2</span>
              Selecione as Pessoas
            </h2>
            
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Buscar por nome..." 
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full bg-ohel-bg border border-gray-700 text-xs text-white rounded-md pl-9 pr-3 py-2.5 outline-none focus:border-ohel-blue"
                />
              </div>
              <select 
                value={filtro} 
                onChange={e => setFiltro(e.target.value)}
                className="bg-ohel-bg border border-gray-700 text-xs text-white rounded-md px-3 py-2.5 outline-none w-full md:w-40"
              >
                <option value="todos">Todos</option>
                <option value="Membro">Membros</option>
                <option value="Congregado">Congregados</option>
              </select>
            </div>

            <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-2">
              <button onClick={selecionarTodos} className="flex items-center gap-2 text-xs text-ohel-blue hover:text-blue-400 font-medium">
                {selecionados.length === filtradas.length && filtradas.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                Selecionar Todos
              </button>
              <span className="text-[10px] text-gray-500">{filtradas.length} encontrados</span>
            </div>

            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
              {filtradas.length === 0 ? (
                <p className="text-center text-xs text-gray-500 py-4">Nenhuma pessoa encontrada.</p>
              ) : filtradas.map(pessoa => (
                <div 
                  key={pessoa.id} 
                  onClick={() => toggleSelecionado(pessoa.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selecionados.includes(pessoa.id) ? 'border-ohel-blue bg-ohel-blue/5' : 'border-gray-800 bg-ohel-bg hover:border-gray-600'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${selecionados.includes(pessoa.id) ? 'bg-ohel-blue border-ohel-blue' : 'border-gray-600'}`}>
                      {selecionados.includes(pessoa.id) && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{pessoa.nome}</p>
                      <p className="text-[10px] text-gray-400">{pessoa.tipo}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ÁREA INVISÍVEL PARA A IMPRESSÃO DOS CERTIFICADOS (A4)     */}
      {/* ========================================================= */}
      <div id="print-area" className="hidden print:block w-full bg-white text-black">
        {selecionados.map(id => {
          const pessoa = pessoas.find(p => p.id === id);
          if (!pessoa) return null;

          return (
            <div key={pessoa.id} className="print-page-certificado bg-white relative overflow-hidden" 
                 style={{ width: '297mm', height: '210mm', padding: '15mm', boxSizing: 'border-box' }}>
              
              {/* Borda Decorativa do Certificado */}
              <div className="w-full h-full border-[6px] border-double border-[#007BFF] p-8 flex flex-col items-center justify-between relative bg-[#03060D] text-white rounded-lg">
                
                {/* Marca d'água sutil (Logo) */}
                {igreja?.logo_url && (
                  <div className="absolute inset-0 opacity-5 flex items-center justify-center pointer-events-none">
                    <Image src={igreja.logo_url} alt="Marca d'água" width={400} height={400} className="object-contain brightness-0 invert" />
                  </div>
                )}

                {/* Cabeçalho */}
                <div className="flex flex-col items-center text-center z-10">
                  {igreja?.logo_url && (
                    <div className="relative w-48 h-20 mb-4">
                      <Image src={igreja.logo_url} alt="Logo" fill className="object-contain brightness-0 invert" />
                    </div>
                  )}
                  <h1 className="text-3xl font-bold uppercase tracking-widest text-[#007BFF]">{igreja?.nome}</h1>
                  <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">Certificado Oficial</p>
                </div>

                {/* Corpo do Certificado */}
                <div className="flex flex-col items-center text-center z-10 my-8 flex-1 justify-center w-full max-w-4xl">
                  <p className="text-lg text-gray-300 mb-6">Certificamos com honra e alegria que</p>
                  <h2 className="text-5xl font-serif italic text-white border-b border-gray-600 pb-4 mb-6 px-12">{pessoa.nome}</h2>
                  
                  <div 
                    className="text-xl text-justify text-gray-200 leading-relaxed font-serif max-w-3xl"
                    dangerouslySetInnerHTML={{ __html: gerarTextoCertificado(pessoa) }}
                  />
                </div>

                {/* Rodapé / Assinaturas */}
                <div className="w-full flex justify-between items-end z-10 mt-8 px-12">
                  <div className="text-center">
                    <div className="w-64 border-t border-gray-400 mb-2"></div>
                    <p className="text-sm font-bold">Pastor Presidente</p>
                    <p className="text-[10px] text-gray-400">{igreja?.nome}</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-2">{new Date().toLocaleDateString('pt-BR')}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Data de Emissão</p>
                  </div>

                  <div className="text-center">
                    <div className="w-64 border-t border-gray-400 mb-2"></div>
                    <p className="text-sm font-bold">Secretário(a)</p>
                    <p className="text-[10px] text-gray-400">{igreja?.nome}</p>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* CSS PARA A IMPRESSÃO */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page { 
            size: A4 landscape; /* Formato Paisagem */
            margin: 0; 
          }
          
          .print-page-certificado {
            page-break-after: always;
            break-after: page;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .print-page-certificado:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}} />

    </div>
  );
}