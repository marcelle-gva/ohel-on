"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Printer, Search, Check, FileText, Eye, Calendar, Trash2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function ImprimirCartasPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [igreja, setIgreja] = useState<any>(null);
  const [modelos, setModelos] = useState<any[]>([]);
  const [membros, setMembros] = useState<any[]>([]);
  
  const [modeloSelecionado, setModeloSelecionado] = useState<any>(null);
  const [membrosSelecionados, setMembrosSelecionados] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  
  // Configurações do Documento
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().split('T')[0]);
  const [mostrarCabecalho, setMostrarCabecalho] = useState(true);
  const [mostrarRodape, setMostrarRodape] = useState(true);
  const [incluirAssinatura, setIncluirAssinatura] = useState(true);

  // Gerenciamento de Assinaturas
  const [assinaturas, setAssinaturas] = useState<any[]>([]);
  
  const tiposAssinatura = [
    "Pr. Presidente", "1º Secretário", "Pr. Auxiliar", "2º Secretário",
    "1º Tesoureiro", "2º Tesoureiro", "Membro", "Outro Cargo"
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (!user) return;

        const [igrejaRes, modelosRes, membrosRes] = await Promise.all([
          supabase.from('igrejas').select('*').eq('id', user.igreja_id).single(),
          supabase.from('modelos_cartas').select('*').eq('igreja_id', user.igreja_id).order('nome'),
          supabase.from('membros').select('*, congregacoes(nome)').eq('igreja_id', user.igreja_id).order('nome')
        ]);

        if (igrejaRes.data) setIgreja(igrejaRes.data);
        if (modelosRes.data) {
          setModelos(modelosRes.data);
          if (modelosRes.data.length > 0) setModeloSelecionado(modelosRes.data[0]);
        }
        if (membrosRes.data) setMembros(membrosRes.data);

      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleAssinatura = (tipo: string) => {
    const existe = assinaturas.find(a => a.cargo === tipo);
    if (existe) {
      setAssinaturas(assinaturas.filter(a => a.cargo !== tipo));
    } else {
      setAssinaturas([...assinaturas, { id: Date.now().toString(), cargo: tipo, nome: "" }]);
    }
  };

  const updateAssinaturaNome = (id: string, nome: string) => {
    setAssinaturas(assinaturas.map(a => a.id === id ? { ...a, nome } : a));
  };

  const handlePrint = () => {
    if (membrosSelecionados.length === 0) return alert("Selecione pelo menos um membro.");
    window.print();
  };

  const toggleMembro = (id: string) => {
    if (membrosSelecionados.includes(id)) {
      setMembrosSelecionados(membrosSelecionados.filter(m => m !== id));
    } else {
      setMembrosSelecionados([...membrosSelecionados, id]);
    }
  };

  const selecionarTodos = () => {
    if (membrosSelecionados.length === membrosFiltrados.length) {
      setMembrosSelecionados([]);
    } else {
      setMembrosSelecionados(membrosFiltrados.map(m => m.id));
    }
  };

  const membrosFiltrados = membros.filter(m => 
    m.nome.toLowerCase().includes(busca.toLowerCase()) || 
    (m.cpf && m.cpf.includes(busca))
  );

  const gerarTextoCartas = (membro: any) => {
    if (!modeloSelecionado || !membro || !igreja) return "";

    let texto = modeloSelecionado.conteudo;
    const dataFormatada = new Date(`${dataEmissao}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    
    const substituicoes = {
      "{{nome}}": membro.nome || "",
      "{{cpf}}": membro.cpf || "Não informado",
      "{{rg}}": membro.rg || "Não informado",
      "{{cargo}}": membro.cargo || "Membro",
      "{{congregacao}}": membro.congregacoes?.nome || "Sede",
      "{{denominacao}}": igreja.nome || "Igreja",
      "{{data_atual}}": dataFormatada
    };

    Object.keys(substituicoes).forEach(tag => {
      texto = texto.replace(new RegExp(tag, 'g'), substituicoes[tag as keyof typeof substituicoes]);
    });

    return texto;
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando dados para impressão...</div>;

  const membroPreview = membros.find(m => m.id === membrosSelecionados[0]);

  return (
    <div className="w-full flex flex-col gap-5 pb-10 print:p-0 print:m-0">
      
      {/* CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/secretaria/cartas" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2"><Printer className="w-5 h-5 text-ohel-blue"/> Impressão e Emissão de Cartas</h1>
            <p className="text-gray-400 text-xs mt-0.5">Escolha o modelo, selecione os destinatários e imprima os documentos.</p>
          </div>
        </div>
        <Button onClick={handlePrint} className="w-auto px-6 py-2 text-xs bg-ohel-blue hover:bg-blue-600 text-white shadow-lg">
          <Printer className="w-4 h-4 mr-2" /> Imprimir Selecionados ({membrosSelecionados.length})
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 print:hidden items-start">
        
        {/* COLUNA ESQUERDA: Configurações */}
        <div className="lg:col-span-5 flex flex-col gap-4 h-fit">
          
          <Card className="p-4 flex flex-col gap-3 border-gray-800 bg-ohel-surface">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-ohel-blue/10 text-ohel-blue flex items-center justify-center text-[10px] font-bold">1</span>
                <h3 className="text-xs font-bold text-white">Modelo de Carta</h3>
              </div>
            </div>
            
            <select 
              value={modeloSelecionado?.id || ""} 
              onChange={(e) => setModeloSelecionado(modelos.find(m => m.id === e.target.value))}
              className="input-ohel w-full px-3 py-2 rounded-md text-xs font-medium"
            >
              <option value="" disabled>Selecione o modelo</option>
              {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>

            {modeloSelecionado && (
              <div className="bg-ohel-bg p-2.5 rounded-lg border border-gray-800 mt-1">
                <p className="text-[11px] font-bold text-white flex items-center gap-2"><FileText className="w-3 h-3 text-ohel-blue" /> {modeloSelecionado.nome}</p>
              </div>
            )}
          </Card>

          {/* CARD DE DESTINATÁRIOS COMPACTADO */}
          <Card className="p-4 flex flex-col gap-3 border-gray-800 bg-ohel-surface">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-ohel-blue/10 text-ohel-blue flex items-center justify-center text-[10px] font-bold">2</span>
                <h3 className="text-xs font-bold text-white">Destinatários</h3>
              </div>
              <button onClick={selecionarTodos} className="text-[10px] text-ohel-blue hover:text-blue-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> Selecionar Todos
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
              <input 
                type="text" 
                placeholder="Pesquise por nome, CPF..." 
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full bg-ohel-bg border border-gray-800 text-[11px] text-white rounded-md pl-8 pr-3 py-2 outline-none focus:border-ohel-blue"
              />
            </div>

            {/* LISTA COM ALTURA LIMITADA E SCROLL */}
            <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar mt-1">
              {membrosFiltrados.length === 0 ? (
                <p className="text-center text-[11px] text-gray-500 py-4">Nenhum membro encontrado.</p>
              ) : membrosFiltrados.map(membro => (
                <label key={membro.id} className="flex items-start gap-2.5 p-2 rounded-md border border-gray-800 bg-ohel-bg hover:border-ohel-blue/50 cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    checked={membrosSelecionados.includes(membro.id)}
                    onChange={() => toggleMembro(membro.id)}
                    className="mt-0.5 w-3.5 h-3.5 accent-ohel-blue cursor-pointer"
                  />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[11px] font-bold text-white truncate">{membro.nome}</p>
                    <p className="text-[9px] text-gray-500 truncate">CPF: {membro.cpf || "-"} • {membro.cargo}</p>
                  </div>
                </label>
              ))}
            </div>
          </Card>

          {/* CARD DE DATA E ASSINATURAS */}
          <Card className="p-4 flex flex-col gap-3 border-gray-800 bg-ohel-surface">
            <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-ohel-blue/10 text-ohel-blue flex items-center justify-center text-[10px] font-bold">3</span>
              <h3 className="text-xs font-bold text-white">Data e Assinaturas</h3>
            </div>
            
            <div>
              <label className="text-[9px] font-semibold text-gray-400 uppercase mb-1 block">Data de Emissão</label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
                <input 
                  type="date" 
                  value={dataEmissao}
                  onChange={e => setDataEmissao(e.target.value)}
                  className="w-full bg-ohel-bg border border-gray-800 text-[11px] text-white rounded-md pl-8 pr-3 py-2 outline-none focus:border-ohel-blue"
                />
              </div>
            </div>

            <div>
              <p className="text-[9px] font-semibold text-gray-400 uppercase mb-1.5">Elementos:</p>
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-[11px] text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={mostrarCabecalho} onChange={() => setMostrarCabecalho(!mostrarCabecalho)} className="w-3.5 h-3.5 accent-ohel-blue" />
                  Cabeçalho
                </label>
                <label className="flex items-center gap-2 text-[11px] text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={mostrarRodape} onChange={() => setMostrarRodape(!mostrarRodape)} className="w-3.5 h-3.5 accent-ohel-blue" />
                  Rodapé
                </label>
                <label className="flex items-center gap-2 text-[11px] text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={incluirAssinatura} onChange={() => setIncluirAssinatura(!incluirAssinatura)} className="w-3.5 h-3.5 accent-ohel-blue" />
                  Incluir Assinaturas
                </label>
              </div>
            </div>

            {incluirAssinatura && (
              <div className="mt-1">
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {tiposAssinatura.map(tipo => {
                    const isSelected = assinaturas.some(a => a.cargo === tipo);
                    return (
                      <button 
                        key={tipo} 
                        type="button" 
                        onClick={() => toggleAssinatura(tipo)}
                        className={`px-2.5 py-1 rounded-full text-[9px] font-medium border transition-colors flex items-center gap-1 ${isSelected ? 'bg-ohel-blue text-white border-ohel-blue' : 'bg-ohel-bg text-gray-400 border-gray-700 hover:border-gray-500'}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-gray-600'}`}></div> {tipo}
                      </button>
                    )
                  })}
                </div>

                <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                  {assinaturas.map(ass => (
                    <div key={ass.id} className="bg-ohel-bg border border-gray-800 rounded p-2 relative group">
                      <button type="button" onClick={() => toggleAssinatura(ass.cargo)} className="absolute top-1.5 right-1.5 text-gray-500 hover:text-red-500" title="Remover"><Trash2 className="w-3 h-3" /></button>
                      <p className="text-[9px] text-gray-400 uppercase mb-1.5 font-bold">{ass.cargo}</p>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Nome" 
                          value={ass.nome} 
                          onChange={e => updateAssinaturaNome(ass.id, e.target.value)}
                          className="bg-ohel-surface border border-gray-700 text-[10px] text-white rounded px-2 py-1 outline-none focus:border-ohel-blue w-full" 
                        />
                      </div>
                    </div>
                  ))}
                  {assinaturas.length === 0 && (
                    <p className="text-[10px] text-gray-500 italic text-center py-1">Nenhuma assinatura.</p>
                  )}
                </div>
              </div>
            )}
          </Card>

        </div>

        {/* COLUNA DIREITA: Pré-visualização */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Eye className="w-4 h-4 text-ohel-blue" /> Pré-visualização A4</h3>
            {membrosSelecionados.length === 0 && <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">Selecione um membro</span>}
          </div>

          <div className="w-full bg-gray-200 rounded-lg p-2 md:p-6 overflow-x-auto min-h-[500px] flex justify-center">
            {!membroPreview ? (
              <div className="w-[210mm] h-[297mm] bg-white text-gray-400 flex flex-col items-center justify-center p-10 shadow-lg">
                <FileText className="w-16 h-16 text-gray-300 mb-4" />
                <p className="text-sm font-medium">Aguardando seleção...</p>
              </div>
            ) : (
              <div className="w-[210mm] min-h-[297mm] bg-white text-black p-10 shadow-lg font-sans flex flex-col">
                
                {mostrarCabecalho && (
                  <div className="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-8">
                    <div className="flex items-center gap-4">
                      {igreja?.logo_url ? (
                        <div className="relative w-32 h-16">
                          <Image src={igreja.logo_url} alt="Logo" fill className="object-contain object-left" />
                        </div>
                      ) : (
                        <div className="w-24 h-16 bg-gray-100 flex items-center justify-center border border-gray-300 text-xs text-gray-400">LOGO</div>
                      )}
                      <div><h1 className="text-xl font-bold uppercase">{igreja?.nome || "IGREJA"}</h1></div>
                    </div>
                    <div className="text-[10px] text-gray-600 leading-tight text-right">
                      <p><strong>CNPJ:</strong> {igreja?.cnpj || "00.000.000/0000-00"}</p>
                      <p>{igreja?.endereco || "Endereço da Igreja"}</p>
                      <p><strong>E-mail:</strong> {igreja?.email || "email@igreja.com"}</p>
                      <p><strong>Tel:</strong> {igreja?.telefone || "(00) 0000-0000"}</p>
                    </div>
                  </div>
                )}

                <div 
                  className="text-sm text-justify leading-loose min-h-[300px] whitespace-pre-wrap font-sans flex-1"
                  dangerouslySetInnerHTML={{ __html: gerarTextoCartas(membroPreview) }} 
                />

                {incluirAssinatura && assinaturas.length > 0 && (
                  <div className="mt-16 flex flex-wrap justify-around gap-8">
                    {assinaturas.map(ass => (
                      <div key={ass.id} className="w-56 border-t border-black text-center pt-2">
                        <p className="text-sm font-bold">{ass.nome || ass.cargo}</p>
                        <p className="text-xs text-gray-600">{ass.cargo}</p>
                      </div>
                    ))}
                  </div>
                )}

                {mostrarRodape && (
                  <div className="border-t border-gray-300 pt-3 text-[8px] text-gray-400 text-justify mt-12">
                    <p>Documento gerado eletronicamente pelo sistema OHEL ON. Válido em todo o território nacional.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ÁREA INVISÍVEL PARA IMPRESSÃO */}
      <div id="print-area" className="hidden print:block w-full bg-white text-black">
        {membrosSelecionados.map(membroId => {
          const membro = membros.find(m => m.id === membroId);
          if (!membro) return null;

          return (
            <div key={membro.id} className="print-page flex flex-col">
              {mostrarCabecalho && (
                <div className="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-8">
                  <div className="flex items-center gap-4">
                    {igreja?.logo_url && (
                      <div className="relative w-32 h-16">
                        <Image src={igreja.logo_url} alt="Logo" fill className="object-contain object-left" />
                      </div>
                    )}
                    <div><h1 className="text-xl font-bold uppercase">{igreja?.nome}</h1></div>
                  </div>
                  <div className="text-[10px] text-gray-600 leading-tight text-right">
                    <p><strong>CNPJ:</strong> {igreja?.cnpj}</p>
                    <p>{igreja?.endereco}</p>
                  </div>
                </div>
              )}
              <div 
                className="text-sm text-justify leading-loose whitespace-pre-wrap flex-1"
                dangerouslySetInnerHTML={{ __html: gerarTextoCartas(membro) }} 
              />
              {incluirAssinatura && assinaturas.length > 0 && (
                <div className="mt-20 flex flex-wrap justify-around gap-10">
                  {assinaturas.map(ass => (
                    <div key={ass.id} className="w-56 border-t border-black text-center pt-2">
                      <p className="text-sm font-bold">{ass.nome || ass.cargo}</p>
                      <p className="text-xs text-gray-600">{ass.cargo}</p>
                    </div>
                  ))}
                </div>
              )}
              {mostrarRodape && (
                <div className="border-t border-gray-300 pt-3 text-[8px] text-gray-400 text-justify mt-auto">
                  <p>Documento gerado eletronicamente pelo sistema OHEL ON. Válido em todo o território nacional.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CSS ISOLANDO A ÁREA DE IMPRESSÃO */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4 portrait; margin: 0; }
          .print-page {
            page-break-after: always;
            break-after: page;
            width: 210mm;
            min-height: 297mm;
            padding: 15mm 20mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            background: white;
            overflow: hidden;
          }
          .print-page:last-child { page-break-after: auto; break-after: auto; }
        }
      `}} />

    </div>
  );
}