"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  buscarMembrosParaAniversarios,
  obterDataAtualSaoPaulo,
  selecionarAniversariantesDoDia,
  type MembroAniversariante,
} from "@/lib/aniversariantes";
import {
  inicioJanelaOracaoRecente,
  STATUS_ORACAO_PUBLICADA,
  VISIBILIDADE_ORACAO_PUBLICA,
} from "@/lib/mural-rules";
import { Card } from "@/components/ui/Card";
import { ResumoContasPagar } from "@/components/financeiro/ResumoContasPagar";
import { obterPeriodoAtualSaoPaulo, type ContaResumoMensal } from "@/lib/financeiro/resumoMensal";
import { Users, UserPlus, HeartHandshake, Church, DollarSign, CalendarDays, CheckSquare, Bell, MonitorPlay, ArrowRight } from "lucide-react";

interface AvisoMural {
  id: string;
  titulo: string;
  conteudo: string;
  created_at: string;
}

interface EventoMural {
  id: string;
  nome: string;
  data_inicio: string | null;
  created_at: string;
}

interface OracaoRecente {
  id: string;
  nome_solicitante: string | null;
  descricao: string | null;
  created_at: string;
}

interface ResumoFinanceiroDashboard {
  contas: ContaResumoMensal[];
  saldoMovimento: number;
}

function formatarDataMural(data: string | null) {
  const match = data?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "Data a definir";
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [nomeUsuario, setNomeUsuario] = useState("Líder");
  const [isAdmin, setIsAdmin] = useState(false);
  
  // KPIs Secretaria
  const [totalMembros, setTotalMembros] = useState(0);
  const [totalCongregados, setTotalCongregados] = useState(0);
  const [totalVisitantes, setTotalVisitantes] = useState(0);
  const [totalCongregacoes, setTotalCongregacoes] = useState(0);
  
  // KPIs Financeiros e Operacionais
  const [resumoFinanceiro, setResumoFinanceiro] = useState<ResumoFinanceiroDashboard | null>(null);
  const [anosFinanceiros, setAnosFinanceiros] = useState<string[]>(() => [obterPeriodoAtualSaoPaulo().slice(0, 4)]);
  const [periodoFinanceiro, setPeriodoFinanceiro] = useState(obterPeriodoAtualSaoPaulo);
  const [loadingFinanceiro, setLoadingFinanceiro] = useState(false);
  const [erroFinanceiro, setErroFinanceiro] = useState("");
  const [pedidosOracao, setPedidosOracao] = useState(0);
  const [aniversariantes, setAniversariantes] = useState<MembroAniversariante[]>([]);
  const [erroAniversariantes, setErroAniversariantes] = useState("");
  const [dataAniversariantes, setDataAniversariantes] = useState(obterDataAtualSaoPaulo);
  const [preCadastros, setPreCadastros] = useState(0);
  const [totalAvisos, setTotalAvisos] = useState(0);
  const [avisosMural, setAvisosMural] = useState<AvisoMural[]>([]);
  const [eventosMural, setEventosMural] = useState<EventoMural[]>([]);
  const [oracoesRecentes, setOracoesRecentes] = useState<OracaoRecente[]>([]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let interval: number | null = null;
    let requisicaoEmAndamento = false;
    let atualizarNovamente = false;
    let primeiraCarga = true;
    let encerrado = false;
    const controller = new AbortController();

    const fetchDashboardData = async () => {
      if (encerrado) return;
      if (requisicaoEmAndamento) {
        atualizarNovamente = true;
        return;
      }
      requisicaoEmAndamento = true;
      if (primeiraCarga) setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: userData } = await supabase.from("usuarios").select("nome, role, igreja_id").eq("id", session.user.id).maybeSingle();
        if (encerrado || !userData?.igreja_id) return;

        if (!channel) {
          const atualizarPorMudanca = () => void fetchDashboardData();
          const filtroIgreja = `igreja_id=eq.${userData.igreja_id}`;
          channel = supabase
            .channel(`dashboard-mural-${session.user.id}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "comunicacoes", filter: filtroIgreja }, atualizarPorMudanca)
            .on("postgres_changes", { event: "*", schema: "public", table: "eventos", filter: filtroIgreja }, atualizarPorMudanca)
            .on("postgres_changes", { event: "*", schema: "public", table: "pedidos_oracao", filter: filtroIgreja }, atualizarPorMudanca)
            .on("postgres_changes", { event: "*", schema: "public", table: "membros", filter: filtroIgreja }, atualizarPorMudanca)
            .subscribe();
        }

        setIsAdmin(userData.role === "admin");
        if (userData?.role === "admin") setNomeUsuario("Admin");
        else if (userData?.role === "monitor") setNomeUsuario("Monitor de Mídia");
        else if (userData?.nome) setNomeUsuario(userData.nome.split(" ")[0]);

        const hoje = new Date();
        const instanteConsulta = hoje.toISOString();
        const semana = inicioJanelaOracaoRecente(hoje);

        // Executando todas as consultas em paralelo para performance
        const [
          membrosRes, congregadosRes, visitantesRes, congregacoesRes,
          oracoesRes, preCadastrosRes, muralRes, eventosMuralRes,
          oracoesRecentesRes, membrosNascRes
        ] = await Promise.all([
          supabase.from("membros").select("id", { count: "exact", head: true }).eq("igreja_id", userData.igreja_id),
          supabase.from("congregados").select("id", { count: "exact", head: true }).eq("igreja_id", userData.igreja_id),
          supabase.from("visitantes").select("id", { count: "exact", head: true }).eq("igreja_id", userData.igreja_id),
          supabase.from("congregacoes").select("id", { count: "exact", head: true }).eq("igreja_id", userData.igreja_id),
          
          // Orações pendentes
          supabase.from("pedidos_oracao").select("id", { count: "exact", head: true }).eq("igreja_id", userData.igreja_id).in('status', ['Pendente', 'Em Oração']),
          
          // Pré-cadastros pendentes
          supabase.from("membros").select("id", { count: "exact", head: true }).eq("igreja_id", userData.igreja_id).eq("status", "Pré-Cadastro"),
          
          // Avisos no mural
          supabase.from("comunicacoes").select("id, titulo, conteudo, created_at", { count: "exact" }).eq("igreja_id", userData.igreja_id).lte("created_at", instanteConsulta).order("created_at", { ascending: false }).order("id"),

          // Eventos publicados no mural, no mesmo escopo da igreja
          supabase.from("eventos").select("id, nome, data_inicio, created_at").eq("igreja_id", userData.igreja_id).eq("publicar_mural", true).lte("created_at", instanteConsulta).order("created_at", { ascending: false }).order("id"),

          // Só pedidos aprovados e públicos entram no feed compartilhado.
          supabase.from("pedidos_oracao").select("id, nome_solicitante, descricao, created_at").eq("igreja_id", userData.igreja_id).eq("status", STATUS_ORACAO_PUBLICADA).eq("visibilidade", VISIBILIDADE_ORACAO_PUBLICA).gte("created_at", semana).lte("created_at", instanteConsulta).order("created_at", { ascending: false }).order("id"),
          
          // Paginar evita omitir aniversariantes em igrejas com mais de 1.000 membros.
          buscarMembrosParaAniversarios(supabase, userData.igreja_id, userData.role === "admin", controller.signal)
        ]);
        if (encerrado) return;

        setTotalMembros(membrosRes.count || 0);
        setTotalCongregados(congregadosRes.count || 0);
        setTotalVisitantes(visitantesRes.count || 0);
        setTotalCongregacoes(congregacoesRes.count || 0);
        
        setPedidosOracao(oracoesRes.count || 0);
        setPreCadastros(preCadastrosRes.count || 0);
        setTotalAvisos(muralRes.count || 0);
        setAvisosMural((muralRes.data || []) as AvisoMural[]);
        setEventosMural((eventosMuralRes.data || []) as EventoMural[]);
        setOracoesRecentes((oracoesRecentesRes.data || []) as OracaoRecente[]);

        // Compara dia/mês do cadastro sem converter o nascimento para UTC.
        // Usa a data ao concluir a consulta, inclusive se ela atravessar meia-noite.
        const dataAtual = obterDataAtualSaoPaulo();
        setDataAniversariantes(dataAtual);
        setErroAniversariantes(membrosNascRes.error || "");
        setAniversariantes(membrosNascRes.error ? [] : selecionarAniversariantesDoDia(membrosNascRes.data || [], dataAtual));

      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
        if (!encerrado) {
          setErroAniversariantes("Não foi possível carregar os aniversariantes. A consulta será tentada novamente.");
          setAniversariantes([]);
        }
      } finally {
        requisicaoEmAndamento = false;
        if (!encerrado && primeiraCarga) {
          primeiraCarga = false;
          setLoading(false);
        }
        if (!encerrado && atualizarNovamente) {
          atualizarNovamente = false;
          void fetchDashboardData();
        }
      }
    };

    const atualizarSeVisivel = () => {
      if (!document.hidden) void fetchDashboardData();
    };
    void fetchDashboardData();
    interval = window.setInterval(atualizarSeVisivel, 30000);
    document.addEventListener("visibilitychange", atualizarSeVisivel);
    window.addEventListener("focus", atualizarSeVisivel);

    return () => {
      encerrado = true;
      controller.abort();
      if (interval !== null) window.clearInterval(interval);
      document.removeEventListener("visibilitychange", atualizarSeVisivel);
      window.removeEventListener("focus", atualizarSeVisivel);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    const carregarResumoFinanceiro = async () => {
      setLoadingFinanceiro(true);
      setErroFinanceiro("");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
        const response = await fetch(`/api/dashboard/resumo-financeiro?periodo=${encodeURIComponent(periodoFinanceiro)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json()) as {
          contas?: ContaResumoMensal[];
          anos?: string[];
          saldoMovimento?: number;
          error?: string;
        };
        if (!response.ok || !result.contas) throw new Error(result.error || "Não foi possível carregar o resumo financeiro.");
        setResumoFinanceiro({ contas: result.contas, saldoMovimento: Number(result.saldoMovimento || 0) });
        setAnosFinanceiros(result.anos?.length ? result.anos : [periodoFinanceiro.slice(0, 4)]);
      } catch (error) {
        if (!controller.signal.aborted) setErroFinanceiro(error instanceof Error ? error.message : "Não foi possível carregar o resumo financeiro.");
      } finally {
        if (!controller.signal.aborted) setLoadingFinanceiro(false);
      }
    };
    void carregarResumoFinanceiro();
    return () => controller.abort();
  }, [isAdmin, periodoFinanceiro]);

  return (
    <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto pb-10">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">A Paz do Senhor, {loading ? "..." : nomeUsuario}! 🙏</h1>
          <p className="text-gray-400 text-xs mt-0.5">Aqui está o resumo da sua igreja hoje.</p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-xs text-gray-500">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* MONITOR DE MÍDIA */}
      <Link href="/monitor-midia" className="block outline-none">
        <Card className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-ohel-blue/20 to-ohel-surface border-ohel-blue/40 hover:border-ohel-blue hover:shadow-[0_0_30px_rgba(0,123,255,0.4)] transition-all duration-300 cursor-pointer group shadow-[0_0_20px_rgba(0,123,255,0.15)]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ohel-blue flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <MonitorPlay className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Monitor de Mídia</h2>
              <p className="text-gray-300 text-xs mt-0.5">Acesso rápido a visitantes, louvores, mural, orações e escalas.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-ohel-blue font-bold text-sm bg-ohel-blue/10 px-4 py-2 rounded-lg group-hover:bg-ohel-blue group-hover:text-white transition-colors">
            Acessar Painel <ArrowRight className="w-4 h-4" />
          </div>
        </Card>
      </Link>

      {/* LINHA 1 DE KPIs (SECRETARIA) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/secretaria/membros" className="block outline-none">
          <Card className="p-4 flex flex-col justify-between group hover:border-ohel-blue/50 hover:shadow-[0_0_24px_rgba(0,123,255,0.35)] hover:scale-[1.02] transition-all cursor-pointer h-full shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Membros</p>
              <div className="w-8 h-8 rounded-full bg-ohel-blue/10 flex items-center justify-center"><Users className="w-4 h-4 text-ohel-blue" /></div>
            </div>
            <h2 className="text-2xl font-bold text-white">{loading ? "-" : totalMembros}</h2>
          </Card>
        </Link>
        <Link href="/secretaria/congregados" className="block outline-none">
          <Card className="p-4 flex flex-col justify-between group hover:border-green-500/50 hover:shadow-[0_0_24px_rgba(34,197,94,0.3)] hover:scale-[1.02] transition-all cursor-pointer h-full shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Congregados</p>
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center"><UserPlus className="w-4 h-4 text-green-500" /></div>
            </div>
            <h2 className="text-2xl font-bold text-white">{loading ? "-" : totalCongregados}</h2>
          </Card>
        </Link>
        <Link href="/secretaria/visitantes" className="block outline-none">
          <Card className="p-4 flex flex-col justify-between group hover:border-purple-500/50 hover:shadow-[0_0_24px_rgba(168,85,247,0.3)] hover:scale-[1.02] transition-all cursor-pointer h-full shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Visitantes</p>
              <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center"><HeartHandshake className="w-4 h-4 text-purple-500" /></div>
            </div>
            <h2 className="text-2xl font-bold text-white">{loading ? "-" : totalVisitantes}</h2>
          </Card>
        </Link>
        <Link href="/secretaria/congregacoes" className="block outline-none">
          <Card className="p-4 flex flex-col justify-between group hover:border-yellow-500/50 hover:shadow-[0_0_24px_rgba(234,179,8,0.3)] hover:scale-[1.02] transition-all cursor-pointer h-full shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Congregações</p>
              <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center"><Church className="w-4 h-4 text-yellow-500" /></div>
            </div>
            <h2 className="text-2xl font-bold text-white">{loading ? "-" : totalCongregacoes}</h2>
          </Card>
        </Link>
      </div>

      {/* LINHA 2 DE KPIs (OPERACIONAL / FINANCEIRO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {isAdmin && (
          <Link href="/financeiro/movimento" className="block outline-none">
            <Card className="p-4 flex flex-col justify-between group hover:border-green-500/50 hover:shadow-[0_0_24px_rgba(34,197,94,0.3)] hover:scale-[1.02] transition-all cursor-pointer h-full bg-ohel-surface/40">
              <div className="flex justify-between items-start mb-2">
                <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Saldo do mês (movimento)</p>
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center"><DollarSign className="w-4 h-4 text-green-500" /></div>
              </div>
              <h2 className={`text-2xl font-bold ${erroFinanceiro ? "text-gray-500" : (resumoFinanceiro?.saldoMovimento || 0) >= 0 ? 'text-white' : 'text-red-500'}`}>
                {loadingFinanceiro || (!resumoFinanceiro && !erroFinanceiro) ? "-" : erroFinanceiro ? "—" : (resumoFinanceiro?.saldoMovimento || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </h2>
            </Card>
          </Link>
        )}

        <Link href="/secretaria/oracoes" className="block outline-none">
          <Card className="p-4 flex flex-col justify-between group hover:border-red-500/50 hover:shadow-[0_0_24px_rgba(239,68,68,0.3)] hover:scale-[1.02] transition-all cursor-pointer h-full bg-ohel-surface/40">
            <div className="flex justify-between items-start mb-2">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Pedidos de Oração</p>
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center"><HeartHandshake className="w-4 h-4 text-red-500" /></div>
            </div>
            <h2 className="text-2xl font-bold text-white">{loading ? "-" : pedidosOracao}</h2>
          </Card>
        </Link>
        
        <Card className="p-4 flex flex-col justify-between h-full bg-ohel-surface/40 border-gray-800 hover:border-orange-500/50 hover:shadow-[0_0_24px_rgba(249,115,22,0.3)] transition-all">
          <div className="flex justify-between items-start mb-2">
            <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Aniversariantes de hoje</p>
            <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center"><CalendarDays className="w-4 h-4 text-orange-500" /></div>
          </div>
          <h2 aria-live="polite" className="text-2xl font-bold text-white">{loading ? "-" : erroAniversariantes ? "—" : aniversariantes.length}</h2>
          <p className="mt-1 text-[10px] text-gray-500">{dataAniversariantes.slice(8)}/{dataAniversariantes.slice(5, 7)} · Membros ativos</p>
          {!loading && erroAniversariantes ? (
            <p role="alert" className="mt-2 text-[11px] text-orange-300">{erroAniversariantes}</p>
          ) : !loading && aniversariantes.length === 0 ? (
            <p className="mt-2 text-[11px] text-gray-500">Nenhum aniversariante hoje.</p>
          ) : !loading && isAdmin ? (
            <ul aria-label="Membros aniversariantes de hoje" className="mt-2 max-h-32 space-y-1.5 overflow-y-auto border-t border-gray-800 pt-2">
              {aniversariantes.map((membro) => (
                <li key={membro.id}>
                  <Link href={`/secretaria/membros/editar/${encodeURIComponent(membro.id)}`} className="block break-words text-xs text-orange-200 hover:text-white">
                    {membro.nome || "Membro sem nome"}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Link href="/secretaria/membros/aprovacao" className="block outline-none">
          <Card className="p-4 flex flex-col justify-between group hover:border-blue-500/50 hover:scale-[1.02] transition-all cursor-pointer h-full bg-ohel-surface/40">
            <div className="flex justify-between items-start mb-2">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Pré-Cadastros</p>
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><CheckSquare className="w-4 h-4 text-blue-500" /></div>
            </div>
            <h2 className="text-2xl font-bold text-white">{loading ? "-" : preCadastros}</h2>
          </Card>
        </Link>
      </div>

      {/* ÁREA DE GRÁFICOS / MURAL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
        {isAdmin && (
          <ResumoContasPagar
            contas={resumoFinanceiro?.contas || []}
            periodo={periodoFinanceiro}
            anos={anosFinanceiros}
            onChangePeriodo={setPeriodoFinanceiro}
            loading={loadingFinanceiro || (!resumoFinanceiro && !erroFinanceiro)}
            error={erroFinanceiro}
            compacto
            titulo="Resumo financeiro"
          />
        )}

        <Card className="p-5 flex flex-col min-h-[250px] border-gray-800">
          <div className="flex items-center justify-between gap-3 border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-teal-500/10 flex items-center justify-center"><Bell className="w-3.5 h-3.5 text-teal-500" /></div>
              <h3 className="text-sm font-bold text-white">Mural da igreja</h3>
            </div>
            <Link href="/secretaria/mural" className="inline-flex items-center gap-1 text-[10px] text-teal-400 hover:text-white">Abrir mural <ArrowRight className="w-3 h-3" /></Link>
          </div>

          <div className="mt-3 flex-1 space-y-4 overflow-y-auto pr-1 max-h-[28rem]">
            <section aria-label="Avisos recentes">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-gray-300">Avisos <span className="ml-1 text-gray-500">{totalAvisos}</span></h4>
                <Link href="/secretaria/mural" className="text-[10px] text-gray-500 hover:text-teal-400">Ver todos</Link>
              </div>
              {loading ? <p className="text-xs text-gray-500">Carregando avisos...</p> : avisosMural.length === 0 ? <p className="text-xs text-gray-500">Nenhum aviso publicado.</p> : (
                <div className="space-y-2">
                  {avisosMural.map((aviso) => (
                    <div key={aviso.id} className="rounded-lg border border-gray-800 bg-ohel-bg/50 px-3 py-2">
                      <p className="text-xs font-semibold text-white truncate">{aviso.titulo}</p>
                      <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{aviso.conteudo}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section aria-label="Eventos publicados">
              <div className="flex items-center justify-between mb-2">
                <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-300"><CalendarDays className="w-3.5 h-3.5 text-blue-400" /> Eventos</h4>
                <Link href="/eventos" className="text-[10px] text-gray-500 hover:text-blue-400">Ver todos</Link>
              </div>
              {loading ? <p className="text-xs text-gray-500">Carregando eventos...</p> : eventosMural.length === 0 ? <p className="text-xs text-gray-500">Nenhum evento publicado no mural.</p> : (
                <div className="space-y-2">
                  {eventosMural.map((evento) => (
                    <div key={evento.id} className="rounded-lg border border-gray-800 bg-ohel-bg/50 px-3 py-2">
                      <p className="text-xs font-semibold text-white truncate">{evento.nome}</p>
                      <p className="mt-0.5 text-[10px] text-gray-500">{formatarDataMural(evento.data_inicio)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section aria-label="Orações recentes">
              <div className="flex items-center justify-between mb-2">
                <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-300"><HeartHandshake className="w-3.5 h-3.5 text-red-400" /> Orações recentes <span className="text-gray-500">· 7 dias</span></h4>
                <Link href="/secretaria/oracoes" className="text-[10px] text-gray-500 hover:text-red-400">Ver todas</Link>
              </div>
              {loading ? <p className="text-xs text-gray-500">Carregando orações...</p> : oracoesRecentes.length === 0 ? <p className="text-xs text-gray-500">Nenhuma oração recente em andamento.</p> : (
                <div className="space-y-2">
                  {oracoesRecentes.map((oracao) => (
                    <div key={oracao.id} className="rounded-lg border border-gray-800 bg-ohel-bg/50 px-3 py-2">
                      <p className="text-xs font-semibold text-white truncate">Pedido de oração · {oracao.nome_solicitante || "Anônimo"}</p>
                      <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{oracao.descricao || "Pedido em oração pela igreja."}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </Card>

      </div>

    </div>
  );
}
