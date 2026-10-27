"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Printer, Search, Check, FileText, Eye, Calendar, Trash2, Mail, MessageCircle } from "lucide-react";
import Link from "next/link";
import { buildLetterHtml, letterHtmlToText, sanitizeLetterHtml } from "@/lib/cartas";

type MemberRow = Record<string, unknown> & {
  id: string;
  nome: string;
  cpf?: string | null;
  rg?: string | null;
  cargo?: string | null;
  telefone?: string | null;
  whatsapp_opt_in?: boolean | null;
  congregacoes?: { nome?: string | null } | null;
};
type ChurchRow = Record<string, unknown> & {
  id: string;
  nome: string;
  logo_url?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  email?: string | null;
  telefone?: string | null;
};
type LetterModel = Record<string, unknown> & {
  id: string;
  nome: string;
  conteudo?: string | null;
  tipo_cabecalho?: string | null;
  tipo_rodape?: string | null;
  texto_rodape?: string | null;
  imagem_cabecalho_url?: string | null;
};
type Signature = { id: string; cargo: string; nome: string };

export default function ImprimirCartasPage() {
  const [loading, setLoading] = useState(true);
  const [igreja, setIgreja] = useState<ChurchRow | null>(null);
  const [modelos, setModelos] = useState<LetterModel[]>([]);
  const [membros, setMembros] = useState<MemberRow[]>([]);
  const [igrejasDestinatarias, setIgrejasDestinatarias] = useState<Array<{ id: string; nome: string; email: string }>>([]);

  const [modeloSelecionado, setModeloSelecionado] = useState<LetterModel | null>(null);
  const [membrosSelecionados, setMembrosSelecionados] = useState<string[]>([]);
  const [igrejasSelecionadas, setIgrejasSelecionadas] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [loadError, setLoadError] = useState("");
  const [destinatariosError, setDestinatariosError] = useState("");
  const [sendStatus, setSendStatus] = useState("");
  const [sending, setSending] = useState(false);
  
  // Configurações do Documento
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().split('T')[0]);
  const [mostrarCabecalho, setMostrarCabecalho] = useState(true);
  const [mostrarRodape, setMostrarRodape] = useState(true);
  const [incluirAssinatura, setIncluirAssinatura] = useState(true);

  // Gerenciamento de Assinaturas
  const [assinaturas, setAssinaturas] = useState<Signature[]>([]);
  
  const tiposAssinatura = [
    "Pr. Presidente", "1º Secretário", "Pr. Auxiliar", "2º Secretário",
    "1º Tesoureiro", "2º Tesoureiro", "Membro", "Outro Cargo"
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error("Sua sessão expirou. Entre novamente.");

        const { data: user, error: userError } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (userError) throw userError;
        if (!user?.igreja_id) throw new Error("Não foi possível identificar a igreja do usuário.");

        const [igrejaRes, modelosRes, membrosRes] = await Promise.all([
          supabase.from('igrejas').select('*').eq('id', user.igreja_id).single(),
          supabase.from('modelos_cartas').select('*').eq('igreja_id', user.igreja_id).order('nome'),
          supabase.from('membros').select('*, congregacoes(nome)').eq('igreja_id', user.igreja_id).order('nome')
        ]);

        if (igrejaRes.error) throw igrejaRes.error;
        if (modelosRes.error) throw modelosRes.error;
        if (membrosRes.error) throw membrosRes.error;
        setIgreja(igrejaRes.data as ChurchRow);
        setModelos((modelosRes.data ?? []) as LetterModel[]);
        if (modelosRes.data?.length) setModeloSelecionado(modelosRes.data[0]);
        setMembros((membrosRes.data ?? []) as MemberRow[]);

        const recipientsResponse = await fetch("/api/cartas/recipients", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const recipientsResult = await recipientsResponse.json() as { churches?: Array<{ id: string; nome: string; email: string }>; error?: string };
        if (!recipientsResponse.ok) {
          setDestinatariosError(recipientsResult.error ?? "Não foi possível carregar as igrejas destinatárias.");
        } else {
          setIgrejasDestinatarias(recipientsResult.churches ?? []);
        }

      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os dados das cartas.");
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
      setAssinaturas([...assinaturas, { id: crypto.randomUUID(), cargo: tipo, nome: "" }]);
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
    (m.nome || "").toLowerCase().includes(busca.toLowerCase()) ||
    (m.cpf && m.cpf.includes(busca))
  );

  const gerarCartaHtml = (membro: MemberRow) => {
    if (!modeloSelecionado || !membro || !igreja) return "";
    return buildLetterHtml(
      modeloSelecionado,
      membro,
      igreja,
      dataEmissao,
      { mostrarCabecalho, mostrarRodape, incluirAssinatura, assinaturas },
      sanitizeLetterHtml(modeloSelecionado.conteudo || ""),
    );
  };

  const authorizationHeaders = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const enviarWhatsApp = async () => {
    setSendStatus("");
    if (!modeloSelecionado || !membrosSelecionados.length) {
      setSendStatus("Selecione um modelo e pelo menos um membro.");
      return;
    }
    const selecionados = membros.filter(m => membrosSelecionados.includes(m.id));
    const inelegiveis = selecionados.filter(m => m.whatsapp_opt_in !== true || !m.telefone);
    if (inelegiveis.length) {
      setSendStatus(`${inelegiveis.map(m => m.nome).join(", ")}: falta consentimento WhatsApp ou telefone no cadastro.`);
      return;
    }
    if (!window.confirm(`Enviar ${selecionados.length} carta(s) por WhatsApp? A Meta pode exigir uma janela de atendimento ativa.`)) return;
    setSending(true);
    let accepted = 0;
    const failures: string[] = [];
    try {
      const headers = await authorizationHeaders();
      for (const membro of selecionados) {
        const text = letterHtmlToText(gerarCartaHtml(membro));
        if (text.length > 4096) {
          failures.push(`${membro.nome}: a carta excede o limite de 4.096 caracteres do WhatsApp.`);
          continue;
        }
        const response = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ recipients: [{ id: membro.id, type: "membro" }], type: "texto", text }),
        });
        const result = await response.json() as {
          accepted?: number;
          results?: Array<{ error?: string }>;
          historyIncompleteFor?: string[];
          message?: string;
          error?: string;
        };
        if (!response.ok && response.status !== 207) {
          failures.push(`${membro.nome}: ${result.error ?? "envio recusado"}`);
        } else if (result.accepted) {
          accepted += result.accepted;
          if (result.historyIncompleteFor?.length) failures.push(`${membro.nome}: ${result.message ?? "O histórico do envio ficou incompleto."}`);
        } else {
          failures.push(`${membro.nome}: ${result.results?.[0]?.error ?? "a Meta não aceitou a mensagem"}`);
        }
      }
      setSendStatus(`${accepted} aceita(s) pela Meta; ${failures.length} falha(s).${failures.length ? ` ${failures.join(" · ")}` : ""}`);
    } catch (error) {
      setSendStatus(error instanceof Error ? error.message : "Não foi possível enviar as cartas por WhatsApp.");
    } finally {
      setSending(false);
    }
  };

  const enviarEmail = async () => {
    setSendStatus("");
    if (!modeloSelecionado || !membrosSelecionados.length || !igrejasSelecionadas.length) {
      setSendStatus("Selecione o modelo, pelo menos um membro e uma igreja destinatária.");
      return;
    }
    const totalEmails = membrosSelecionados.length * igrejasSelecionadas.length;
    if (totalEmails > 20) {
      setSendStatus("O envio permite no máximo 20 cartas por solicitação. Reduza os membros ou as igrejas selecionadas.");
      return;
    }
    if (!window.confirm(`Enviar ${totalEmails} e-mail(s), um por combinação de membro e igreja selecionada?`)) return;
    setSending(true);
    try {
      const headers = await authorizationHeaders();
      const response = await fetch("/api/cartas/send-email", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: modeloSelecionado.id,
          memberIds: membrosSelecionados,
          churchIds: igrejasSelecionadas,
          emissionDate: dataEmissao,
          options: { mostrarCabecalho, mostrarRodape, incluirAssinatura, assinaturas: assinaturas.map(({ cargo, nome }) => ({ cargo, nome })) },
        }),
      });
      const result = await response.json() as {
        accepted?: number;
        failed?: number;
        message?: string;
        error?: string;
        results?: Array<{ member: string; church: string; error?: string }>;
      };
      if (!response.ok && response.status !== 207) throw new Error(result.error ?? "Não foi possível enviar os e-mails.");
      const failures = result.results?.filter(item => item.error).map(item => `${item.member} → ${item.church}: ${item.error}`) ?? [];
      setSendStatus(`${result.message ?? "Envio concluído"} ${result.accepted ?? 0} aceito(s), ${result.failed ?? 0} falha(s).${failures.length ? ` ${failures.join(" · ")}` : ""}`);
    } catch (error) {
      setSendStatus(error instanceof Error ? error.message : "Não foi possível enviar as cartas por e-mail.");
    } finally {
      setSending(false);
    }
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
        <div className="flex flex-wrap gap-2">
          <Button onClick={handlePrint} className="w-auto px-4 py-2 text-xs bg-ohel-blue hover:bg-blue-600 text-white shadow-lg">
            <Printer className="w-4 h-4 mr-2" /> Imprimir ({membrosSelecionados.length})
          </Button>
          <Button onClick={() => void enviarWhatsApp()} disabled={sending} className="w-auto px-4 py-2 text-xs bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-50">
            <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
          </Button>
          <Button onClick={() => void enviarEmail()} disabled={sending} className="w-auto px-4 py-2 text-xs bg-indigo-700 hover:bg-indigo-600 text-white disabled:opacity-50">
            <Mail className="w-4 h-4 mr-2" /> E-mail
          </Button>
        </div>
      </div>

      {loadError && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">{loadError}</p>}
      {sendStatus && <p role="status" className="rounded-md border border-gray-700 bg-ohel-surface px-4 py-3 text-xs text-gray-200">{sendStatus}</p>}

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
              onChange={(e) => setModeloSelecionado(modelos.find(m => m.id === e.target.value) ?? null)}
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
                    <p className="text-[9px] text-gray-500 truncate">CPF: {membro.cpf || "-"} • {membro.cargo || "Membro"} • {membro.whatsapp_opt_in ? "WhatsApp autorizado" : "sem autorização WhatsApp"}</p>
                  </div>
                </label>
              ))}
            </div>
          </Card>

          <Card className="p-4 flex flex-col gap-3 border-gray-800 bg-ohel-surface">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <h3 className="text-xs font-bold text-white">E-mail para igrejas cadastradas</h3>
              <span className="text-[10px] text-gray-500">{igrejasSelecionadas.length} selecionada(s)</span>
            </div>
            {destinatariosError ? (
              <p role="alert" className="text-[11px] text-amber-300">{destinatariosError}</p>
            ) : igrejasDestinatarias.length === 0 ? (
              <p className="text-[11px] text-gray-500">Nenhuma igreja com e-mail válido disponível.</p>
            ) : (
              <div className="flex max-h-[180px] flex-col gap-1.5 overflow-y-auto pr-1">
                {igrejasDestinatarias.map(destinataria => (
                  <label key={destinataria.id} className="flex items-start gap-2 rounded-md border border-gray-800 bg-ohel-bg p-2 text-[11px] text-gray-300">
                    <input
                      type="checkbox"
                      checked={igrejasSelecionadas.includes(destinataria.id)}
                      onChange={() => setIgrejasSelecionadas(current => current.includes(destinataria.id)
                        ? current.filter(id => id !== destinataria.id)
                        : [...current, destinataria.id])}
                      className="mt-0.5 accent-ohel-blue"
                    />
                    <span className="min-w-0"><span className="block truncate font-semibold text-white">{destinataria.nome}</span><span className="block truncate text-gray-500">{destinataria.email}</span></span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-[10px] text-gray-500">Cada membro selecionado gera uma carta para cada igreja marcada. Limite: 20 e-mails por envio.</p>
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
              <div
                className="w-[210mm] min-h-[297mm] bg-white p-10 shadow-lg"
                dangerouslySetInnerHTML={{ __html: gerarCartaHtml(membroPreview) }}
              />
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
            <div key={membro.id} className="print-page" dangerouslySetInnerHTML={{ __html: gerarCartaHtml(membro) }} />
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
          }
          .print-page:last-child { page-break-after: auto; break-after: auto; }
        }
      `}} />

    </div>
  );
}