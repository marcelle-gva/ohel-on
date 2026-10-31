"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, MonitorPlay, Users, Music, MessageSquare, HeartHandshake, CalendarDays, Maximize, BookOpen, Sparkles, QrCode, X, ChevronLeft, ChevronRight, Minus, Plus, AlertTriangle, Edit, Lock, Check, Trash, Calendar } from "lucide-react";
import QRCode from "react-qr-code";
import { FeedbackModal } from "@/components/ui/FeedbackModal";

export default function MonitorMidiaPage() {
  const [loading, setLoading] = useState(true);
  
  const [visitantesHoje, setVisitantesHoje] = useState<any[]>([]);
  const [louvoresHoje, setLouvoresHoje] = useState<any[]>([]);
  const [muralRecente, setMuralRecente] = useState<any[]>([]);
  const [oracoesSemana, setOracoesSemana] = useState<any[]>([]);
  const [oracoesPendentes, setOracoesPendentes] = useState<any[]>([]);
  const [escalasProximas, setEscalasProximas] = useState<any[]>([]);

  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  
  // Permissões do Usuário
  const [podeAprovar, setPodeAprovar] = useState(false);
  const [podeVerEscala, setPodeVerEscala] = useState(false);
  
  // Estados dos Modais
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isPrayerQrModalOpen, setIsPrayerQrModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  const [modalFeedback, setModalFeedback] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [louvorToDelete, setLouvorToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [projecaoAtual, setProjecaoAtual] = useState<{ musicaId: string | null; slide: number; transposicao: number }>({
    musicaId: null,
    slide: 0,
    transposicao: 0
  });

  const hoje = new Date().toISOString().split('T')[0];

  useEffect(() => {
    let channel: any;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: user } = await supabase.from('usuarios').select('igreja_id, grupo_id, role').eq('id', session.user.id).maybeSingle();
          
          if (user) {
            setIgrejaId(user.igreja_id);

            // VERIFICAÇÃO DE PERMISSÕES
            if (user.role === 'admin') {
              setPodeAprovar(true);
              setPodeVerEscala(true);
            } else if (user.grupo_id) {
              const { data: perms } = await supabase
                .from('grupos_permissoes')
                .select('modulo, acao')
                .eq('grupo_id', user.grupo_id);
              
              if (perms) {
                setPodeAprovar(perms.some(p => p.modulo === 'monitor-oracoes' && p.acao === 'aprovar'));
                setPodeVerEscala(perms.some(p => p.modulo === 'escalas' && p.acao === 'ler'));
              }
            }

            const seteDiasAtras = new Date();
            seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

            // Busca os dados do monitor
            const [visitasRes, louvoresRes, muralRes, oracoesRes, pendentesRes, escalasRes] = await Promise.all([
              supabase.from('visitantes').select('*').eq('igreja_id', user.igreja_id).eq('data_visita', hoje),
              supabase.from('louvores').select('*').eq('igreja_id', user.igreja_id).eq('data', hoje).order('created_at'),
              supabase.from('comunicacoes').select('*').eq('igreja_id', user.igreja_id).order('created_at', { ascending: false }).limit(3),
              supabase.from('pedidos_oracao').select('*').eq('igreja_id', user.igreja_id).eq('status', 'Aprovado').gte('created_at', seteDiasAtras.toISOString()).order('created_at', { ascending: false }),
              supabase.from('pedidos_oracao').select('*').eq('igreja_id', user.igreja_id).eq('status', 'Pendente').order('created_at', { ascending: false }),
              // Busca as próximas 3 escalas com os membros escalados
              supabase.from('escalas')
                .select(`
                  id, titulo, data_culto, horario_inicio,
                  escalados (
                    membros (nome),
                    funcoes_escala (nome)
                  )
                `)
                .eq('igreja_id', user.igreja_id)
                .gte('data_culto', hoje)
                .order('data_culto', { ascending: true })
                .limit(3)
            ]);

            const queryErrors = [
              visitasRes.error,
              louvoresRes.error,
              muralRes.error,
              oracoesRes.error,
              pendentesRes.error,
              escalasRes.error,
            ].filter(Boolean);
            if (queryErrors.length > 0) {
              throw new Error(queryErrors.map((queryError) => queryError?.message).join("; "));
            }

            setVisitantesHoje(visitasRes.data || []);
            setLouvoresHoje(louvoresRes.data || []);
            setMuralRecente(muralRes.data || []);
            setOracoesSemana(oracoesRes.data || []);
            setOracoesPendentes(pendentesRes.data || []);
            setEscalasProximas(escalasRes.data || []);

            const channelName = `realtime-monitor-${Date.now()}-${Math.random()}`;
            channel = supabase
              .channel(channelName)
              .on('postgres_changes', { event: '*', schema: 'public', table: 'louvores', filter: `igreja_id=eq.${user.igreja_id}` }, (payload) => {
                if (payload.eventType === 'INSERT') setLouvoresHoje((prev) => prev.some(l => l.id === payload.new.id) ? prev : [...prev, payload.new]);
                else if (payload.eventType === 'DELETE') setLouvoresHoje((prev) => prev.filter(l => l.id !== payload.old.id));
                else if (payload.eventType === 'UPDATE') {
                  setLouvoresHoje((prev) => payload.new.data === hoje
                    ? prev.some((louvor) => louvor.id === payload.new.id)
                      ? prev.map((louvor) => louvor.id === payload.new.id ? payload.new : louvor)
                      : [...prev, payload.new]
                    : prev.filter((louvor) => louvor.id !== payload.new.id));
                }
              })
              .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_oracao', filter: `igreja_id=eq.${user.igreja_id}` }, (payload) => {
                if (payload.eventType === 'INSERT' && payload.new.status === 'Pendente') {
                  setOracoesPendentes((prev) => prev.some(o => o.id === payload.new.id) ? prev : [payload.new, ...prev]);
                }
                if (payload.eventType === 'UPDATE') {
                  setOracoesPendentes((prev) => payload.new.status === 'Pendente'
                    ? prev.some((pedido) => pedido.id === payload.new.id)
                      ? prev.map((pedido) => pedido.id === payload.new.id ? payload.new : pedido)
                      : [payload.new, ...prev]
                    : prev.filter((pedido) => pedido.id !== payload.new.id));
                  setOracoesSemana((prev) => payload.new.status === 'Aprovado'
                    ? prev.some((pedido) => pedido.id === payload.new.id)
                      ? prev.map((pedido) => pedido.id === payload.new.id ? payload.new : pedido)
                      : [payload.new, ...prev]
                    : prev.filter((pedido) => pedido.id !== payload.new.id));
                }
              })
              .subscribe();
          }
        }
      } catch (error) {
        console.error(error);
        setModalFeedback({
          isOpen: true,
          type: "error",
          title: "Não foi possível carregar o Monitor",
          message: error instanceof Error ? error.message : "Verifique sua conexão e as permissões do usuário.",
        });
      } finally {
        setLoading(false);
      }
    };
    
    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [hoje]);

  const toggleFullScreen = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (!document.fullscreenElement) {
      element?.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen();
    }
  };

  const confirmDeleteLouvor = async () => {
    if (!louvorToDelete) return;
    setIsDeleting(true);
    try {
      if (!igrejaId) throw new Error("Igreja não identificada.");
      const { data, error } = await supabase.from('louvores').delete()
        .eq('id', louvorToDelete).eq('igreja_id', igrejaId).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Louvor não encontrado ou sem permissão para excluir.");
      setLouvoresHoje((current) => current.filter(l => l.id !== louvorToDelete));
      setLouvorToDelete(null);
    } catch (error) {
      setModalFeedback({ isOpen: true, type: "error", title: "Erro", message: error instanceof Error ? error.message : "Não foi possível excluir." });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApprovePrayer = async (id: string) => {
    try {
      if (!igrejaId) throw new Error("Igreja não identificada.");
      const { data, error } = await supabase.from('pedidos_oracao').update({ status: 'Aprovado' })
        .eq('id', id).eq('igreja_id', igrejaId).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Pedido não encontrado ou sem permissão para aprovar.");
      const aprovado = oracoesPendentes.find(o => o.id === id);
      setOracoesPendentes((current) => current.filter(o => o.id !== id));
      if (aprovado) setOracoesSemana((current) => [{ ...aprovado, status: 'Aprovado' }, ...current]);
    } catch (error) {
      setModalFeedback({ isOpen: true, type: "error", title: "Erro", message: error instanceof Error ? error.message : "Não foi possível aprovar." });
    }
  };

  const handleRejectPrayer = async (id: string) => {
    try {
      if (!igrejaId) throw new Error("Igreja não identificada.");
      const { data, error } = await supabase.from('pedidos_oracao').update({ status: 'Rejeitado' })
        .eq('id', id).eq('igreja_id', igrejaId).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Pedido não encontrado ou sem permissão para rejeitar.");
      setOracoesPendentes((current) => current.filter(o => o.id !== id));
    } catch (error) {
      setModalFeedback({ isOpen: true, type: "error", title: "Erro", message: error instanceof Error ? error.message : "Não foi possível rejeitar." });
    }
  };

  const enviarComandoProjecao = async (musicaId: string, status: string, slide: number, transposicao: number) => {
    if (!igrejaId) return;
    const channel = supabase.channel(`projecao-${igrejaId}`);
    try {
      await channel.httpSend('comando_projecao', { musica_id: musicaId, status: status, slide_index: slide, transposicao: transposicao });
      supabase.removeChannel(channel);
      setProjecaoAtual({ musicaId, slide, transposicao });
    } catch (error) { console.error(error); }
  };

  const publicUrl = typeof window !== "undefined" && igrejaId ? `${window.location.origin}/louvor/${igrejaId}` : "";
  const projecaoUrl = typeof window !== "undefined" ? `${window.location.origin}/projecao` : "";
  const prayerUrl = typeof window !== "undefined" && igrejaId ? `${window.location.origin}/oracao/${igrejaId}` : "";

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-5 pb-10">
      
      <FeedbackModal isOpen={modalFeedback.isOpen} onClose={() => setModalFeedback({ ...modalFeedback, isOpen: false })} type={modalFeedback.type} title={modalFeedback.title} message={modalFeedback.message} />

      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors mt-0.5"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <MonitorPlay className="w-5 h-5 text-ohel-blue" /> Monitor de Mídia
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Painel de controle rápido para a equipe técnica do culto.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Sincronizando painel de mídia...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* COLUNA 1 */}
          <div className="flex flex-col gap-4 min-w-0">
            <div id="section-visitantes" className="bg-ohel-surface rounded-xl border border-gray-800 p-4 flex flex-col fullscreen-card">
              <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2 gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 whitespace-nowrap truncate">
                  <Users className="w-4 h-4 text-purple-500 shrink-0" /> Visitantes
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="bg-purple-500/10 text-purple-400 text-xs font-bold px-2 py-0.5 rounded-full">{visitantesHoje.length}</span>
                  <button onClick={() => toggleFullScreen('section-visitantes')} className="text-gray-400 hover:text-white transition-colors" title="Expandir para o Telão"><Maximize className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto fullscreen-scroll pr-1">
                {visitantesHoje.length === 0 ? <p className="text-xs text-gray-500 italic">Nenhum visitante.</p> : 
                  visitantesHoje.map(v => (
                    <div key={v.id} className="bg-ohel-bg p-3 rounded-lg border border-gray-800 text-xs fullscreen-text flex justify-between items-center">
                      <span className="text-white font-medium text-sm truncate pr-2">{v.nome}</span>
                      <span className="text-gray-400 whitespace-nowrap">{v.telefone || '-'}</span>
                    </div>
                  ))
                }
                <div className="mt-4 bg-purple-500/10 border border-purple-500/30 p-4 rounded-xl text-center blessing-box">
                  <p className="text-purple-400 font-bold text-sm mb-1 blessing-title flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4 shrink-0" /> Seja bem-vindo!
                  </p>
                  <p className="text-gray-200 text-xs mb-3 blessing-text">Sinta-se em casa e abrace o seu irmão.</p>
                  <p className="text-purple-300 italic text-[11px] blessing-verse">
                    "Portanto, acolham-se uns aos outros..." (Rm 15:7)
                  </p>
                </div>
              </div>
            </div>

            <div id="section-mural" className="bg-ohel-surface rounded-xl border border-gray-800 p-4 flex flex-col fullscreen-card">
              <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2 gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 whitespace-nowrap truncate">
                  <MessageSquare className="w-4 h-4 text-teal-500 shrink-0" /> Avisos
                </h3>
                <button onClick={() => toggleFullScreen('section-mural')} className="text-gray-400 hover:text-white transition-colors shrink-0"><Maximize className="w-4 h-4" /></button>
              </div>
              <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto fullscreen-scroll pr-1">
                {muralRecente.length === 0 ? <p className="text-xs text-gray-500 italic">Nenhum aviso.</p> : 
                  muralRecente.map(m => (
                    <div key={m.id} className="text-xs fullscreen-text bg-ohel-bg p-3 rounded-lg border border-gray-800">
                      <p className="text-white font-bold text-sm mb-1">{m.titulo}</p>
                      <p className="text-gray-400 leading-relaxed truncate">{m.conteudo}</p>
                    </div>
                  ))
                }
                <div className="mt-4 bg-teal-500/10 border border-teal-500/30 p-4 rounded-xl text-center blessing-box">
                  <p className="text-teal-400 font-bold text-sm mb-1 blessing-title flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4 shrink-0" /> Fique por dentro!
                  </p>
                  <p className="text-gray-200 text-xs mb-3 blessing-text">Deus tem feito coisas lindas na casa do Pai.</p>
                  <p className="text-teal-300 italic text-[11px] blessing-verse">
                    "Alegrei-me quando me disseram: Vamos à casa do Senhor." (Salmos 122:1)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA 2 */}
          <div className="flex flex-col gap-4 min-w-0">
            <div id="section-louvores" className="bg-ohel-surface rounded-xl border border-gray-800 p-4 flex flex-col fullscreen-card">
              <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2 gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 whitespace-nowrap truncate">
                  <Music className="w-4 h-4 text-ohel-blue shrink-0" /> Repertório
                </h3>
                
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setIsQrModalOpen(true)} className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-1 rounded hover:bg-purple-500 hover:text-white transition-colors flex items-center gap-1 whitespace-nowrap font-medium">
                    <QrCode className="w-3 h-3 shrink-0" /> <span className="hidden sm:inline">QR</span>
                  </button>
                  <Link href="/monitor-midia/louvores" className="text-[10px] bg-ohel-blue/20 text-ohel-blue px-2 py-1 rounded hover:bg-ohel-blue hover:text-white transition-colors whitespace-nowrap font-medium">
                    + Add
                  </Link>
                  <button onClick={() => window.open(projecaoUrl, '_blank')} className="text-gray-400 hover:text-white transition-colors shrink-0" title="Abrir Projeção">
                    <Maximize className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto fullscreen-scroll pr-1">
                {louvoresHoje.length === 0 ? <p className="text-xs text-gray-500 italic">Nenhum louvor no repertório de hoje.</p> : 
                  louvoresHoje.map((l, index) => {
                    const isPlaying = projecaoAtual.musicaId === l.id;

                    return (
                      <div 
                        key={l.id} 
                        className={`bg-ohel-bg p-3 rounded-lg border flex flex-col gap-2 fullscreen-text group relative transition-all duration-300 ${
                          isPlaying ? "border-ohel-blue shadow-[0_0_15px_rgba(0,123,255,0.2)]" : "border-gray-800"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`font-bold text-lg w-6 shrink-0 ${isPlaying ? "text-ohel-blue" : "text-gray-500"}`}>{index + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`font-bold text-sm truncate ${isPlaying ? "text-ohel-blue" : "text-white"}`}>{l.titulo}</p>
                            <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                              <span className="bg-ohel-surface px-2 py-0.5 rounded border border-gray-700 whitespace-nowrap">Tom: {l.tom || '-'}</span>
                              <span className="truncate">Min: {l.ministro || '-'}</span>
                            </div>
                          </div>
                        </div>
                        
                        {l.palavra_vinculada && (
                          <div className="mt-1 bg-ohel-blue/10 border border-ohel-blue/20 p-2.5 rounded text-ohel-blue text-xs flex items-start gap-2">
                            <BookOpen className="w-4 h-4 mt-0.5 shrink-0" />
                            <span className="leading-relaxed line-clamp-2">{l.palavra_vinculada}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-1 mt-1 pt-2 border-t border-gray-800/50 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/monitor-midia/louvores/editar/${l.id}`} className="p-1.5 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 hover:text-white transition-colors mr-auto" title="Editar Letra / Pot-pourri">
                            <Edit className="w-3.5 h-3.5" />
                          </Link>

                          <button onClick={() => enviarComandoProjecao(l.id, 'Tocando', 0, 0)} className="p-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500 hover:text-white transition-colors" title="Projetar do Início">
                            <MonitorPlay className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => enviarComandoProjecao(l.id, 'Tocando', Math.max(0, projecaoAtual.slide - 1), projecaoAtual.transposicao)} className="p-1.5 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors" title="Slide Anterior">
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => enviarComandoProjecao(l.id, 'Tocando', projecaoAtual.slide + 1, projecaoAtual.transposicao)} className="p-1.5 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors" title="Próximo Slide">
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => enviarComandoProjecao(l.id, 'Tocando', projecaoAtual.slide, projecaoAtual.transposicao - 1)} className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500 hover:text-white transition-colors" title="Descer Tom">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => enviarComandoProjecao(l.id, 'Tocando', projecaoAtual.slide, projecaoAtual.transposicao + 1)} className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500 hover:text-white transition-colors" title="Subir Tom">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setLouvorToDelete(l.id)} className="p-1.5 bg-red-500/10 text-red-500 rounded hover:bg-red-500 hover:text-white transition-colors ml-1" title="Excluir">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                }
                
                <div className="mt-4 bg-ohel-blue/10 border border-ohel-blue/30 p-4 rounded-xl text-center blessing-box">
                  <p className="text-ohel-blue font-bold text-sm mb-1 blessing-title flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4 shrink-0" /> Momento de Adoração
                  </p>
                  <p className="text-gray-200 text-xs mb-3 blessing-text">Adore ao Senhor com todo o seu coração.</p>
                  <p className="text-blue-300 italic text-[11px] blessing-verse">
                    "Cantem ao Senhor um novo cântico; cantem ao Senhor, todos os habitantes da terra!" (Salmos 96:1)
                  </p>
                </div>
              </div>
            </div>

            <div id="section-escala" className="bg-ohel-surface rounded-xl border border-gray-800 p-4 flex flex-col fullscreen-card">
              <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2 gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 whitespace-nowrap truncate">
                  <CalendarDays className="w-4 h-4 text-yellow-500 shrink-0" /> Escala
                </h3>
                <button onClick={() => toggleFullScreen('section-escala')} className="text-gray-400 hover:text-white transition-colors shrink-0"><Maximize className="w-4 h-4" /></button>
              </div>
              <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto fullscreen-scroll pr-1">
                
                {escalasProximas.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Nenhuma escala agendada.</p>
                ) : (
                  escalasProximas.map(escala => (
                    <div key={escala.id} className="bg-ohel-bg p-3 rounded-lg border border-gray-800 text-xs fullscreen-text">
                      <div className="flex items-center gap-2 mb-2 border-b border-gray-800/50 pb-2">
                        <Calendar className="w-3 h-3 text-yellow-500" />
                        <span className="text-white font-bold text-sm">{new Date(`${escala.data_culto}T00:00:00`).toLocaleDateString('pt-BR')}</span>
                        <span className="text-gray-400 truncate">{escala.titulo} {escala.horario_inicio ? `(${escala.horario_inicio})` : ""}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {escala.escalados?.map((esc: any, idx: number) => (
                          <span key={idx} className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 px-2 py-1 rounded text-[10px]">
                            {esc.membros?.nome || 'Membro'} {esc.funcoes_escala?.nome ? `(${esc.funcoes_escala.nome})` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}

                {/* VERIFICAÇÃO DE PERMISSÃO DA ESCALA (BOTÃO) */}
                {podeVerEscala ? (
                  <Link href="/secretaria/escalas" className="bg-yellow-500/10 text-yellow-500 font-bold text-xs px-4 py-3 rounded-lg flex justify-center hover:bg-yellow-500 hover:text-black transition-colors w-full mt-2">
                    Acessar Escala Completa
                  </Link>
                ) : (
                  <button disabled className="bg-gray-800 text-gray-500 font-bold text-xs px-4 py-3 rounded-lg flex justify-center cursor-not-allowed w-full mt-2" title="Você não tem permissão para gerenciar escalas">
                    <Lock className="w-3 h-3 mr-2" /> Gerenciar Escalas (Sem Permissão)
                  </button>
                )}

                <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl text-center blessing-box mt-2">
                  <p className="text-yellow-500 font-bold text-sm mb-1 blessing-title flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4 shrink-0" /> Serviço com Amor
                  </p>
                  <p className="text-gray-200 text-xs mb-3 blessing-text">Sirva ao Senhor com alegria e dedicação.</p>
                  <p className="text-yellow-300 italic text-[11px] blessing-verse">
                    "Sirvam ao Senhor com alegria; apresentem-se diante dele com cânticos de júbilo." (Salmos 100:2)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA 3 */}
          <div className="flex flex-col gap-4 min-w-0">
            <div id="section-oracoes" className="bg-ohel-surface rounded-xl border border-gray-800 p-4 flex flex-col h-full fullscreen-card">
              <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2 gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 whitespace-nowrap truncate">
                  <HeartHandshake className="w-4 h-4 text-red-500 shrink-0" /> Orações
                </h3>
                
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setIsPrayerQrModalOpen(true)} className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-1 rounded hover:bg-purple-500 hover:text-white transition-colors flex items-center gap-1 font-medium" title="QR Code para Membros">
                    <QrCode className="w-3 h-3 shrink-0" />
                  </button>
                  
                  <button 
                    onClick={() => { 
                      if (podeAprovar) setIsApprovalModalOpen(true); 
                      else setModalFeedback({ isOpen: true, type: "error", title: "Acesso Negado", message: "Seu grupo não tem permissão para aprovar orações." });
                    }} 
                    className={`text-[10px] px-2 py-1 rounded transition-colors flex items-center gap-1 font-medium ${podeAprovar ? 'bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`} 
                    title={podeAprovar ? "Aprovar Pedidos" : "Sem permissão"}
                  >
                    <Lock className="w-3 h-3 shrink-0" /> <span className="hidden sm:inline">Aprovar</span>
                    {oracoesPendentes.length > 0 && <span className="bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center ml-1">{oracoesPendentes.length}</span>}
                  </button>
                  
                  <span className="bg-red-500/10 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">{oracoesSemana.length}</span>
                  <button onClick={() => toggleFullScreen('section-oracoes')} className="text-gray-400 hover:text-white transition-colors"><Maximize className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto fullscreen-scroll pr-1">
                {oracoesSemana.length === 0 ? <p className="text-xs text-gray-500 italic">Nenhum pedido aprovado.</p> : 
                  oracoesSemana.map(o => (
                    <div key={o.id} className="bg-ohel-bg p-4 rounded-lg border border-gray-800 text-xs fullscreen-text">
                      <p className="text-red-400 font-bold mb-1 text-sm truncate">{o.nome_solicitante}</p>
                      <p className="text-gray-300 leading-relaxed text-sm line-clamp-3">{o.descricao}</p>
                    </div>
                  ))
                }
                <div className="mt-4 bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-center blessing-box">
                  <p className="text-red-400 font-bold text-sm mb-1 blessing-title flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4 shrink-0" /> Ore pelo seu irmão!
                  </p>
                  <p className="text-gray-200 text-xs mb-3 blessing-text">A oração do justo é poderosa e eficaz.</p>
                  <p className="text-red-300 italic text-[11px] blessing-verse">
                    "Confessem os seus pecados uns aos outros e orem uns pelos outros..." (Tiago 5:16)
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* MODAL: QR CODE DO LOUVOR */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl flex flex-col items-center animate-in zoom-in-95">
            <div className="flex items-center justify-between w-full mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><Music className="w-5 h-5 text-ohel-blue"/> Adicionar Louvor</h3>
              <button onClick={() => setIsQrModalOpen(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-gray-400 text-sm text-center mb-6">Aponte a câmera para abrir a tela de cadastro do louvor.</p>
            <div className="bg-white p-4 rounded-xl mb-6">
              {publicUrl && <QRCode value={publicUrl} size={220} level="H" />}
            </div>
            <div className="w-full bg-ohel-bg border border-gray-800 rounded-lg p-3 text-xs text-gray-400 break-all mb-6 text-center">{publicUrl}</div>
            <div className="flex gap-3 w-full">
              <button onClick={() => setIsQrModalOpen(false)} className="flex-1 px-4 py-3 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-md transition-colors">Fechar</button>
              <button onClick={() => { navigator.clipboard.writeText(publicUrl); setModalFeedback({ isOpen: true, type: "success", title: "Copiado!", message: "Link copiado." }); }} className="flex-1 bg-ohel-blue hover:bg-blue-600 text-white font-medium py-3 rounded-md text-sm transition-colors shadow-lg">Copiar Link</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QR CODE DE ORAÇÃO */}
      {isPrayerQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl flex flex-col items-center animate-in zoom-in-95">
            <div className="flex items-center justify-between w-full mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><HeartHandshake className="w-5 h-5 text-red-500"/> Pedido de Oração</h3>
              <button onClick={() => setIsPrayerQrModalOpen(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-gray-400 text-sm text-center mb-6">Aponte a câmera para enviar um pedido de oração.</p>
            <div className="bg-white p-4 rounded-xl mb-6">
              {prayerUrl && <QRCode value={prayerUrl} size={220} level="H" />}
            </div>
            <div className="w-full bg-ohel-bg border border-gray-800 rounded-lg p-3 text-xs text-gray-400 break-all mb-6 text-center">{prayerUrl}</div>
            <div className="flex gap-3 w-full">
              <button onClick={() => setIsPrayerQrModalOpen(false)} className="flex-1 px-4 py-3 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-md transition-colors">Fechar</button>
              <button onClick={() => { navigator.clipboard.writeText(prayerUrl); setModalFeedback({ isOpen: true, type: "success", title: "Copiado!", message: "Link copiado." }); }} className="flex-1 bg-ohel-blue hover:bg-blue-600 text-white font-medium py-3 rounded-md text-sm transition-colors shadow-lg">Copiar Link</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: APROVAR PEDIDOS */}
      {isApprovalModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><HeartHandshake className="w-5 h-5 text-red-500"/> Aprovar Pedidos de Oração</h3>
              <button onClick={() => setIsApprovalModalOpen(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3">
              {oracoesPendentes.length === 0 ? (
                <p className="text-center text-gray-500 py-10">Nenhum pedido pendente.</p>
              ) : (
                oracoesPendentes.map(o => (
                  <div key={o.id} className="bg-ohel-bg border border-gray-800 p-4 rounded-xl flex items-start justify-between gap-4">
                    <div>
                      <p className="text-white font-bold text-sm mb-1">{o.nome_solicitante}</p>
                      <p className="text-gray-300 text-sm">{o.descricao}</p>
                      <p className="text-[10px] text-gray-500 mt-2">{new Date(o.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => handleRejectPrayer(o.id)} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors" title="Rejeitar">
                        <Trash className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleApprovePrayer(o.id)} className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white rounded-lg transition-colors" title="Aprovar para o Telão">
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-800 flex justify-end">
              <button onClick={() => setIsApprovalModalOpen(false)} className="bg-ohel-blue text-white font-medium py-2 px-6 rounded-md text-sm hover:bg-blue-600">Concluir</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EXCLUSÃO */}
      {louvorToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
              <h3 className="text-lg font-bold text-white">Remover Música</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">Tem certeza que deseja remover esta música do repertório do culto de hoje?</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setLouvorToDelete(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white" disabled={isDeleting}>Cancelar</button>
              <button onClick={confirmDeleteLouvor} className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md text-sm flex items-center gap-2" disabled={isDeleting}>
                {isDeleting ? "Removendo..." : "Sim, remover"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .fullscreen-card:fullscreen {
          background-color: #03060D !important;
          width: 100vw !important;
          height: 100vh !important;
          padding: 4rem !important;
          display: flex !important;
          flex-direction: column !important;
          margin: 0 !important;
          border: none !important;
          border-radius: 0 !important;
        }
        .fullscreen-card:fullscreen .fullscreen-scroll {
          max-height: calc(100vh - 150px) !important;
          overflow-y: auto !important;
          justify-content: center !important;
          gap: 1.5rem !important;
        }
        .fullscreen-card:fullscreen h3 { font-size: 2.5rem !important; margin-bottom: 2rem !important; border-bottom: 2px solid #1f2937 !important; padding-bottom: 1rem !important; justify-content: center !important; }
        .fullscreen-card:fullscreen .fullscreen-text { font-size: 2rem !important; padding: 2rem !important; }
        .fullscreen-card:fullscreen .fullscreen-text p { font-size: 2rem !important; }
        .fullscreen-card:fullscreen .fullscreen-text span { font-size: 2rem !important; }
        .fullscreen-card:fullscreen .blessing-box { padding: 3rem !important; border-radius: 2rem !important; margin-top: 3rem !important; border-width: 2px !important; border-style: solid !important; }
        .fullscreen-card:fullscreen .blessing-title { font-size: 3.5rem !important; margin-bottom: 1.5rem !important; text-shadow: 0 0 20px rgba(255,255,255,0.2) !important; }
        .fullscreen-card:fullscreen .blessing-text { font-size: 2.5rem !important; color: #E5E7EB !important; margin-bottom: 2rem !important; }
        .fullscreen-card:fullscreen .blessing-verse { font-size: 2rem !important; line-height: 1.4 !important; }
        #section-visitantes:fullscreen .blessing-box { background: linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(3, 6, 13, 0.8) 100%) !important; border-color: rgba(168, 85, 247, 0.4) !important; box-shadow: 0 0 50px rgba(168, 85, 247, 0.2) !important; }
        #section-visitantes:fullscreen .blessing-title { color: #c084fc !important; }
        #section-visitantes:fullscreen .blessing-verse { color: #d8b4fe !important; }
        #section-mural:fullscreen .blessing-box { background: linear-gradient(135deg, rgba(20, 184, 166, 0.15) 0%, rgba(3, 6, 13, 0.8) 100%) !important; border-color: rgba(20, 184, 166, 0.4) !important; box-shadow: 0 0 50px rgba(20, 184, 166, 0.2) !important; }
        #section-mural:fullscreen .blessing-title { color: #2dd4bf !important; }
        #section-mural:fullscreen .blessing-verse { color: #99f6e4 !important; }
        #section-louvores:fullscreen .blessing-box { background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(3, 6, 13, 0.8) 100%) !important; border-color: rgba(59, 130, 246, 0.4) !important; box-shadow: 0 0 50px rgba(59, 130, 246, 0.2) !important; }
        #section-louvores:fullscreen .blessing-title { color: #60a5fa !important; }
        #section-louvores:fullscreen .blessing-verse { color: #93c5fd !important; }
        #section-escala:fullscreen .blessing-box { background: linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(3, 6, 13, 0.8) 100%) !important; border-color: rgba(234, 179, 8, 0.4) !important; box-shadow: 0 0 50px rgba(234, 179, 8, 0.2) !important; }
        #section-escala:fullscreen .blessing-title { color: #facc15 !important; }
        #section-escala:fullscreen .blessing-verse { color: #fde047 !important; }
        #section-oracoes:fullscreen .blessing-box { background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(3, 6, 13, 0.8) 100%) !important; border-color: rgba(239, 68, 68, 0.4) !important; box-shadow: 0 0 50px rgba(239, 68, 68, 0.2) !important; }
        #section-oracoes:fullscreen .blessing-title { color: #f87171 !important; }
        #section-oracoes:fullscreen .blessing-verse { color: #fca5a5 !important; }
        .fullscreen-card:fullscreen button, .fullscreen-card:fullscreen a { display: none !important; }
        .fullscreen-card:fullscreen .fullscreen-scroll > div { width: 100% !important; max-width: 1200px !important; margin: 0 auto !important; }
      `}} />

    </div>
  );
}