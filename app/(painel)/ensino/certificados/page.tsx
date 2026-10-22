"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Printer, Search, CheckSquare, Square, Award, User, FileText } from "lucide-react";
import Image from "next/image";

export default function CertificadosEbdPage() {
  const [loading, setLoading] = useState(true);
  const [igreja, setIgreja] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClasseId, setSelectedClasseId] = useState<string>("");
  
  const [alunos, setAlunos] = useState<any[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [busca, setBusca] = useState("");

  const [professorNome, setProfessorNome] = useState("");
  const [dataConclusao, setDataConclusao] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedClasseId) {
      fetchAlunos(selectedClasseId);
    }
  }, [selectedClasseId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
      if (!user) return;

      const [igrejaRes, classesRes] = await Promise.all([
        supabase.from('igrejas').select('*').eq('id', user.igreja_id).single(),
        supabase.from('ebd_classes').select('*').eq('status', 'Ativa').order('nome')
      ]);

      if (igrejaRes.data) setIgreja(igrejaRes.data);
      if (classesRes.data) {
        setClasses(classesRes.data);
        if (classesRes.data.length > 0) {
          setSelectedClasseId(classesRes.data[0].id);
          // Tenta puxar o professor da classe
          const profId = classesRes.data[0].professor_id;
          if (profId) {
            const { data: prof } = await supabase.from('membros').select('nome').eq('id', profId).single();
            if (prof) setProfessorNome(prof.nome);
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlunos = async (classeId: string) => {
    const { data } = await supabase
      .from('ebd_matriculas')
      .select('membro_id, membros(nome)')
      .eq('classe_id', classeId)
      .eq('status', 'Ativo')
      .order('membros(nome)');
    
    if (data) {
      setAlunos(data);
      setSelecionados([]); // Limpa seleção ao mudar de classe
    }

    // Atualiza o nome do professor no campo
    const classeAtual = classes.find(c => c.id === classeId);
    if (classeAtual?.professor_id) {
      const { data: prof } = await supabase.from('membros').select('nome').eq('id', classeAtual.professor_id).single();
      if (prof) setProfessorNome(prof.nome);
    } else {
      setProfessorNome("");
    }
  };

  const toggleSelecionado = (id: string) => {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter(i => i !== id));
    } else {
      setSelecionados([...selecionados, id]);
    }
  };

  const selecionarTodos = () => {
    if (selecionados.length === alunosFiltrados.length) {
      setSelecionados([]);
    } else {
      setSelecionados(alunosFiltrados.map(a => a.membro_id));
    }
  };

  const handlePrint = () => {
    if (selecionados.length === 0) return alert("Selecione pelo menos um aluno.");
    window.print();
  };

  const alunosFiltrados = alunos.filter(a => 
    (a.membros as any)?.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const classeAtual = classes.find(c => c.id === selectedClasseId);

  const formatarData = (dataStr: string) => {
    if (!dataStr) return "";
    return new Date(`${dataStr}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando dados...</div>;

  return (
    <div className="w-full flex flex-col gap-5 pb-10 print:p-0 print:m-0">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/ensino" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Award className="w-5 h-5 text-ohel-blue" /> Certificados EBD
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Gere certificados de conclusão e participação da Escola Bíblica.</p>
          </div>
        </div>
        <Button onClick={handlePrint} className="w-auto px-6 py-2 text-xs bg-ohel-blue hover:bg-blue-600 text-white shadow-lg">
          <Printer className="w-4 h-4 mr-2" /> Imprimir Selecionados ({selecionados.length})
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 print:hidden">
        
        {/* COLUNA ESQUERDA: CONFIGURAÇÕES */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          <Card className="p-5 border-gray-800 bg-ohel-surface">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-ohel-blue/10 text-ohel-blue flex items-center justify-center text-[10px]">1</span>
              Configuração do Certificado
            </h2>
            
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-ohel-silver uppercase">Classe da EBD</label>
                <select 
                  value={selectedClasseId} 
                  onChange={(e) => setSelectedClasseId(e.target.value)}
                  className="input-ohel w-full px-3 py-2.5 rounded-md text-xs font-medium"
                >
                  {classes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-ohel-silver uppercase mb-1.5 block">Professor(a)</label>
                  <input 
                    type="text" 
                    value={professorNome} 
                    onChange={e => setProfessorNome(e.target.value)}
                    placeholder="Nome do professor"
                    className="input-ohel w-full px-3 py-2 rounded-md text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-ohel-silver uppercase mb-1.5 block">Data Conclusão</label>
                  <input 
                    type="date" 
                    value={dataConclusao} 
                    onChange={e => setDataConclusao(e.target.value)}
                    className="input-ohel w-full px-3 py-2 rounded-md text-xs"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-gray-800 bg-ohel-surface flex-1">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-ohel-blue/10 text-ohel-blue flex items-center justify-center text-[10px]">2</span>
                Selecione os Alunos
              </h2>
              <button onClick={selecionarTodos} className="text-[10px] text-ohel-blue hover:text-blue-400 flex items-center gap-1">
                {selecionados.length === alunosFiltrados.length && alunosFiltrados.length > 0 ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                Todos
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
              <input 
                type="text" 
                placeholder="Buscar aluno..." 
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full bg-ohel-bg border border-gray-700 text-xs text-white rounded-md pl-9 pr-3 py-2 outline-none focus:border-ohel-blue"
              />
            </div>

            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {alunosFiltrados.length === 0 ? (
                <p className="text-center text-xs text-gray-500 py-4">Nenhum aluno nesta classe.</p>
              ) : alunosFiltrados.map(aluno => (
                <label key={aluno.membro_id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selecionados.includes(aluno.membro_id) ? 'border-ohel-blue bg-ohel-blue/5' : 'border-gray-800 bg-ohel-bg hover:border-gray-600'}`}>
                  <input 
                    type="checkbox" 
                    checked={selecionados.includes(aluno.membro_id)}
                    onChange={() => toggleSelecionado(aluno.membro_id)}
                    className="w-4 h-4 accent-ohel-blue cursor-pointer"
                  />
                  <p className="text-xs font-bold text-white truncate">{(aluno.membros as any)?.nome}</p>
                </label>
              ))}
            </div>
          </Card>
        </div>

        {/* COLUNA DIREITA: PREVIEW (Escondida na impressão, mas serve de guia) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-white">Pré-visualização A4 (Paisagem)</h3>
          
          <div className="w-full bg-gray-200 rounded-lg p-2 flex justify-center overflow-hidden">
            <div className="w-[800px] h-[560px] bg-white text-black p-10 shadow-lg relative flex flex-col items-center justify-center border-[12px] border-double border-[#007BFF]">
              <div className="absolute inset-0 opacity-5 flex items-center justify-center pointer-events-none">
                {igreja?.logo_url && <Image src={igreja.logo_url} alt="Marca d'água" width={400} height={400} className="object-contain grayscale" />}
              </div>
              <div className="text-center z-10 w-full">
                {igreja?.logo_url && (
                  <div className="relative w-32 h-16 mx-auto mb-4">
                    <Image src={igreja.logo_url} alt="Logo" fill className="object-contain" />
                  </div>
                )}
                <h1 className="text-2xl font-bold uppercase tracking-widest text-[#007BFF] mb-6">Certificado de Conclusão</h1>
                <p className="text-lg mb-4">Certificamos que</p>
                <h2 className="text-3xl font-serif italic text-gray-800 border-b border-gray-400 pb-2 mb-4 inline-block px-10">
                  {selecionados.length > 0 ? (alunos.find(a => a.membro_id === selecionados[0])?.membros as any)?.nome : "Nome do Aluno"}
                </h2>
                <p className="text-base text-justify text-gray-700 leading-relaxed max-w-2xl mx-auto">
                  concluiu com êxito os estudos da classe <strong>{classeAtual?.nome}</strong> na Escola Bíblica Dominical, demonstrando dedicação e compromisso com o aprendizado da Palavra de Deus.
                </p>
                
                <div className="flex justify-around w-full mt-16 px-10">
                  <div className="text-center">
                    <div className="w-48 border-t border-gray-400 mb-2"></div>
                    <p className="text-xs font-bold uppercase">{professorNome || "Professor(a)"}</p>
                    <p className="text-[10px] text-gray-500">Professor(a) da Classe</p>
                  </div>
                  <div className="text-center">
                    <div className="w-48 border-t border-gray-400 mb-2"></div>
                    <p className="text-xs font-bold uppercase">Pastor Presidente</p>
                    <p className="text-[10px] text-gray-500">{igreja?.nome}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ÁREA INVISÍVEL PARA A IMPRESSÃO REAL (A4 Paisagem)        */}
      {/* ========================================================= */}
      <div id="print-area" className="hidden print:block w-full">
        {selecionados.map(membroId => {
          const aluno = alunos.find(a => a.membro_id === membroId);
          if (!aluno) return null;

          return (
            <div key={aluno.membro_id} className="print-certificado bg-white text-black relative">
              
              <div className="w-full h-full border-[12px] border-double border-[#007BFF] flex flex-col items-center justify-center relative p-12">
                
                {igreja?.logo_url && (
                  <div className="absolute inset-0 opacity-5 flex items-center justify-center pointer-events-none">
                    <Image src={igreja.logo_url} alt="Marca d'água" width={500} height={500} className="object-contain grayscale" />
                  </div>
                )}

                <div className="text-center z-10 w-full">
                  {igreja?.logo_url && (
                    <div className="relative w-40 h-20 mx-auto mb-6">
                      <Image src={igreja.logo_url} alt="Logo" fill className="object-contain" />
                    </div>
                  )}
                  <h1 className="text-3xl font-bold uppercase tracking-[0.2em] text-[#007BFF] mb-8">Certificado de Conclusão</h1>
                  
                  <p className="text-xl text-gray-700 mb-6">Certificamos com alegria que</p>
                  
                  <h2 className="text-4xl font-serif italic text-gray-900 border-b border-gray-400 pb-3 mb-8 inline-block px-16">
                    {(aluno.membros as any)?.nome}
                  </h2>
                  
                  <p className="text-lg text-justify text-gray-700 leading-relaxed max-w-3xl mx-auto">
                    concluiu com êxito os estudos da classe <strong className="text-[#007BFF]">{classeAtual?.nome}</strong> na Escola Bíblica Dominical, demonstrando dedicação, assiduidade e compromisso com o aprendizado da Palavra de Deus.
                  </p>
                  
                  <div className="flex justify-around w-full mt-24 px-12">
                    <div className="text-center">
                      <div className="w-64 border-t border-black mb-2"></div>
                      <p className="text-sm font-bold uppercase">{professorNome || "Professor(a)"}</p>
                      <p className="text-xs text-gray-600">Professor(a) da Classe</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-8">{formatarData(dataConclusao)}</p>
                    </div>
                    <div className="text-center">
                      <div className="w-64 border-t border-black mb-2"></div>
                      <p className="text-sm font-bold uppercase">Pastor Presidente</p>
                      <p className="text-xs text-gray-600">{igreja?.nome}</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* CSS ISOLANDO A ÁREA DE IMPRESSÃO */}
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
          
          .print-certificado {
            page-break-after: always;
            break-after: page;
            width: 297mm;
            height: 210mm;
            background-color: white;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .print-certificado:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}} />

    </div>
  );
}