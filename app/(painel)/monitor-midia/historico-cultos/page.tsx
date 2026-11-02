"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, BookOpen, CalendarDays, ExternalLink, History, Loader2, Play, Search, Square } from "lucide-react";

interface CultoSessao {
  id: string;
  titulo: string;
  tipo: string;
  inicio_em: string;
  fim_em: string | null;
  status: "aberto" | "encerrado";
  link_ao_vivo: string | null;
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

const TIPOS_CULTO = ["Culto de Domingo", "Culto de Quarta-feira", "Culto de Oração", "Culto de Ceia", "Culto Especial", "Outro"];
const nomeTipo = (tipo: string) => ({ louvor: "Louvor", oracao: "Oração", checkin: "Check-in", visitante: "Visitante", visita: "Visita", sermao: "Palavra / Sermão", projecao: "Projeção" }[tipo] || tipo);

export default function HistoricoCultosPage() {
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [sessoes, setSessoes] = useState<CultoSessao[]>([]);
  const [sessaoSelecionada, setSessaoSelecionada] = useState<CultoSessao | null>(null);
  const [registros, setRegistros] = useState<CultoRegistro[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingRegistros, setLoadingRegistros] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ titulo: "Culto de Domingo", tipo: "Culto de Domingo", link_ao_vivo: "", observacoes: "" });
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const carregarSessoes = async (id: string) => {
    const { data, error } = await supabase.from("culto_sessoes").select("id, titulo, tipo, inicio_em, fim_em, status, link_ao_vivo, observacoes").eq("igreja_id", id).order("inicio_em", { ascending: false });
    if (error) throw error;
    const lista = (data || []) as CultoSessao[];
    setSessoes(lista);
    const aberta = lista.find((sessao) => sessao.status === "aberto");
    if (aberta) setSessaoSelecionada((atual) => atual?.id === aberta.id ? atual : aberta);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: user } = await supabase.from("usuarios").select("igreja_id").eq("id", session.user.id).maybeSingle();
        if (!user?.igreja_id) return;
        setIgrejaId(user.igreja_id);
        await carregarSessoes(user.igreja_id);
      } catch (error) {
        setModal({ isOpen: true, type: "error", title: "Não foi possível carregar", message: error instanceof Error ? error.message : "Execute primeiro a migration do histórico de cultos." });
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

  const iniciarCulto = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!igrejaId || !form.titulo.trim()) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.from("culto_sessoes").insert({ igreja_id: igrejaId, titulo: form.titulo.trim(), tipo: form.tipo, link_ao_vivo: form.link_ao_vivo.trim() || null, observacoes: form.observacoes.trim() || null, status: "aberto", created_by: session?.user.id || null }).select("id, titulo, tipo, inicio_em, fim_em, status, link_ao_vivo, observacoes").single();
      if (error) throw error;
      await carregarSessoes(igrejaId);
      setSessaoSelecionada(data as CultoSessao);
      setModal({ isOpen: true, type: "success", title: "Culto iniciado", message: "Os próximos envios do QR Code e ações do Monitor serão registrados nesta sessão." });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível iniciar", message: error instanceof Error ? error.message : "Verifique a migration e as permissões." });
    } finally { setSaving(false); }
  };

  const encerrarCulto = async () => {
    if (!sessaoSelecionada || !igrejaId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("culto_sessoes").update({ status: "encerrado", fim_em: new Date().toISOString() }).eq("id", sessaoSelecionada.id).eq("igreja_id", igrejaId);
      if (error) throw error;
      const atualizada = { ...sessaoSelecionada, status: "encerrado" as const, fim_em: new Date().toISOString() };
      setSessaoSelecionada(atualizada);
      await carregarSessoes(igrejaId);
      setModal({ isOpen: true, type: "success", title: "Culto encerrado", message: "O diário foi fechado e continua disponível para consulta." });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível encerrar", message: error instanceof Error ? error.message : "Tente novamente." });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando histórico...</div>;

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-5 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div className="flex items-start gap-3"><Link href="/monitor-midia" className="text-gray-400 hover:text-white mt-1"><ArrowLeft className="w-5 h-5" /></Link><div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><History className="w-6 h-6 text-ohel-blue" /> Histórico de Cultos</h1><p className="text-gray-400 text-sm mt-1">Busque uma celebração e reveja tudo que foi registrado durante ela.</p></div></div><Link href="/monitor-midia" className="text-xs text-ohel-blue hover:text-white">Voltar ao Monitor</Link></div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="flex flex-col gap-5">
          <Card className="p-5 border-gray-800"><h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Play className="w-4 h-4 text-green-400" /> Iniciar culto</h2><form onSubmit={iniciarCulto} className="flex flex-col gap-3"><div className="flex flex-col gap-2"><label className="text-xs font-semibold text-gray-400 uppercase">Tipo fixo</label><select value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value, titulo: event.target.value })} className="input-ohel w-full px-3 py-2.5 rounded-md text-sm">{TIPOS_CULTO.map((tipo) => <option key={tipo}>{tipo}</option>)}</select></div><Input label="Título do culto *" value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} required /><Input label="Link do culto ao vivo" type="url" placeholder="https://youtube.com/..." value={form.link_ao_vivo} onChange={(event) => setForm({ ...form, link_ao_vivo: event.target.value })} /><textarea value={form.observacoes} onChange={(event) => setForm({ ...form, observacoes: event.target.value })} placeholder="Observações da celebração" className="input-ohel w-full px-3 py-2.5 rounded-md text-sm min-h-20 resize-y" /><Button type="submit" disabled={saving} className="w-full">{saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Iniciando...</> : <><Play className="w-4 h-4 mr-2" /> Iniciar e gravar culto</>}</Button></form><p className="text-[10px] text-gray-600 mt-3">Mantenha uma sessão aberta durante a celebração. Os registros públicos feitos pelo QR Code entrarão nela automaticamente.</p></Card>
          <Card className="p-4 border-gray-800"><div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar culto por nome ou tipo..." className="input-ohel w-full pl-9 pr-3 py-2.5 rounded-md text-xs" /></div><div className="flex flex-col gap-2 mt-4 max-h-[520px] overflow-y-auto">{sessoesFiltradas.length === 0 ? <p className="text-xs text-gray-500 text-center py-5">Nenhum culto encontrado.</p> : sessoesFiltradas.map((sessao) => <button type="button" key={sessao.id} onClick={() => setSessaoSelecionada(sessao)} className={`text-left rounded-lg border p-3 transition-colors ${sessaoSelecionada?.id === sessao.id ? "border-ohel-blue bg-ohel-blue/10" : "border-gray-800 bg-ohel-bg hover:border-gray-600"}`}><div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold text-white">{sessao.titulo}</span><span className={`text-[9px] uppercase px-2 py-1 rounded-full ${sessao.status === "aberto" ? "bg-green-500/10 text-green-400" : "bg-gray-700 text-gray-400"}`}>{sessao.status}</span></div><span className="text-[10px] text-gray-500 block mt-2">{new Date(sessao.inicio_em).toLocaleString("pt-BR")}</span></button>)}</div></Card>
        </div>

        <Card className="lg:col-span-2 p-5 border-gray-800 min-h-[600px]">{!sessaoSelecionada ? <div className="h-full flex flex-col items-center justify-center text-center text-gray-500"><CalendarDays className="w-10 h-10 mb-3" /><p className="text-sm">Selecione um culto para ver o diário.</p></div> : <><div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-gray-800 pb-4"><div><p className="text-[10px] text-ohel-blue uppercase font-bold">{sessaoSelecionada.tipo}</p><h2 className="text-xl font-bold text-white mt-1">{sessaoSelecionada.titulo}</h2><p className="text-xs text-gray-500 mt-2">{new Date(sessaoSelecionada.inicio_em).toLocaleString("pt-BR")}{sessaoSelecionada.fim_em ? ` até ${new Date(sessaoSelecionada.fim_em).toLocaleString("pt-BR")}` : " · em andamento"}</p>{sessaoSelecionada.link_ao_vivo && <a href={sessaoSelecionada.link_ao_vivo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 mt-2"><ExternalLink className="w-3 h-3" /> Abrir culto ao vivo</a>}</div>{sessaoSelecionada.status === "aberto" && <Button type="button" variant="secondary" onClick={encerrarCulto} disabled={saving} className="w-full md:w-auto"><Square className="w-3.5 h-3.5 mr-2" /> Encerrar culto</Button>}</div><div className="flex items-center justify-between mt-5 mb-3"><h3 className="text-sm font-bold text-white">Diário do culto</h3><span className="text-xs text-gray-500">{registros.length} registros</span></div>{loadingRegistros ? <p className="text-xs text-gray-500 py-10 text-center">Carregando registros...</p> : registros.length === 0 ? <div className="rounded-lg border border-dashed border-gray-700 p-10 text-center text-xs text-gray-500"><BookOpen className="w-8 h-8 mx-auto mb-2" />Nenhuma ação foi registrada nesta sessão.</div> : <div className="flex flex-col gap-2">{registros.map((registro) => <div key={registro.id} className="rounded-lg border border-gray-800 bg-ohel-bg p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="text-[10px] uppercase font-bold text-ohel-blue">{nomeTipo(registro.tipo)}</span><p className="text-sm font-semibold text-white truncate mt-1">{registro.titulo || "Registro do culto"}</p><p className="text-xs text-gray-400 mt-1 line-clamp-2">{registro.resumo || "Sem detalhes adicionais."}</p></div><span className="shrink-0 text-[10px] text-gray-600">{new Date(registro.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div></div>)}</div>}</>}</Card>
      </div>
    </div>
  );
}
