"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { 
  CalendarDays, Users, ListChecks, Clock, Plus, Trash2, 
  Settings, FolderKanban, X, ArrowRight, UserPlus, CheckCircle2
} from "lucide-react";

export default function EscalasDashboard() {
  const [activeTab, setActiveTab] = useState("mes");
  
  // Estados de Dados
  const [grupos, setGrupos] = useState<any[]>([]);
  const [funcoes, setFuncoes] = useState<any[]>([]);
  const [eventos, setEventos] = useState<any[]>([]);
  const [escalas, setEscalas] = useState<any[]>([]);
  const [membros, setMembros] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  
  // CORREÇÃO AQUI: Adicionado "warning" como um tipo válido
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error" | "warning", title: "", message: "" });
  
  // Estados dos Modais
  const [showNovoGrupo, setShowNovoGrupo] = useState(false);
  const [novoGrupo, setNovoGrupo] = useState({ nome: "", descricao: "" });
  
  const [showNovaFuncao, setShowNovaFuncao] = useState(false);
  const [novaFuncao, setNovaFuncao] = useState({ nome: "", grupo_id: "" });

  const [showNovoEvento, setShowNovoEvento] = useState(false);
  const [novoEvento, setNovoEvento] = useState({ titulo: "", dia_semana: "0", horario_inicio: "19:30", horario_fim: "21:30" });
  const [salvandoEvento, setSalvandoEvento] = useState(false);

  const [showGerarEscalas, setShowGerarEscalas] = useState(false);
  const [mesGeracao, setMesGeracao] = useState(new Date().getMonth() + 1);
  const [anoGeracao, setAnoGeracao] = useState(new Date().getFullYear());

  const [showEscalaAvulsa, setShowEscalaAvulsa] = useState(false);
  const [formEscalaAvulsa, setFormEscalaAvulsa] = useState({ titulo: "", data_culto: "", horario_inicio: "19:30", horario_fim: "21:30" });
  const [escaladosAvulsos, setEscaladosAvulsos] = useState<any[]>([]);
  const [novoEscalado, setNovoEscalado] = useState({ grupo_id: "", funcao_id: "", membro_id: "" });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) {
          setIgrejaId(user.igreja_id);
          fetchData(user.igreja_id);
        }
      }
    };
    init();
  }, []);

  const fetchData = async (id: string) => {
    setLoading(true);
    try {
      const [gruposRes, funcoesRes, eventosRes, escalasRes, membrosRes] = await Promise.all([
        supabase.from('grupos_trabalho').select('*').eq('igreja_id', id).order('nome'),
        supabase.from('funcoes_escala').select('*, grupos_trabalho(nome)').eq('igreja_id', id).order('nome'),
        supabase.from('eventos_regulares').select('*').eq('igreja_id', id).order('dia_semana'),
        supabase.from('escalas').select('*, escalados(*, funcoes_escala(nome), membros(nome))').eq('igreja_id', id).order('data_culto', { ascending: true }),
        supabase.from('membros').select('id, nome').eq('igreja_id', id).order('nome')
      ]);

      const queryErrors = [gruposRes.error, funcoesRes.error, eventosRes.error, escalasRes.error, membrosRes.error].filter(Boolean);
      if (queryErrors.length > 0) throw new Error(queryErrors.map((queryError) => queryError?.message).join("; "));

      setGrupos(gruposRes.data || []);
      setFuncoes(funcoesRes.data || []);
      setEventos(eventosRes.data || []);
      setEscalas(escalasRes.data || []);
      setMembros(membrosRes.data || []);
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Erro ao carregar escalas", message: error instanceof Error ? error.message : "Não foi possível carregar os dados da igreja." });
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLERS DE CRIAÇÃO ---
  const handleCreateGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('grupos_trabalho').insert([{ igreja_id: igrejaId, nome: novoGrupo.nome, descricao: novoGrupo.descricao }]);
      if (error) throw error;
      setShowNovoGrupo(false); setNovoGrupo({ nome: "", descricao: "" }); fetchData(igrejaId!);
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Grupo cadastrado!" });
    } catch (err: any) { setModal({ isOpen: true, type: "error", title: "Erro", message: err.message }); }
  };

  const handleCreateFuncao = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('funcoes_escala').insert([{ igreja_id: igrejaId, nome: novaFuncao.nome, grupo_id: novaFuncao.grupo_id || null }]);
      if (error) throw error;
      setShowNovaFuncao(false); setNovaFuncao({ nome: "", grupo_id: "" }); fetchData(igrejaId!);
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Função cadastrada!" });
    } catch (err: any) { setModal({ isOpen: true, type: "error", title: "Erro", message: err.message }); }
  };

  const handleCreateEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada." });
      return;
    }
    setSalvandoEvento(true);
    try {
      const { error } = await supabase.from('eventos_regulares').insert([{ 
        igreja_id: igrejaId, titulo: novoEvento.titulo, dia_semana: parseInt(novoEvento.dia_semana), 
        horario_inicio: novoEvento.horario_inicio, horario_fim: novoEvento.horario_fim 
      }]);
      if (error) throw error;
      setShowNovoEvento(false);
      setNovoEvento({ titulo: "", dia_semana: "0", horario_inicio: "19:30", horario_fim: "21:30" });
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Evento fixo cadastrado na grade da igreja." });
      await fetchData(igrejaId);
    } catch (err) { setModal({ isOpen: true, type: "error", title: "Erro", message: err instanceof Error ? err.message : "Não foi possível salvar o evento fixo." }); }
    finally { setSalvandoEvento(false); }
  };

  // --- GERAÇÃO AUTOMÁTICA ---
  const handleGerarEscalas = async () => {
    try {
      const diasNoMes = new Date(anoGeracao, mesGeracao, 0).getDate();
      const escalasParaInserir: any[] = [];

      for (let dia = 1; dia <= diasNoMes; dia++) {
        const dataObj = new Date(anoGeracao, mesGeracao - 1, dia);
        const diaSemana = dataObj.getDay();
        
        const eventosDoDia = eventos.filter(e => e.dia_semana === diaSemana);
        
        eventosDoDia.forEach(evento => {
          const dataFormatada = `${anoGeracao}-${String(mesGeracao).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
          const jaExiste = escalas.some(e => e.data_culto === dataFormatada && e.titulo === evento.titulo);
          
          if (!jaExiste) {
            escalasParaInserir.push({
              igreja_id: igrejaId,
              evento_regular_id: evento.id,
              titulo: evento.titulo,
              data_culto: dataFormatada,
              horario_inicio: evento.horario_inicio,
              horario_fim: evento.horario_fim
            });
          }
        });
      }

      if (escalasParaInserir.length === 0) {
        // Agora o TypeScript vai aceitar "warning" porque atualizamos o tipo no estado
        return setModal({ isOpen: true, type: "warning", title: "Aviso", message: "Nenhuma nova escala foi gerada. Elas já existem ou não há eventos regulares para este mês." });
      }

      const { error } = await supabase.from('escalas').insert(escalasParaInserir);
      if (error) throw error;
      
      setShowGerarEscalas(false); fetchData(igrejaId!);
      setModal({ isOpen: true, type: "success", title: "Gerado!", message: `${escalasParaInserir.length} escalas foram criadas com sucesso.` });
    } catch (err: any) { setModal({ isOpen: true, type: "error", title: "Erro", message: err.message }); }
  };

  // --- ESCALA AVULSA ---
  const addEscalado = () => {
    if (!novoEscalado.funcao_id || !novoEscalado.membro_id) return;
    const funcao = funcoes.find(f => f.id === novoEscalado.funcao_id);
    const membro = membros.find(m => m.id === novoEscalado.membro_id);
    setEscaladosAvulsos([...escaladosAvulsos, { funcao_id: novoEscalado.funcao_id, membro_id: novoEscalado.membro_id, funcao_nome: funcao.nome, membro_nome: membro.nome }]);
    setNovoEscalado({ grupo_id: "", funcao_id: "", membro_id: "" });
  };

  const handleSalvarEscalaAvulsa = async () => {
    if (!formEscalaAvulsa.titulo || !formEscalaAvulsa.data_culto) return alert("Preencha título e data.");
    try {
      const { data: novaEscala, error: escalaError } = await supabase.from('escalas').insert([{
        igreja_id: igrejaId, titulo: formEscalaAvulsa.titulo, data_culto: formEscalaAvulsa.data_culto,
        horario_inicio: formEscalaAvulsa.horario_inicio, horario_fim: formEscalaAvulsa.horario_fim
      }]).select().single();
      
      if (escalaError) throw escalaError;

      if (escaladosAvulsos.length > 0) {
        const escaladosFormatados = escaladosAvulsos.map(e => ({ escala_id: novaEscala.id, funcao_id: e.funcao_id, membro_id: e.membro_id }));
        const { error: escaladosError } = await supabase.from('escalados').insert(escaladosFormatados);
        if (escaladosError) throw escaladosError;
      }

      setShowEscalaAvulsa(false); setFormEscalaAvulsa({ titulo: "", data_culto: "", horario_inicio: "19:30", horario_fim: "21:30" }); setEscaladosAvulsos([]);
      fetchData(igrejaId!);
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Escala avulsa criada!" });
    } catch (err: any) { setModal({ isOpen: true, type: "error", title: "Erro", message: err.message }); }
  };

  const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando módulo de escalas...</div>;

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-5 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-ohel-surface border border-gray-800 p-5 rounded-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-ohel-blue flex items-center justify-center shadow-[0_0_15px_rgba(0,123,255,0.4)]">
            <CalendarDays className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Escalas de Serviço</h1>
            <p className="text-gray-400 text-xs mt-0.5">Gestão de Grupos de Trabalho, Eventos e Geração Automática Mensal.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setActiveTab("eventos"); setShowNovoEvento(true); }} className="bg-ohel-bg border border-gray-700 text-gray-300 font-medium py-2 px-4 rounded-md text-xs flex items-center gap-2 hover:text-white transition-colors">
            <Plus className="w-3.5 h-3.5" /> Novo Evento Fixo
          </button>
          <button onClick={() => setShowEscalaAvulsa(true)} className="bg-ohel-bg border border-gray-700 text-gray-300 font-medium py-2 px-4 rounded-md text-xs flex items-center gap-2 hover:text-white transition-colors">
            <Plus className="w-3.5 h-3.5" /> Escala Avulsa
          </button>
          <button onClick={() => setShowGerarEscalas(true)} className="bg-ohel-blue hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(0,123,255,0.3)] transition-all">
            <Settings className="w-3.5 h-3.5" /> Gerar Escalas Mês
          </button>
        </div>
      </div>

      {/* ABAS */}
      <div className="flex border-b border-gray-800 bg-ohel-surface/30 rounded-t-lg overflow-x-auto">
        <button onClick={() => setActiveTab("mes")} className={`flex items-center gap-2 px-5 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "mes" ? "border-ohel-blue text-ohel-blue" : "border-transparent text-gray-400 hover:text-white"}`}>
          <CalendarDays className="w-4 h-4" /> Escalas do Mês ({escalas.length})
        </button>
        <button onClick={() => setActiveTab("grupos")} className={`flex items-center gap-2 px-5 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "grupos" ? "border-ohel-blue text-ohel-blue" : "border-transparent text-gray-400 hover:text-white"}`}>
          <Users className="w-4 h-4" /> Grupos & Atividades ({grupos.length})
        </button>
        <button onClick={() => setActiveTab("funcoes")} className={`flex items-center gap-2 px-5 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "funcoes" ? "border-ohel-blue text-ohel-blue" : "border-transparent text-gray-400 hover:text-white"}`}>
          <ListChecks className="w-4 h-4" /> Tabela de Funções ({funcoes.length})
        </button>
        <button onClick={() => setActiveTab("eventos")} className={`flex items-center gap-2 px-5 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "eventos" ? "border-ohel-blue text-ohel-blue" : "border-transparent text-gray-400 hover:text-white"}`}>
          <Clock className="w-4 h-4" /> Grade Fixa ({eventos.length})
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        
        {/* ABA: ESCALAS DO MÊS */}
        {activeTab === "mes" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {escalas.length === 0 ? (
              <Card className="col-span-3 p-10 text-center text-gray-400 text-sm">Nenhuma escala encontrada. Use "Gerar Escalas Mês" para criar.</Card>
            ) : escalas.map(escala => (
              <Card key={escala.id} className="p-4 border-gray-800 flex flex-col">
                <div className="border-b border-gray-800 pb-2 mb-3">
                  <p className="text-xs text-ohel-blue font-bold uppercase tracking-wider mb-1">{new Date(`${escala.data_culto}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })}</p>
                  <h3 className="text-sm font-bold text-white">{escala.titulo} <span className="text-gray-500 font-normal">({escala.horario_inicio})</span></h3>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  {escala.escalados && escala.escalados.length > 0 ? escala.escalados.map((e: any) => (
                    <div key={e.id} className="flex justify-between items-center text-xs bg-ohel-bg p-2 rounded border border-gray-800">
                      <span className="text-gray-400">{e.funcoes_escala?.nome}</span>
                      <span className="text-white font-medium">{e.membros?.nome || e.nome_manual}</span>
                    </div>
                  )) : <p className="text-xs text-gray-500 italic">Equipe não definida.</p>}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ABA: GRUPOS */}
        {activeTab === "grupos" && (
          <div className="flex flex-col gap-4">
            <Card className="p-4 flex items-center justify-between">
              <div><h2 className="text-sm font-bold text-white">Grupos de Trabalho</h2></div>
              <Button onClick={() => setShowNovoGrupo(true)} className="w-auto px-4 py-2 text-xs bg-ohel-blue text-white"><Plus className="w-3.5 h-3.5 mr-1.5" /> Criar Grupo</Button>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {grupos.map(g => (
                <Card key={g.id} className="p-4 flex justify-between items-center">
                  <div><h3 className="text-sm font-bold text-white">{g.nome}</h3><p className="text-xs text-gray-400">{g.descricao}</p></div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ABA: FUNÇÕES */}
        {activeTab === "funcoes" && (
          <div className="flex flex-col gap-4">
            <Card className="p-4 flex items-center justify-between">
              <div><h2 className="text-sm font-bold text-white">Tabela Auxiliar de Funções</h2></div>
              <Button onClick={() => setShowNovaFuncao(true)} className="w-auto px-4 py-2 text-xs bg-ohel-blue text-white"><Plus className="w-3.5 h-3.5 mr-1.5" /> Nova Função</Button>
            </Card>
            <Card className="p-0 overflow-hidden border-gray-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-ohel-surface border-b border-gray-800 text-gray-400"><tr><th className="p-4">Nome</th><th className="p-4">Grupo Vinculado</th></tr></thead>
                <tbody className="divide-y divide-gray-800/50">
                  {funcoes.map(f => <tr key={f.id}><td className="p-4 text-white">{f.nome}</td><td className="p-4 text-gray-400">{f.grupos_trabalho?.nome || "Global"}</td></tr>)}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* ABA: EVENTOS REGULARES */}
        {activeTab === "eventos" && (
          <div className="flex flex-col gap-4">
            <Card className="p-4 flex items-center justify-between">
              <div><h2 className="text-sm font-bold text-white">Grade fixa da igreja</h2><p className="text-xs text-gray-400">Cadastre cultos e encontros recorrentes; depois gere as escalas do mês a partir desta grade.</p></div>
              <Button onClick={() => setShowNovoEvento(true)} className="w-auto px-4 py-2 text-xs bg-ohel-blue text-white"><Plus className="w-3.5 h-3.5 mr-1.5" /> Criar Evento Regular</Button>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {eventos.map(ev => (
                <Card key={ev.id} className="p-4">
                  <h3 className="text-sm font-bold text-white">{ev.titulo}</h3>
                  <p className="text-xs text-ohel-blue mt-1">{diasSemana[ev.dia_semana]} às {ev.horario_inicio}</p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAIS */}
      {showNovoGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-xl p-5 w-full max-w-md shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-4">Criar Novo Grupo</h3>
            <form onSubmit={handleCreateGrupo} className="flex flex-col gap-4">
              <Input label="Nome *" value={novoGrupo.nome} onChange={e => setNovoGrupo({...novoGrupo, nome: e.target.value})} required className="py-2 text-xs" />
              <Input label="Descrição" value={novoGrupo.descricao} onChange={e => setNovoGrupo({...novoGrupo, descricao: e.target.value})} className="py-2 text-xs" />
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowNovoGrupo(false)} className="text-xs text-gray-400">Cancelar</button><Button type="submit" className="w-auto px-4 py-2 text-xs bg-ohel-blue text-white">Salvar</Button></div>
            </form>
          </div>
        </div>
      )}

      {showNovaFuncao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-xl p-5 w-full max-w-md shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-4">Nova Função</h3>
            <form onSubmit={handleCreateFuncao} className="flex flex-col gap-4">
              <Input label="Nome da Função *" value={novaFuncao.nome} onChange={e => setNovaFuncao({...novaFuncao, nome: e.target.value})} required className="py-2 text-xs" />
              <select value={novaFuncao.grupo_id} onChange={e => setNovaFuncao({...novaFuncao, grupo_id: e.target.value})} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                <option value="">Global (Qualquer Grupo)</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowNovaFuncao(false)} className="text-xs text-gray-400">Cancelar</button><Button type="submit" className="w-auto px-4 py-2 text-xs bg-ohel-blue text-white">Salvar</Button></div>
            </form>
          </div>
        </div>
      )}

      {showNovoEvento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-xl p-5 w-full max-w-md shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-4">Novo Evento Regular</h3>
            <form onSubmit={handleCreateEvento} className="flex flex-col gap-4">
              <Input label="Título do Evento *" placeholder="Ex: Culto de Domingo à Noite" value={novoEvento.titulo} onChange={e => setNovoEvento({...novoEvento, titulo: e.target.value})} required className="py-2 text-xs" />
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase text-gray-400">Dia da Semana</label>
                  <select value={novoEvento.dia_semana} onChange={e => setNovoEvento({...novoEvento, dia_semana: e.target.value})} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                    {diasSemana.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <Input label="Horário Início" type="time" value={novoEvento.horario_inicio} onChange={e => setNovoEvento({...novoEvento, horario_inicio: e.target.value})} className="py-2 text-xs" />
              </div>
              <div className="flex justify-end gap-2 mt-2"><button type="button" onClick={() => setShowNovoEvento(false)} className="text-xs text-gray-400">Cancelar</button><Button type="submit" disabled={salvandoEvento} className="w-auto px-4 py-2 text-xs bg-ohel-blue text-white">{salvandoEvento ? "Salvando..." : "Salvar Evento Fixo"}</Button></div>
            </form>
          </div>
        </div>
      )}

      {showGerarEscalas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl text-center">
            <div className="w-12 h-12 bg-ohel-blue/10 rounded-full flex items-center justify-center mx-auto mb-4"><Settings className="w-6 h-6 text-ohel-blue"/></div>
            <h3 className="text-lg font-bold text-white mb-2">Gerar Escalas Automáticas</h3>
            <p className="text-xs text-gray-400 mb-6">Isso criará escalas para todos os Eventos Regulares do mês selecionado. Escalas já existentes não serão duplicadas.</p>
            <div className="flex gap-3 mb-6">
              <select value={mesGeracao} onChange={e => setMesGeracao(Number(e.target.value))} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                {Array.from({ length: 12 }, (_, i) => (<option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}</option>))}
              </select>
              <Input type="number" value={anoGeracao} onChange={e => setAnoGeracao(Number(e.target.value))} className="py-2 text-xs" />
            </div>
            <div className="flex justify-center gap-3">
              <button onClick={() => setShowGerarEscalas(false)} className="px-4 py-2 text-xs text-gray-400">Cancelar</button>
              <Button onClick={handleGerarEscalas} className="w-auto px-6 py-2 text-xs bg-ohel-blue text-white">Confirmar e Gerar</Button>
            </div>
          </div>
        </div>
      )}

      {showEscalaAvulsa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-ohel-surface border border-gray-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <div><h3 className="text-lg font-bold text-white">Criar Escala Avulsa</h3><p className="text-xs text-gray-400">Escala extraordinária ou de evento único.</p></div>
              <button onClick={() => setShowEscalaAvulsa(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="md:col-span-3"><Input label="Título do Evento *" placeholder="Ex: Culto Especial de Ações de Graças" value={formEscalaAvulsa.titulo} onChange={e => setFormEscalaAvulsa({...formEscalaAvulsa, titulo: e.target.value})} required className="py-2 text-xs" /></div>
              <Input label="Data *" type="date" value={formEscalaAvulsa.data_culto} onChange={e => setFormEscalaAvulsa({...formEscalaAvulsa, data_culto: e.target.value})} required className="py-2 text-xs" />
              <Input label="Horário Início" type="time" value={formEscalaAvulsa.horario_inicio} onChange={e => setFormEscalaAvulsa({...formEscalaAvulsa, horario_inicio: e.target.value})} className="py-2 text-xs" />
              <Input label="Horário Fim" type="time" value={formEscalaAvulsa.horario_fim} onChange={e => setFormEscalaAvulsa({...formEscalaAvulsa, horario_fim: e.target.value})} className="py-2 text-xs" />
            </div>

            <div className="bg-ohel-bg border border-gray-800 rounded-xl p-4 mb-6">
              <h4 className="text-xs font-bold text-ohel-blue uppercase tracking-wider mb-3 flex items-center gap-2"><UserPlus className="w-3.5 h-3.5"/> Adicionar Escalado</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <select value={novoEscalado.grupo_id} onChange={e => setNovoEscalado({...novoEscalado, grupo_id: e.target.value, funcao_id: ""})} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                  <option value="">Grupo de Trabalho...</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
                <select value={novoEscalado.funcao_id} onChange={e => setNovoEscalado({...novoEscalado, funcao_id: e.target.value})} className="input-ohel w-full px-3 py-2 rounded-md text-xs" disabled={!novoEscalado.grupo_id}>
                  <option value="">Função...</option>
                  {funcoes.filter(f => f.grupo_id === novoEscalado.grupo_id || (!f.grupo_id && novoEscalado.grupo_id)).map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
                <select value={novoEscalado.membro_id} onChange={e => setNovoEscalado({...novoEscalado, membro_id: e.target.value})} className="input-ohel w-full px-3 py-2 rounded-md text-xs" disabled={!novoEscalado.funcao_id}>
                  <option value="">Buscar membro...</option>
                  {membros.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <Button onClick={addEscalado} className="w-full py-2 text-xs bg-ohel-blue/20 text-ohel-blue hover:bg-ohel-blue hover:text-white transition-colors border border-ohel-blue/30">
                <Plus className="w-3.5 h-3.5 mr-1"/> Adicionar Participante à Lista
              </Button>

              <div className="mt-4 flex flex-col gap-2">
                {escaladosAvulsos.map((e, i) => (
                  <div key={i} className="flex justify-between items-center bg-ohel-surface p-2 rounded border border-gray-800 text-xs">
                    <span className="text-gray-400">{e.funcao_nome}</span>
                    <span className="text-white font-medium">{e.membro_nome}</span>
                    <button onClick={() => setEscaladosAvulsos(escaladosAvulsos.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowEscalaAvulsa(false)} className="px-4 py-2 text-xs text-gray-400">Cancelar</button>
              <Button onClick={handleSalvarEscalaAvulsa} className="w-auto px-6 py-2 text-xs bg-ohel-blue text-white"><CheckCircle2 className="w-3.5 h-3.5 mr-2"/> Salvar Escala Avulsa</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}