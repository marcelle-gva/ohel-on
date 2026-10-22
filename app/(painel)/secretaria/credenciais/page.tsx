"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, Printer, Search, RefreshCw, CheckSquare, Square, User } from "lucide-react";
import Image from "next/image";

export default function CredenciaisPage() {
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
        supabase.from('modelos_credenciais').select('*').eq('igreja_id', user.igreja_id),
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
      
      // Ordenar alfabeticamente
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
    if (!modeloSelecionado) return alert("Selecione um modelo de credencial.");
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

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando...</div>;

  return (
    <div className="w-full flex flex-col gap-5 pb-10 print:p-0 print:m-0">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/secretaria" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Impressão de Credenciais
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Selecione o modelo e as pessoas para gerar a impressão ou PDF.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
            <select 
              value={modeloSelecionado?.id || ""} 
              onChange={(e) => setModeloSelecionado(modelos.find(m => m.id === e.target.value))}
              className="w-full bg-ohel-bg border border-gray-700 text-sm text-white rounded-md px-3 py-2.5 outline-none focus:border-ohel-blue"
            >
              <option value="" disabled>-- Selecione o Modelo --</option>
              {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
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
      {/* ÁREA INVISÍVEL PARA A IMPRESSÃO DAS CREDENCIAIS           */}
      {/* ========================================================= */}
      <div id="print-area" className="hidden print:block w-full bg-white text-black">
        <div className="flex flex-wrap gap-4 p-4 justify-center">
          {selecionados.map(id => {
            const pessoa = pessoas.find(p => p.id === id);
            if (!pessoa) return null;

            return (
              <div key={pessoa.id} className="print-credential bg-white border border-gray-300 rounded-xl overflow-hidden shadow-sm flex flex-col" style={{ width: '54mm', height: '86mm', position: 'relative' }}>
                
                {/* Cabeçalho da Credencial */}
                <div className="bg-[#080E1B] p-2 flex items-center justify-center h-12 gap-2">
                  {igreja?.logo_url ? (
                    <div className="relative w-20 h-6">
                      <Image src={igreja.logo_url} alt="Logo" fill className="object-contain object-center brightness-0 invert" />
                    </div>
                  ) : (
                    <span className="text-[8px] font-bold text-white uppercase">{igreja?.nome}</span>
                  )}
                </div>

                {/* Corpo da Credencial */}
                <div className="flex-1 flex flex-col items-center justify-center p-2 relative">
                  {/* Faixa azul decorativa */}
                  <div className="absolute top-0 w-full h-2 bg-ohel-blue"></div>
                  
                  {/* Foto */}
                  <div className="w-16 h-16 rounded-full border-2 border-ohel-blue overflow-hidden mb-2 relative bg-gray-100 flex items-center justify-center">
                    {pessoa.foto_url ? (
                      <Image src={pessoa.foto_url} alt={pessoa.nome} fill className="object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  
                  {/* Nome e Cargo */}
                  <h3 className="text-[10px] font-bold text-center uppercase leading-tight text-black px-1">{pessoa.nome}</h3>
                  <p className="text-[7px] font-semibold text-ohel-blue text-center uppercase mt-1 mb-2">{pessoa.cargo}</p>
                  
                  {/* QR Code (Fake visual) */}
                  <div className="w-10 h-10 border border-gray-300 rounded flex items-center justify-center bg-white mt-auto">
                    <div className="w-8 h-8 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjMDAwIi8+PHJlY3QgeD0iNjAiIHk9IjEwIiB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIGZpbGw9IiMwMDAiLz48cmVjdCB4PSIxMCIgeT0iNjAiIHdpZHRoPSIzMCIgaGVpZ2h0PSIzMCIgZmlsbD0iIzAwMCIvPjwvc3ZnPg==')] bg-contain bg-no-repeat bg-center"></div>
                  </div>
                </div>

                {/* Rodapé da Credencial */}
                <div className="bg-gray-100 p-1.5 text-center">
                  <p className="text-[6px] text-gray-500 uppercase">{igreja?.nome || "OHEL ON"}</p>
                  <p className="text-[5px] text-gray-400">Válida em todo território nacional</p>
                </div>
              </div>
            );
          })}
        </div>
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
          @page { size: A4 portrait; margin: 10mm; }
          
          .print-credential {
            page-break-inside: avoid;
            break-inside: avoid;
            /* Força a impressão exata da cor de fundo */
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

    </div>
  );
}