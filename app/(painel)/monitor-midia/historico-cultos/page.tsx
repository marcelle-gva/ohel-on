"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAccess } from "@/components/layout/AccessShell";
import { podeAcessar } from "@/lib/access";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { AgendaAnualCard } from "@/components/cultos/AgendaAnualCard";
import {
  anoAtualAgenda,
  DIAS_SEMANA,
  intervaloValido,
  type CultoModelo,
  type ProgramacaoCultoAnual,
  type ProgramacaoCultoAnualForm,
  type ProgramacaoCultoForm,
  type TipoCulto,
} from "@/lib/programacao-cultos";
import { ArrowLeft, BookOpen, CalendarDays, Check, Edit3, ExternalLink, History, Loader2, Play, Search, Square, Pencil, X } from "lucide-react";

interface CultoSessao {
  id: string;
  titulo: string;
  tipo: string;
  inicio_em: string;
  fim_em: string | null;
  status: "aberto" | "encerrado";
  link_ao_vivo: string | null;
  dirigente: string | null;
  observacoes: string | null;
}

interface CultoRegistro {
  id: string;
  tipo: string;
  origem_tabela: string | null;
  titulo: string | null;
  resumo: string | null;
  criado_em: string;
}

const nomeTipo = (tipo: string) => ({ louvor: "Louvor", oracao: "Oração", checkin: "Check-in", visitante: "Visitante", visita: "Visita", sermao: "Palavra / Sermão", projecao: "Projeção" }[tipo] || tipo);
const formularioProgramacaoVazio = (tipo = "Culto de Domingo"): ProgramacaoCultoForm => ({ nome: "", tipo, dia_semana: "0", horario_inicio: "09:00", horario_fim: "11:00" });

export default function HistoricoCultosPage() {
  const contexto = useAccess();
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [sessoes, setSessoes] = useState<CultoSessao[]>([]);
  const [programacao, setProgramacao] = useState<CultoModelo[]>([]);
  const [programacoesAnuais, setProgramacoesAnuais] = useState<ProgramacaoCultoAnual[]>([]);
  const [tiposCulto, setTiposCulto] = useState<TipoCulto[]>([]);
  const [novoTipoCulto, setNovoTipoCulto] = useState("");
  const [tipoEditandoId, setTipoEditandoId] = useState<string | null>(null);
  const [nomeTipoEditado, setNomeTipoEditado] = useState("");
  const [sessaoSelecionada, setSessaoSelecionada] = useState<CultoSessao | null>(null);
  const [registros, setRegistros] = useState<CultoRegistro[]>([]);
  const [busca, setBusca] = useState("");
  const [anoAgenda, setAnoAgenda] = useState(anoAtualAgenda);
  const [loading, setLoading] = useState(true);
  const [loadingRegistros, setLoadingRegistros] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingProgramacao, setSavingProgramacao] = useState(false);
  const [savingAgenda, setSavingAgenda] = useState(false);
  const [podeGerirProgramacao, setPodeGerirProgramacao] = useState(false);
  const [modeloEditandoId, setModeloEditandoId] = useState<string | null>(null);
  const [formEdicaoModelo, setFormEdicaoModelo] = useState<ProgramacaoCultoForm | null>(null);
  const [form, setForm] = useState({ titulo: "Culto de Domingo", tipo: "Culto de Domingo", dirigente: "", link_ao_vivo: "", observacoes: "" });
  const [formProgramacao, setFormProgramacao] = useState<ProgramacaoCultoForm>(formularioProgramacaoVazio());
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const podeRevisarCultoLar = Boolean(contexto && podeAcessar(contexto, "mural", "ler"));

  const carregarSessoes = async (id: string) => {
    const { data, error } = await supabase.from("culto_sessoes").select("id, titulo, tipo, inicio_em, fim_em, status, dirigente, link_ao_vivo, observacoes").eq("igreja_id", id).order("inicio_em", { ascending: false });
    if (error) throw error;
    const lista = (data || []) as CultoSessao[];
    setSessoes(lista);
    const aberta = lista.find((sessao) => sessao.status === "aberto");
    if (aberta) setSessaoSelecionada((atual) => atual?.id === aberta.id ? atual : aberta);
  };

  const carregarProgramacao = async (id: string) => {
    const { data, error } = await supabase.from("culto_modelos").select("id, nome, tipo, dia_semana, horario_inicio, horario_fim, ativo, vigencia_desde").eq("igreja_id", id).order("dia_semana").order("horario_inicio");
    if (error) throw error;
    setProgramacao((data || []) as CultoModelo[]);
  };

  const carregarProgramacoesAnuais = async (id: string, ano = anoAgenda) => {
    const anoNumerico = Number(ano);
    if (!Number.isInteger(anoNumerico) || anoNumerico < 2000 || anoNumerico > 2100) {
      setProgramacoesAnuais([]);
      return;
    }
    const { data, error } = await supabase.from("programacoes_cultos_anuais").select("id, ano, data_culto, titulo, tipo, horario_inicio, horario_fim, observacoes, ativo, created_at, updated_at").eq("igreja_id", id).eq("ano", anoNumerico).order("data_culto").order("horario_inicio");
    if (error) throw error;
    setProgramacoesAnuais((data || []) as ProgramacaoCultoAnual[]);
  };

  const mudarAnoAgenda = (ano: string) => {
    setAnoAgenda(ano);
    if (igrejaId) {
      void carregarProgramacoesAnuais(igrejaId, ano).catch((error) => setModal({ isOpen: true, type: "error", title: "Não foi possível carregar a agenda anual", message: error instanceof Error ? error.message : "Verifique a migration da agenda anual." }));
    }
  };

  const carregarTiposCulto = async (id: string) => {
    const { data, error } = await supabase.from("culto_tipos").select("id, nome, ativo").eq("igreja_id", id).order("nome");
    if (error) throw error;
    setTiposCulto((data || []) as TipoCulto[]);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: user } = await supabase.from("usuarios").select("igreja_id, role").eq("id", session.user.id).maybeSingle();
        if (!user?.igreja_id) return;
        setIgrejaId(user.igreja_id);
        setPodeGerirProgramacao(user.role === "admin");
        const { error: syncError } = await supabase.rpc("materializar_sessoes_culto", { p_igreja_id: user.igreja_id });
        if (syncError) throw syncError;
        const carregarAgendaInicial = async () => {
          const { data, error } = await supabase.from("programacoes_cultos_anuais").select("id, ano, data_culto, titulo, tipo, horario_inicio, horario_fim, observacoes, ativo, created_at, updated_at").eq("igreja_id", user.igreja_id).eq("ano", Number(anoAtualAgenda())).order("data_culto").order("horario_inicio");
          if (error) throw error;
          setProgramacoesAnuais((data || []) as ProgramacaoCultoAnual[]);
        };
        await Promise.all([carregarSessoes(user.igreja_id), carregarProgramacao(user.igreja_id), carregarTiposCulto(user.igreja_id), carregarAgendaInicial()]);
      } catch (error) {
        setModal({ isOpen: true, type: "error", title: "Não foi possível carregar", message: error instanceof Error ? error.message : "Execute as migrations do histórico e da programação de cultos." });
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, []);

  useEffect(() => {
    const carregarRegistros = async () => {
      if (!sessaoSelecionada) { setRegistros([]); return; }
      setLoadingRegistros(true);
      const { data } = await supabase.from("culto_registros").select("id, tipo, origem_tabela, titulo, resumo, criado_em").eq("culto_id", sessaoSelecionada.id).order("criado_em", { ascending: true });
      setRegistros((data || []) as CultoRegistro[]);
      setLoadingRegistros(false);
    };
    void carregarRegistros();
  }, [sessaoSelecionada]);

  const sessoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return sessoes;
    return sessoes.filter((sessao) => `${sessao.titulo} ${sessao.tipo} ${sessao.link_ao_vivo || ""}`.toLowerCase().includes(termo));
  }, [busca, sessoes]);

  const salvarNovoTipoCulto = async (event: FormEvent) => {
    event.preventDefault();
    const nome = novoTipoCulto.trim();
    if (!igrejaId || !podeGerirProgramacao || !nome) return;
    setSavingProgramacao(true);
    try {
      const { error } = await supabase.from("culto_tipos").insert({ igreja_id: igrejaId, nome });
      if (error) {
        if (error.code === "23505") throw new Error("Esse tipo já existe. Escolha outro nome.");
        throw error;
      }
      await carregarTiposCulto(igrejaId);
      setNovoTipoCulto("");
      setModal({ isOpen: true, type: "success", title: "Tipo adicionado", message: "O novo tipo já está disponível para programações e cultos avulsos." });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível adicionar", message: error instanceof Error ? error.message : "Verifique o nome e tente novamente." });
    } finally {
      setSavingProgramacao(false);
    }
  };

  const salvarEdicaoTipoCulto = async (tipo: TipoCulto, nomeRecebido: string, ativo = tipo.ativo) => {
    if (!igrejaId || !podeGerirProgramacao) return;
    const nome = nomeRecebido.trim();
    setSavingProgramacao(true);
    try {
      const { error } = await supabase.rpc("editar_tipo_culto", { p_tipo_id: tipo.id, p_nome: nome, p_ativo: ativo });
      if (error) {
        if (error.code === "23505") throw new Error("Já existe um tipo de culto com esse nome.");
        throw error;
      }
      if (nome !== tipo.nome) {
        setForm((atual) => ({ ...atual, tipo: atual.tipo === tipo.nome ? nome : atual.tipo, titulo: atual.tipo === tipo.nome && atual.titulo === tipo.nome ? nome : atual.titulo }));
        setFormProgramacao((atual) => ({ ...atual, tipo: atual.tipo === tipo.nome ? nome : atual.tipo }));
      }
      await Promise.all([carregarTiposCulto(igrejaId), carregarProgramacao(igrejaId), carregarSessoes(igrejaId), carregarProgramacoesAnuais(igrejaId)]);
      setTipoEditandoId(null);
      setModal({ isOpen: true, type: "success", title: nome !== tipo.nome ? "Tipo atualizado" : ativo ? "Tipo reativado" : "Tipo desativado", message: nome !== tipo.nome ? "O nome foi atualizado nas programações, na agenda anual e nas sessões existentes." : "O tipo foi atualizado. As programações e o histórico são preservados." });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível atualizar", message: error instanceof Error ? error.message : "Verifique o nome e as permissões." });
    } finally {
      setSavingProgramacao(false);
    }
  };

  const salvarProgramacao = async (event: FormEvent) => {
    event.preventDefault();
    if (!igrejaId || !podeGerirProgramacao || !formProgramacao.nome.trim()) return;
    if (!intervaloValido(formProgramacao.horario_inicio, formProgramacao.horario_fim)) {
      setModal({ isOpen: true, type: "error", title: "Horário inválido", message: "O horário de encerramento deve ser depois do horário de início." });
      return;
    }
    setSavingProgramacao(true);
    try {
      const { error } = await supabase.rpc("criar_programacao_culto", { p_igreja_id: igrejaId, p_nome: formProgramacao.nome.trim(), p_tipo: formProgramacao.tipo, p_dia_semana: Number(formProgramacao.dia_semana), p_horario_inicio: formProgramacao.horario_inicio, p_horario_fim: formProgramacao.horario_fim });
      if (error) {
        if (error.code === "23505") throw new Error("Já existe uma programação ativa nesse dia com horário igual ou sobreposto. Altere o intervalo ou pause a programação duplicada.");
        throw error;
      }
      const { error: syncError } = await supabase.rpc("materializar_sessoes_culto", { p_igreja_id: igrejaId });
      if (syncError) throw syncError;
      const tipoInicial = tiposCulto.find((tipo) => tipo.ativo)?.nome || "Culto de Domingo";
      setFormProgramacao(formularioProgramacaoVazio(tipoInicial));
      await Promise.all([carregarSessoes(igrejaId), carregarProgramacao(igrejaId)]);
      setModal({ isOpen: true, type: "success", title: "Programação cadastrada", message: "O culto será aberto automaticamente no horário definido e encerrado ao fim; as ocorrências ficam no histórico existente." });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível salvar", message: error instanceof Error ? error.message : "Verifique os dados e as permissões da igreja." });
    } finally {
      setSavingProgramacao(false);
    }
  };

  const iniciarEdicaoModelo = (modelo: CultoModelo) => {
    setModeloEditandoId(modelo.id);
    setFormEdicaoModelo({ nome: modelo.nome, tipo: modelo.tipo, dia_semana: String(modelo.dia_semana), horario_inicio: modelo.horario_inicio.slice(0, 5), horario_fim: modelo.horario_fim.slice(0, 5) });
  };

  const cancelarEdicaoModelo = () => {
    setModeloEditandoId(null);
    setFormEdicaoModelo(null);
  };

  const salvarEdicaoModelo = async (event: FormEvent) => {
    event.preventDefault();
    if (!igrejaId || !podeGerirProgramacao || !modeloEditandoId || !formEdicaoModelo) return;
    if (!formEdicaoModelo.nome.trim()) {
      setModal({ isOpen: true, type: "error", title: "Nome obrigatório", message: "Informe o nome da programação fixa." });
      return;
    }
    if (!intervaloValido(formEdicaoModelo.horario_inicio, formEdicaoModelo.horario_fim)) {
      setModal({ isOpen: true, type: "error", title: "Horário inválido", message: "O horário de encerramento deve ser depois do horário de início." });
      return;
    }
    setSavingProgramacao(true);
    try {
      const { error } = await supabase.rpc("editar_programacao_culto", { p_modelo_id: modeloEditandoId, p_igreja_id: igrejaId, p_nome: formEdicaoModelo.nome.trim(), p_tipo: formEdicaoModelo.tipo, p_dia_semana: Number(formEdicaoModelo.dia_semana), p_horario_inicio: formEdicaoModelo.horario_inicio, p_horario_fim: formEdicaoModelo.horario_fim });
      if (error) {
        if (error.code === "23505") throw new Error("Já existe um culto ativo com horário sobreposto nesse dia. Escolha outro intervalo ou pause o conflito.");
        throw error;
      }
      cancelarEdicaoModelo();
      await Promise.all([carregarSessoes(igrejaId), carregarProgramacao(igrejaId)]);
      setModal({ isOpen: true, type: "success", title: "Programação atualizada", message: "A alteração vale para as próximas ocorrências. Diários anteriores e a sessão em andamento foram preservados." });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível editar", message: error instanceof Error ? error.message : "Verifique os dados, o conflito de horário e as permissões." });
    } finally {
      setSavingProgramacao(false);
    }
  };

  const alternarProgramacao = async (modelo: CultoModelo) => {
    if (!podeGerirProgramacao) return;
    setSavingProgramacao(true);
    try {
      const { error } = await supabase.rpc("alternar_programacao_culto", { p_modelo_id: modelo.id, p_ativo: !modelo.ativo });
      if (error) {
        if (error.code === "23505") throw new Error("Outro culto já usa esse dia e horário. Altere ou pause a programação antes de reativar.");
        throw error;
      }
      if (igrejaId) {
        const { error: syncError } = await supabase.rpc("materializar_sessoes_culto", { p_igreja_id: igrejaId });
        if (syncError) throw syncError;
        await Promise.all([carregarSessoes(igrejaId), carregarProgramacao(igrejaId)]);
      }
      setModal({ isOpen: true, type: "success", title: modelo.ativo ? "Programação desativada" : "Programação reativada", message: modelo.ativo ? "Nenhuma nova sessão será criada para esse horário. O histórico anterior foi preservado." : "Novas ocorrências começam a partir de agora; o período desativado não será preenchido retroativamente." });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível atualizar", message: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setSavingProgramacao(false);
    }
  };

  const validarAgendaAnual = (formulario: ProgramacaoCultoAnualForm) => {
    const anoData = Number(formulario.data_culto.slice(0, 4));
    if (!formulario.data_culto || !Number.isInteger(anoData) || anoData < 2000 || anoData > 2100) throw new Error("Informe uma data anual válida.");
    if (!intervaloValido(formulario.horario_inicio, formulario.horario_fim)) throw new Error("O horário de encerramento deve ser depois do horário de início.");
  };

  const criarAgendaAnual = async (formulario: ProgramacaoCultoAnualForm) => {
    if (!igrejaId || !podeGerirProgramacao) return;
    setSavingAgenda(true);
    try {
      validarAgendaAnual(formulario);
      const { error } = await supabase.rpc("criar_programacao_culto_anual", { p_igreja_id: igrejaId, p_data_culto: formulario.data_culto, p_titulo: formulario.titulo.trim(), p_tipo: formulario.tipo, p_horario_inicio: formulario.horario_inicio, p_horario_fim: formulario.horario_fim, p_observacoes: formulario.observacoes.trim() || null });
      if (error) {
        if (error.code === "23505") throw new Error("Já existe uma data anual ativa com horário sobreposto. Escolha outro horário ou cancele a data conflitante.");
        throw error;
      }
      setAnoAgenda(formulario.data_culto.slice(0, 4));
      await carregarProgramacoesAnuais(igrejaId, formulario.data_culto.slice(0, 4));
      setModal({ isOpen: true, type: "success", title: "Data adicionada à agenda", message: "A data foi planejada separadamente da programação fixa e não abrirá uma sessão automaticamente." });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível adicionar à agenda", message: error instanceof Error ? error.message : "Verifique a data, o horário e as permissões." });
      throw error instanceof Error ? error : new Error("Verifique a data, o horário e as permissões.");
    } finally {
      setSavingAgenda(false);
    }
  };

  const editarAgendaAnual = async (id: string, formulario: ProgramacaoCultoAnualForm) => {
    if (!podeGerirProgramacao) return;
    setSavingAgenda(true);
    try {
      validarAgendaAnual(formulario);
      const { error } = await supabase.rpc("editar_programacao_culto_anual", { p_programacao_id: id, p_data_culto: formulario.data_culto, p_titulo: formulario.titulo.trim(), p_tipo: formulario.tipo, p_horario_inicio: formulario.horario_inicio, p_horario_fim: formulario.horario_fim, p_observacoes: formulario.observacoes.trim() || null });
      if (error) {
        if (error.code === "23505") throw new Error("Já existe uma data anual ativa com horário sobreposto.");
        throw error;
      }
      setAnoAgenda(formulario.data_culto.slice(0, 4));
      if (igrejaId) await carregarProgramacoesAnuais(igrejaId, formulario.data_culto.slice(0, 4));
      setModal({ isOpen: true, type: "success", title: "Agenda anual atualizada", message: "A data planejada foi atualizada sem criar ou alterar uma sessão de culto." });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível editar a agenda", message: error instanceof Error ? error.message : "Verifique os dados e o conflito de horário." });
      throw error;
    } finally {
      setSavingAgenda(false);
    }
  };

  const alternarAgendaAnual = async (item: ProgramacaoCultoAnual) => {
    if (!podeGerirProgramacao) return;
    setSavingAgenda(true);
    try {
      const { error } = await supabase.rpc("alternar_programacao_culto_anual", { p_programacao_id: item.id, p_ativo: !item.ativo });
      if (error) {
        if (error.code === "23505") throw new Error("Outra data anual ativa tem horário sobreposto.");
        throw error;
      }
      if (igrejaId) await carregarProgramacoesAnuais(igrejaId);
      setModal({ isOpen: true, type: "success", title: item.ativo ? "Data cancelada" : "Data reativada", message: item.ativo ? "A data foi retirada da agenda ativa sem apagar o planejamento." : "A data voltou à agenda anual ativa." });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível atualizar a data", message: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setSavingAgenda(false);
    }
  };

  const iniciarCulto = async (event: FormEvent) => {
    event.preventDefault();
    if (!igrejaId || !form.titulo.trim()) return;
    setSaving(true);
    try {
      const { data: cultoAberto, error: abertoError } = await supabase.from("culto_sessoes").select("id, titulo, tipo, inicio_em, fim_em, status, dirigente, link_ao_vivo, observacoes").eq("igreja_id", igrejaId).eq("status", "aberto").order("inicio_em", { ascending: false }).limit(1).maybeSingle();
      if (abertoError) throw abertoError;
      if (cultoAberto) {
        setSessaoSelecionada(cultoAberto as CultoSessao);
        setModal({ isOpen: true, type: "success", title: "Culto já aberto", message: "A sessão aberta pela programação foi selecionada; não foi criado um diário duplicado." });
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.from("culto_sessoes").insert({ igreja_id: igrejaId, titulo: form.titulo.trim(), tipo: form.tipo, dirigente: form.dirigente.trim() || null, link_ao_vivo: form.link_ao_vivo.trim() || null, observacoes: form.observacoes.trim() || null, status: "aberto", created_by: session?.user.id || null }).select("id, titulo, tipo, inicio_em, fim_em, status, dirigente, link_ao_vivo, observacoes").single();
      if (error) {
        if (error.code === "23505") throw new Error("Já existe um culto aberto ou uma ocorrência registrada para esse mesmo horário. Atualize a lista antes de tentar novamente.");
        throw error;
      }
      await carregarSessoes(igrejaId);
      setSessaoSelecionada(data as CultoSessao);
      setModal({ isOpen: true, type: "success", title: "Culto iniciado", message: "Os próximos envios do QR Code e ações do Monitor serão registrados nesta sessão." });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível iniciar", message: error instanceof Error ? error.message : "Verifique a migration e as permissões." });
    } finally {
      setSaving(false);
    }
  };

  const encerrarCulto = async () => {
    if (!sessaoSelecionada || !igrejaId) return;
    setSaving(true);
    try {
      const fim = new Date().toISOString();
      const { error } = await supabase.from("culto_sessoes").update({ status: "encerrado", fim_em: fim }).eq("id", sessaoSelecionada.id).eq("igreja_id", igrejaId);
      if (error) throw error;
      setSessaoSelecionada({ ...sessaoSelecionada, status: "encerrado", fim_em: fim });
      await carregarSessoes(igrejaId);
      setModal({ isOpen: true, type: "success", title: "Culto encerrado", message: "O diário foi fechado e continua disponível para consulta." });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível encerrar", message: error instanceof Error ? error.message : "Tente novamente." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando histórico...</div>;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/monitor-midia" className="mt-1 text-gray-400 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><History className="h-6 w-6 text-ohel-blue" /> Histórico de Cultos</h1>
            <p className="mt-1 text-sm text-gray-400">Busque uma celebração, planeje datas especiais e reveja tudo que foi registrado durante ela.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {podeRevisarCultoLar && <Link href="/secretaria/mural/culto-no-lar" className="text-ohel-blue hover:text-white">Culto no Lar · revisar envios</Link>}
          <Link href="/monitor-midia" className="text-ohel-blue hover:text-white">Voltar ao Monitor</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5">
          <Card className="border-gray-800 p-5">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-white"><CalendarDays className="h-4 w-4 text-ohel-blue" /> Programação fixa da igreja</h2>
            <p className="mb-4 text-[10px] leading-5 text-gray-400">Cadastre e edite os cultos semanais. Alterar uma programação vale para as próximas ocorrências; os diários anteriores e uma sessão em andamento são preservados.</p>
            {podeGerirProgramacao && (
              <form onSubmit={salvarProgramacao} className="flex flex-col gap-3 border-b border-gray-800 pb-4">
                <Input label="Nome do culto *" placeholder="Ex.: Culto da Família" value={formProgramacao.nome} onChange={(event) => setFormProgramacao({ ...formProgramacao, nome: event.target.value })} maxLength={120} required />
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-[10px] font-semibold text-gray-400">Tipo
                    <select value={formProgramacao.tipo} onChange={(event) => setFormProgramacao({ ...formProgramacao, tipo: event.target.value })} className="input-ohel w-full rounded-md px-3 py-2 text-xs">{tiposCulto.filter((tipo) => tipo.ativo).map((tipo) => <option key={tipo.id} value={tipo.nome}>{tipo.nome}</option>)}</select>
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] font-semibold text-gray-400">Dia da semana
                    <select value={formProgramacao.dia_semana} onChange={(event) => setFormProgramacao({ ...formProgramacao, dia_semana: event.target.value })} className="input-ohel w-full rounded-md px-3 py-2 text-xs">{DIAS_SEMANA.map((dia, index) => <option key={dia} value={index}>{dia}</option>)}</select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2"><Input label="Início *" type="time" value={formProgramacao.horario_inicio} onChange={(event) => setFormProgramacao({ ...formProgramacao, horario_inicio: event.target.value })} required /><Input label="Fim *" type="time" value={formProgramacao.horario_fim} onChange={(event) => setFormProgramacao({ ...formProgramacao, horario_fim: event.target.value })} required /></div>
                <Button type="submit" disabled={savingProgramacao}>{savingProgramacao ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Adicionar à programação"}</Button>
              </form>
            )}
            <div className="mt-3 flex flex-col gap-2">
              {programacao.length === 0 ? <p className="py-2 text-[10px] text-gray-500">Nenhum horário fixo cadastrado.</p> : programacao.map((modelo) => (
                <div key={modelo.id} className="rounded-lg border border-gray-800 bg-ohel-bg p-3">
                  {modeloEditandoId === modelo.id && formEdicaoModelo ? (
                    <form onSubmit={salvarEdicaoModelo} className="flex flex-col gap-3">
                      <Input label="Nome do culto *" value={formEdicaoModelo.nome} onChange={(event) => setFormEdicaoModelo({ ...formEdicaoModelo, nome: event.target.value })} maxLength={120} required />
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1 text-[10px] font-semibold text-gray-400">Tipo
                          <select value={formEdicaoModelo.tipo} onChange={(event) => setFormEdicaoModelo({ ...formEdicaoModelo, tipo: event.target.value })} className="input-ohel w-full rounded-md px-3 py-2 text-xs">{tiposCulto.map((tipo) => <option key={tipo.id} value={tipo.nome} disabled={!tipo.ativo && tipo.nome !== formEdicaoModelo.tipo}>{tipo.nome}{!tipo.ativo ? " (inativo)" : ""}</option>)}</select>
                        </label>
                        <label className="flex flex-col gap-1 text-[10px] font-semibold text-gray-400">Dia da semana
                          <select value={formEdicaoModelo.dia_semana} onChange={(event) => setFormEdicaoModelo({ ...formEdicaoModelo, dia_semana: event.target.value })} className="input-ohel w-full rounded-md px-3 py-2 text-xs">{DIAS_SEMANA.map((dia, index) => <option key={dia} value={index}>{dia}</option>)}</select>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2"><Input label="Início *" type="time" value={formEdicaoModelo.horario_inicio} onChange={(event) => setFormEdicaoModelo({ ...formEdicaoModelo, horario_inicio: event.target.value })} required /><Input label="Fim *" type="time" value={formEdicaoModelo.horario_fim} onChange={(event) => setFormEdicaoModelo({ ...formEdicaoModelo, horario_fim: event.target.value })} required /></div>
                      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={cancelarEdicaoModelo} disabled={savingProgramacao}><X className="h-4 w-4" /> Cancelar</Button><Button type="submit" disabled={savingProgramacao}>{savingProgramacao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar</Button></div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{modelo.nome}</p><p className="mt-1 text-[10px] text-gray-400">{DIAS_SEMANA[modelo.dia_semana]} · {modelo.horario_inicio.slice(0, 5)}–{modelo.horario_fim.slice(0, 5)} · {modelo.tipo}</p></div><span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${modelo.ativo ? "bg-green-500/10 text-green-400" : "bg-gray-700 text-gray-400"}`}>{modelo.ativo ? "Ativa" : "Pausada"}</span></div>
                      {podeGerirProgramacao && <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-semibold"><button type="button" disabled={savingProgramacao} onClick={() => iniciarEdicaoModelo(modelo)} className="inline-flex items-center gap-1 text-ohel-blue hover:text-white disabled:opacity-50"><Edit3 className="h-3.5 w-3.5" /> Editar</button><button type="button" disabled={savingProgramacao} onClick={() => void alternarProgramacao(modelo)} className="text-gray-300 hover:text-white disabled:opacity-50">{modelo.ativo ? "Desativar horário" : "Reativar a partir de hoje"}</button></div>}
                    </>
                  )}
                </div>
              ))}
            </div>
            {podeGerirProgramacao && <section className="mt-5 border-t border-gray-800 pt-4" aria-label="Gerenciar tipos de culto"><h3 className="text-xs font-bold text-white">Tipos de culto</h3><p className="mt-1 text-[10px] leading-4 text-gray-500">Renomear atualiza as programações, a agenda anual e o histórico. Desativar tira o tipo das novas escolhas; os registros existentes são mantidos.</p><form onSubmit={salvarNovoTipoCulto} className="mt-3 flex gap-2"><input value={novoTipoCulto} onChange={(event) => setNovoTipoCulto(event.target.value)} maxLength={60} minLength={2} placeholder="Novo tipo de culto" aria-label="Novo tipo de culto" className="input-ohel min-w-0 flex-1 rounded-md px-3 py-2 text-xs" required /><Button type="submit" disabled={savingProgramacao || !novoTipoCulto.trim()} className="shrink-0 px-3">Adicionar</Button></form><div className="mt-3 flex flex-col gap-2">{tiposCulto.map((tipo) => <div key={tipo.id} className="flex items-center gap-2 rounded-md border border-gray-800 bg-ohel-bg px-2 py-2">{tipoEditandoId === tipo.id ? <><input value={nomeTipoEditado} onChange={(event) => setNomeTipoEditado(event.target.value)} maxLength={60} minLength={2} aria-label={`Editar ${tipo.nome}`} className="input-ohel min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs" /><button type="button" disabled={savingProgramacao} onClick={() => void salvarEdicaoTipoCulto(tipo, nomeTipoEditado)} aria-label={`Salvar ${tipo.nome}`} className="rounded p-1.5 text-green-400 hover:bg-green-500/10 disabled:opacity-50"><Check className="h-4 w-4" /></button><button type="button" onClick={() => setTipoEditandoId(null)} aria-label="Cancelar edição" className="rounded p-1.5 text-gray-400 hover:bg-gray-700"><X className="h-4 w-4" /></button></> : <><span className={`min-w-0 flex-1 truncate text-xs ${tipo.ativo ? "text-gray-200" : "text-gray-500 line-through"}`}>{tipo.nome}</span><span className="text-[9px] text-gray-500">{tipo.ativo ? "Ativo" : "Inativo"}</span><button type="button" onClick={() => { setTipoEditandoId(tipo.id); setNomeTipoEditado(tipo.nome); }} aria-label={`Renomear ${tipo.nome}`} className="rounded p-1.5 text-ohel-blue hover:bg-ohel-blue/10"><Pencil className="h-3.5 w-3.5" /></button><button type="button" disabled={savingProgramacao} onClick={() => void salvarEdicaoTipoCulto(tipo, tipo.nome, !tipo.ativo)} aria-label={tipo.ativo ? `Desativar ${tipo.nome}` : `Reativar ${tipo.nome}`} className="rounded px-2 py-1 text-[9px] font-semibold text-gray-300 hover:bg-gray-700 disabled:opacity-50">{tipo.ativo ? "Desativar" : "Reativar"}</button></>}</div>)}</div></section>}
          </Card>

          <Card className="border-gray-800 p-5"><h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><Play className="h-4 w-4 text-green-400" /> Iniciar culto avulso</h2><form onSubmit={iniciarCulto} className="flex flex-col gap-3"><div className="flex flex-col gap-2"><label className="text-xs font-semibold uppercase text-gray-400">Tipo</label><select value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value, titulo: event.target.value })} className="input-ohel w-full rounded-md px-3 py-2.5 text-sm">{tiposCulto.filter((tipo) => tipo.ativo).map((tipo) => <option key={tipo.id} value={tipo.nome}>{tipo.nome}</option>)}</select></div><Input label="Título do culto *" value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} required /><Input label="Dirigente" placeholder="Nome do dirigente" value={form.dirigente} onChange={(event) => setForm({ ...form, dirigente: event.target.value })} /><Input label="Link do culto ao vivo" type="url" placeholder="https://youtube.com/..." value={form.link_ao_vivo} onChange={(event) => setForm({ ...form, link_ao_vivo: event.target.value })} /><textarea value={form.observacoes} onChange={(event) => setForm({ ...form, observacoes: event.target.value })} placeholder="Observações da celebração" className="input-ohel min-h-20 w-full resize-y rounded-md px-3 py-2.5 text-sm" /><Button type="submit" disabled={saving}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Iniciando...</> : <><Play className="mr-2 h-4 w-4" /> Iniciar e gravar culto</>}</Button></form><p className="mt-3 text-[10px] text-gray-600">Use para celebrações fora da programação fixa. A data e o horário são registrados ao iniciar; uma igreja não pode manter dois cultos abertos ao mesmo tempo.</p></Card>

          <Card className="border-gray-800 p-4"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar culto por nome ou tipo..." className="input-ohel w-full rounded-md py-2.5 pl-9 pr-3 text-xs" /></div><div className="mt-4 flex max-h-[520px] flex-col gap-2 overflow-y-auto">{sessoesFiltradas.length === 0 ? <p className="py-5 text-center text-xs text-gray-500">Nenhum culto encontrado.</p> : sessoesFiltradas.map((sessao) => <button type="button" key={sessao.id} onClick={() => setSessaoSelecionada(sessao)} className={`rounded-lg border p-3 text-left transition-colors ${sessaoSelecionada?.id === sessao.id ? "border-ohel-blue bg-ohel-blue/10" : "border-gray-800 bg-ohel-bg hover:border-gray-600"}`}><div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold text-white">{sessao.titulo}</span><span className={`rounded-full px-2 py-1 text-[9px] uppercase ${sessao.status === "aberto" ? "bg-green-500/10 text-green-400" : "bg-gray-700 text-gray-400"}`}>{sessao.status}</span></div><span className="mt-2 block text-[10px] text-gray-500">{new Date(sessao.inicio_em).toLocaleString("pt-BR")}</span>{sessao.link_ao_vivo && <span className="mt-1 block text-[10px] text-red-400">Transmissão ao vivo vinculada</span>}</button>)}</div></Card>
        </div>

        <Card className="min-h-[600px] border-gray-800 p-5 lg:col-span-2">{!sessaoSelecionada ? <div className="flex h-full flex-col items-center justify-center text-center text-gray-500"><CalendarDays className="mb-3 h-10 w-10" /><p className="text-sm">Selecione um culto para ver o diário.</p></div> : <><div className="flex flex-col justify-between gap-4 border-b border-gray-800 pb-4 md:flex-row md:items-start"><div><p className="text-[10px] font-bold uppercase text-ohel-blue">{sessaoSelecionada.tipo}</p><h2 className="mt-1 text-xl font-bold text-white">{sessaoSelecionada.titulo}</h2><p className="mt-2 text-xs text-gray-500">{new Date(sessaoSelecionada.inicio_em).toLocaleString("pt-BR")}{sessaoSelecionada.fim_em ? ` até ${new Date(sessaoSelecionada.fim_em).toLocaleString("pt-BR")}` : " · em andamento"}</p>{sessaoSelecionada.dirigente && <p className="mt-2 text-xs text-gray-300">Dirigente: {sessaoSelecionada.dirigente}</p>}{sessaoSelecionada.link_ao_vivo && <a href={sessaoSelecionada.link_ao_vivo} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300"><ExternalLink className="h-3 w-3" /> Abrir culto ao vivo</a>}</div>{sessaoSelecionada.status === "aberto" && <Button type="button" variant="secondary" onClick={encerrarCulto} disabled={saving} className="w-full md:w-auto"><Square className="mr-2 h-3.5 w-3.5" /> Encerrar culto</Button>}</div><div className="mb-3 mt-5 flex items-center justify-between"><h3 className="text-sm font-bold text-white">Diário do culto</h3><span className="text-xs text-gray-500">{registros.length} registros</span></div>{loadingRegistros ? <p className="py-10 text-center text-xs text-gray-500">Carregando registros...</p> : registros.length === 0 ? <div className="rounded-lg border border-dashed border-gray-700 p-10 text-center text-xs text-gray-500"><BookOpen className="mx-auto mb-2 h-8 w-8" />Nenhuma ação foi registrada nesta sessão.</div> : <div className="flex flex-col gap-2">{registros.map((registro) => <div key={registro.id} className="rounded-lg border border-gray-800 bg-ohel-bg p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="text-[10px] font-bold uppercase text-ohel-blue">{nomeTipo(registro.tipo)}</span><p className="mt-1 truncate text-sm font-semibold text-white">{registro.titulo || "Registro do culto"}</p><p className="mt-1 line-clamp-2 text-xs text-gray-400">{registro.resumo || "Sem detalhes adicionais."}</p></div><span className="shrink-0 text-[10px] text-gray-600">{new Date(registro.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div></div>)}</div>}</>}</Card>
      </div>

      <AgendaAnualCard programacoes={programacoesAnuais} tiposCulto={tiposCulto} anoSelecionado={anoAgenda} onAnoChange={mudarAnoAgenda} podeGerir={podeGerirProgramacao} saving={savingAgenda} onCreate={criarAgendaAnual} onEdit={editarAgendaAnual} onToggle={alternarAgendaAnual} />
    </div>
  );
}
