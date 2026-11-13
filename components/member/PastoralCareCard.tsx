"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  HeartHandshake,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  EMOCOES,
  RESPONSAVEL_PENDENTE,
  STATUS_ATENDIMENTO,
  TIPOS_ATENDIMENTO,
  aguardandoConfirmacao,
  dataValida,
  horaValida,
  rotuloAtendimento,
  type AtendimentoPessoal,
  type CuidadoPessoalData,
  type RegistroEmocionalPessoal,
} from "@/lib/pastoral-care";
import styles from "./pastoral-care.module.css";

const ITENS_POR_PAGINA = 4;

type PastoralCareCardProps = {
  refreshKey?: number;
};

type ApiResult = {
  atendimentos?: AtendimentoPessoal[];
  registros?: RegistroEmocionalPessoal[];
  hasMore?: boolean;
  error?: string;
};

const ICONE_EMOCAO: Record<(typeof EMOCOES)[number], string> = {
  Feliz: "😊",
  Agradecido: "🙏",
  Acolhido: "🤍",
  Ansioso: "🌊",
  Desanimado: "🌧️",
  Fragilizado: "🫶",
  Doente: "🌿",
  "Sem Amigos": "🕊️",
  "Sem Esperança": "🕯️",
};

function hojeSaoPaulo() {
  const partes = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(new Date());
  const valor = (tipo: string) =>
    partes.find((parte) => parte.type === tipo)?.value || "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function formatarData(valor: string) {
  if (!dataValida(valor)) return valor || "Data não informada";
  const [ano, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarHora(valor: string | null) {
  return valor ? valor.slice(0, 5) : "A combinar";
}

function formatarDataHora(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Data não informada";
  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function mensagemDoErro(error: unknown, alternativa: string) {
  return error instanceof Error && error.message
    ? error.message
    : alternativa;
}

async function lerResposta(response: Response): Promise<ApiResult> {
  const texto = await response.text();
  if (!texto) return {};
  try {
    const resultado: unknown = JSON.parse(texto);
    return resultado && typeof resultado === "object"
      ? (resultado as ApiResult)
      : {};
  } catch {
    return {};
  }
}

function classeStatus(status: string | null) {
  if (status === STATUS_ATENDIMENTO[0]) return styles.statusScheduled;
  if (status === STATUS_ATENDIMENTO[1]) return styles.statusDone;
  if (status === STATUS_ATENDIMENTO[2]) return styles.statusCancelled;
  return styles.statusUnknown;
}

function explicacaoAtendimento(atendimento: AtendimentoPessoal) {
  if (aguardandoConfirmacao(atendimento)) {
    return "Sua preferência foi registrada. A equipe autorizada ainda confirmará o pastor e o horário.";
  }
  if (atendimento.status === STATUS_ATENDIMENTO[0]) {
    return "Este atendimento está agendado pela equipe autorizada.";
  }
  if (atendimento.status === STATUS_ATENDIMENTO[1]) {
    return "Este atendimento foi marcado como realizado.";
  }
  if (atendimento.status === STATUS_ATENDIMENTO[2]) {
    return "Este pedido foi cancelado.";
  }
  return "Confira o status informado pela equipe autorizada.";
}

export function PastoralCareCard({ refreshKey = 0 }: PastoralCareCardProps) {
  const [dados, setDados] = useState<CuidadoPessoalData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState("");
  const [paginaAtendimento, setPaginaAtendimento] = useState(1);
  const [paginaEmocional, setPaginaEmocional] = useState(1);

  const [tipoAtendimento, setTipoAtendimento] = useState("");
  const [motivo, setMotivo] = useState("");
  const [dataAtendimento, setDataAtendimento] = useState("");
  const [horaAtendimento, setHoraAtendimento] = useState("");
  const [enviandoAtendimento, setEnviandoAtendimento] = useState(false);
  const [erroAtendimento, setErroAtendimento] = useState("");
  const [sucessoAtendimento, setSucessoAtendimento] = useState("");

  const [emojiSelecionado, setEmojiSelecionado] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviandoSentimento, setEnviandoSentimento] = useState(false);
  const [erroSentimento, setErroSentimento] = useState("");
  const [sucessoSentimento, setSucessoSentimento] = useState("");

  const [confirmarCancelamento, setConfirmarCancelamento] = useState<
    string | null
  >(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [erroCancelamento, setErroCancelamento] = useState("");
  const [sucessoCancelamento, setSucessoCancelamento] = useState("");

  const requisicaoRef = useRef<AbortController | null>(null);
  const recarregarPendente = useRef(false);
  const acaoAbortRef = useRef<AbortController | null>(null);
  const acaoEmAndamento = useRef(false);
  const refreshAnteriorRef = useRef(refreshKey);

  const carregar = useCallback(async function carregarCuidado() {
    if (requisicaoRef.current) {
      recarregarPendente.current = true;
      return;
    }

    const controller = new AbortController();
    requisicaoRef.current = controller;
    setCarregando(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (controller.signal.aborted) return;
      if (!session?.access_token) {
        setDados(null);
        throw new Error("Sua sessão expirou. Entre novamente.");
      }

      const atendimentosCarregados: AtendimentoPessoal[] = [];
      const registrosCarregados: RegistroEmocionalPessoal[] = [];
      let offset = 0;
      let hasMore = false;
      do {
        const response = await fetch(`/api/membros/cuidado?offset=${offset}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const resultado = await lerResposta(response);
        if (controller.signal.aborted) return;
        if (
          !response.ok ||
          !Array.isArray(resultado.atendimentos) ||
          !Array.isArray(resultado.registros)
        ) {
          if ([401, 403].includes(response.status)) setDados(null);
          throw new Error(
            resultado.error || "Não foi possível carregar seu cuidado pastoral.",
          );
        }
        atendimentosCarregados.push(...resultado.atendimentos);
        registrosCarregados.push(...resultado.registros);
        hasMore = resultado.hasMore === true;
        offset += 100;
      } while (hasMore);

      setDados({
        atendimentos: atendimentosCarregados,
        registros: registrosCarregados,
      });
      setErroCarregamento("");
    } catch (error) {
      if (!controller.signal.aborted) {
        setErroCarregamento(
          mensagemDoErro(
            error,
            "Não foi possível carregar seu cuidado pastoral.",
          ),
        );
      }
    } finally {
      if (requisicaoRef.current === controller) requisicaoRef.current = null;
      if (!controller.signal.aborted) setCarregando(false);
      const repetir =
        recarregarPendente.current && !controller.signal.aborted;
      recarregarPendente.current = false;
      if (repetir) window.setTimeout(() => void carregarCuidado(), 0);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void carregar(), 0);
    const atualizarAoRetomar = () => {
      if (!document.hidden) void carregar();
    };
    const intervalo = window.setInterval(atualizarAoRetomar, 30000);

    window.addEventListener("focus", atualizarAoRetomar);
    document.addEventListener("visibilitychange", atualizarAoRetomar);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(intervalo);
      window.removeEventListener("focus", atualizarAoRetomar);
      document.removeEventListener("visibilitychange", atualizarAoRetomar);
      requisicaoRef.current?.abort();
      requisicaoRef.current = null;
      recarregarPendente.current = false;
      acaoAbortRef.current?.abort();
      acaoAbortRef.current = null;
    };
  }, [carregar]);

  useEffect(() => {
    if (refreshAnteriorRef.current === refreshKey) return;
    refreshAnteriorRef.current = refreshKey;
    void carregar();
  }, [carregar, refreshKey]);

  const atendimentos = dados?.atendimentos || [];
  const registros = dados?.registros || [];
  const totalPaginasAtendimento = Math.max(
    1,
    Math.ceil(atendimentos.length / ITENS_POR_PAGINA),
  );
  const totalPaginasEmocional = Math.max(
    1,
    Math.ceil(registros.length / ITENS_POR_PAGINA),
  );
  const paginaAtendimentoAtual = Math.min(
    paginaAtendimento,
    totalPaginasAtendimento,
  );
  const paginaEmocionalAtual = Math.min(paginaEmocional, totalPaginasEmocional);
  const atendimentosVisiveis = atendimentos.slice(
    (paginaAtendimentoAtual - 1) * ITENS_POR_PAGINA,
    paginaAtendimentoAtual * ITENS_POR_PAGINA,
  );
  const registrosVisiveis = registros.slice(
    (paginaEmocionalAtual - 1) * ITENS_POR_PAGINA,
    paginaEmocionalAtual * ITENS_POR_PAGINA,
  );

  const enviarAtendimento = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (acaoEmAndamento.current) return;

    setErroAtendimento("");
    setSucessoAtendimento("");
    const motivoLimpo = motivo.trim();
    const tipoValido = (TIPOS_ATENDIMENTO as readonly string[]).includes(
      tipoAtendimento,
    );
    if (!tipoValido) {
      setErroAtendimento("Escolha o tipo de atendimento.");
      return;
    }
    if (!motivoLimpo) {
      setErroAtendimento("Conte brevemente o motivo do atendimento.");
      return;
    }
    if (motivo.length > 2000) {
      setErroAtendimento("O motivo deve ter no máximo 2000 caracteres.");
      return;
    }
    if (!dataValida(dataAtendimento) || dataAtendimento < hojeSaoPaulo()) {
      setErroAtendimento(
        "Escolha uma data válida a partir de hoje, no horário de São Paulo.",
      );
      return;
    }
    if (!horaValida(horaAtendimento || null)) {
      setErroAtendimento("Informe um horário válido ou deixe o campo em branco.");
      return;
    }

    acaoEmAndamento.current = true;
    setEnviandoAtendimento(true);
    const controller = new AbortController();
    acaoAbortRef.current = controller;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");

      const response = await fetch("/api/membros/atendimentos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          tipo: tipoAtendimento,
          motivo: motivoLimpo,
          data_atendimento: dataAtendimento,
          hora_atendimento: horaAtendimento || null,
        }),
      });
      const resultado = await lerResposta(response);
      if (!response.ok) {
        if ([401, 403].includes(response.status)) setDados(null);
        throw new Error(resultado.error || "Não foi possível registrar o pedido.");
      }

      setTipoAtendimento("");
      setMotivo("");
      setDataAtendimento("");
      setHoraAtendimento("");
      setPaginaAtendimento(1);
      setSucessoAtendimento(
        "Pedido registrado. A equipe autorizada confirmará os detalhes.",
      );
      void carregar();
    } catch (error) {
      if (!controller.signal.aborted) {
        setErroAtendimento(
          mensagemDoErro(error, "Não foi possível registrar o pedido."),
        );
      }
    } finally {
      if (acaoAbortRef.current === controller) acaoAbortRef.current = null;
      acaoEmAndamento.current = false;
      setEnviandoAtendimento(false);
    }
  };

  const enviarSentimento = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (acaoEmAndamento.current) return;

    setErroSentimento("");
    setSucessoSentimento("");
    const sentimentoValido = (EMOCOES as readonly string[]).includes(
      emojiSelecionado,
    );
    if (!sentimentoValido) {
      setErroSentimento("Escolha como você está se sentindo hoje.");
      return;
    }
    if (observacao.length > 2000) {
      setErroSentimento("A observação deve ter no máximo 2000 caracteres.");
      return;
    }

    acaoEmAndamento.current = true;
    setEnviandoSentimento(true);
    const controller = new AbortController();
    acaoAbortRef.current = controller;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");

      const response = await fetch("/api/membros/emocional", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          emoji: emojiSelecionado,
          observacao: observacao.trim(),
        }),
      });
      const resultado = await lerResposta(response);
      if (!response.ok) {
        if ([401, 403].includes(response.status)) setDados(null);
        throw new Error(
          resultado.error || "Não foi possível registrar seu sentimento.",
        );
      }

      setEmojiSelecionado("");
      setObservacao("");
      setPaginaEmocional(1);
      setSucessoSentimento("Sentimento registrado no seu histórico.");
      void carregar();
    } catch (error) {
      if (!controller.signal.aborted) {
        setErroSentimento(
          mensagemDoErro(
            error,
            "Não foi possível registrar seu sentimento.",
          ),
        );
      }
    } finally {
      if (acaoAbortRef.current === controller) acaoAbortRef.current = null;
      acaoEmAndamento.current = false;
      setEnviandoSentimento(false);
    }
  };

  const cancelarAtendimento = async (id: string) => {
    if (acaoEmAndamento.current) return;
    const atendimento = atendimentos.find((item) => item.id === id);
    if (!atendimento || atendimento.status !== STATUS_ATENDIMENTO[0]) {
      setErroCancelamento("Este pedido não está mais disponível para cancelamento.");
      return;
    }

    setErroCancelamento("");
    setSucessoCancelamento("");
    acaoEmAndamento.current = true;
    setCancelandoId(id);
    const controller = new AbortController();
    acaoAbortRef.current = controller;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");

      const response = await fetch(
        `/api/membros/atendimentos/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({ acao: "cancelar" }),
        },
      );
      const resultado = await lerResposta(response);
      if (!response.ok) {
        if ([401, 403].includes(response.status)) setDados(null);
        throw new Error(resultado.error || "Não foi possível cancelar o pedido.");
      }

      setConfirmarCancelamento(null);
      setPaginaAtendimento(1);
      setSucessoCancelamento("Pedido cancelado.");
      void carregar();
    } catch (error) {
      if (!controller.signal.aborted) {
        setErroCancelamento(
          mensagemDoErro(error, "Não foi possível cancelar o pedido."),
        );
      }
    } finally {
      if (acaoAbortRef.current === controller) acaoAbortRef.current = null;
      acaoEmAndamento.current = false;
      setCancelandoId(null);
    }
  };

  return (
    <section className={styles.card} aria-labelledby="pastoral-care-title">
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          <span className={styles.headingIcon} aria-hidden="true">
            <HeartHandshake size={18} />
          </span>
          <div className={styles.headingText}>
            <p className={styles.eyebrow}>Acolhimento</p>
            <h2 id="pastoral-care-title" className={styles.title}>
              Cuidado pastoral
            </h2>
            <p className={styles.subtitle}>
              Peça atendimento ou registre como você está hoje.
            </p>
          </div>
        </div>
        <button
          type="button"
          className={styles.refresh}
          onClick={() => void carregar()}
          disabled={carregando}
        >
          <RefreshCw size={14} className={carregando ? "animate-spin" : ""} />
          Atualizar cuidado
        </button>
      </header>

      <p className={styles.privacy}>
        <ShieldCheck size={14} aria-hidden="true" />
        <span>
          Seus pedidos e sentimentos são compartilhados somente com a equipe
          autorizada da igreja.
        </span>
      </p>

      {erroCarregamento && (
        <div className={styles.loadError} role="alert">
          <span>{erroCarregamento}</span>
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={carregando}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {carregando && !dados ? (
        <div className={styles.loading} role="status" aria-live="polite">
          <Loader2 size={17} className="animate-spin" />
          Carregando seu cuidado pastoral...
        </div>
      ) : dados ? (
        <div className={styles.content}>
          {carregando && (
            <p className={styles.syncing} role="status">
              <Loader2 size={13} className="animate-spin" /> Atualizando histórico...
            </p>
          )}

          <div className={styles.formCards}>
            <article className={styles.formCard}>
              <div className={styles.cardHeading}>
                <span className={`${styles.cardIcon} ${styles.cardIconBlue}`} aria-hidden="true">
                  <CalendarDays size={16} />
                </span>
                <div>
                  <h3>Solicitar atendimento</h3>
                  <p>Indique uma preferência; a equipe confirmará os detalhes.</p>
                </div>
              </div>

              <form onSubmit={enviarAtendimento} className={styles.form}>
                <label className={styles.label} htmlFor="pastoral-care-type">
                  Tipo de atendimento
                  <select
                    id="pastoral-care-type"
                    className={styles.field}
                    value={tipoAtendimento}
                    onChange={(evento) => setTipoAtendimento(evento.target.value)}
                    required
                  >
                    <option value="">Selecione uma opção</option>
                    {TIPOS_ATENDIMENTO.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.label} htmlFor="pastoral-care-reason">
                  Motivo <span className={styles.required}>obrigatório</span>
                  <textarea
                    id="pastoral-care-reason"
                    className={`${styles.field} ${styles.textarea}`}
                    value={motivo}
                    onChange={(evento) => setMotivo(evento.target.value)}
                    maxLength={2000}
                    required
                    rows={3}
                    placeholder="Como podemos acolher você?"
                  />
                  <span className={styles.counter}>{motivo.length}/2000</span>
                </label>

                <div className={styles.fieldGrid}>
                  <label className={styles.label} htmlFor="pastoral-care-date">
                    Data preferida
                    <input
                      id="pastoral-care-date"
                      className={styles.field}
                      type="date"
                      min={hojeSaoPaulo()}
                      value={dataAtendimento}
                      onChange={(evento) => setDataAtendimento(evento.target.value)}
                      required
                    />
                  </label>
                  <label className={styles.label} htmlFor="pastoral-care-time">
                    Horário preferido <span className={styles.optional}>opcional</span>
                    <input
                      id="pastoral-care-time"
                      className={styles.field}
                      type="time"
                      value={horaAtendimento}
                      onChange={(evento) => setHoraAtendimento(evento.target.value)}
                    />
                  </label>
                </div>

                <p className={styles.formHint}>
                  A data e o horário são apenas sua preferência. O pedido começa como
                  “Aguardando confirmação”.
                </p>
                {erroAtendimento && (
                  <p className={styles.formError} role="alert">
                    {erroAtendimento}
                  </p>
                )}
                {sucessoAtendimento && (
                  <p className={styles.formSuccess} role="status">
                    <CheckCircle2 size={14} /> {sucessoAtendimento}
                  </p>
                )}
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={enviandoAtendimento}
                >
                  {enviandoAtendimento && <Loader2 size={14} className="animate-spin" />}
                  {enviandoAtendimento ? "Registrando..." : "Registrar pedido"}
                </button>
              </form>
            </article>

            <article className={styles.formCard}>
              <div className={styles.cardHeading}>
                <span className={`${styles.cardIcon} ${styles.cardIconPurple}`} aria-hidden="true">
                  <HeartHandshake size={16} />
                </span>
                <div>
                  <h3>Como você está?</h3>
                  <p>Atualize seu sentimento e guarde uma anotação, se quiser.</p>
                </div>
              </div>

              <form onSubmit={enviarSentimento} className={styles.form}>
                <fieldset className={styles.emotionFieldset}>
                  <legend className={styles.label}>Sentimento de hoje</legend>
                  <div className={styles.emotionGrid}>
                    {EMOCOES.map((emocao) => (
                      <button
                        type="button"
                        key={emocao}
                        className={`${styles.emotionOption} ${emojiSelecionado === emocao ? styles.emotionSelected : ""}`}
                        aria-pressed={emojiSelecionado === emocao}
                        onClick={() => setEmojiSelecionado(emocao)}
                      >
                        <span className={styles.emotionEmoji} aria-hidden="true">
                          {ICONE_EMOCAO[emocao]}
                        </span>
                        <span>{emocao}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label className={styles.label} htmlFor="pastoral-care-note">
                  Observação <span className={styles.optional}>opcional</span>
                  <textarea
                    id="pastoral-care-note"
                    className={`${styles.field} ${styles.textarea}`}
                    value={observacao}
                    onChange={(evento) => setObservacao(evento.target.value)}
                    maxLength={2000}
                    rows={3}
                    placeholder="Quer deixar uma anotação?"
                  />
                  <span className={styles.counter}>{observacao.length}/2000</span>
                </label>

                <p className={styles.formHint}>
                  Este registro não abre um chat nem envia mensagens automaticamente.
                </p>
                {erroSentimento && (
                  <p className={styles.formError} role="alert">
                    {erroSentimento}
                  </p>
                )}
                {sucessoSentimento && (
                  <p className={styles.formSuccess} role="status">
                    <CheckCircle2 size={14} /> {sucessoSentimento}
                  </p>
                )}
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={enviandoSentimento}
                >
                  {enviandoSentimento && <Loader2 size={14} className="animate-spin" />}
                  {enviandoSentimento ? "Registrando..." : "Atualizar sentimento"}
                </button>
              </form>
            </article>
          </div>

          <div className={styles.historyGrid}>
            <section className={styles.historyCard} aria-labelledby="pastoral-care-history-title">
              <div className={styles.historyHeader}>
                <div>
                  <h3 id="pastoral-care-history-title">Pedidos de atendimento</h3>
                  <p>Seu histórico, do mais recente ao mais antigo.</p>
                </div>
                <span className={styles.historyCount}>{atendimentos.length}</span>
              </div>

              {erroCancelamento && (
                <p className={styles.formError} role="alert">
                  {erroCancelamento}
                </p>
              )}
              {sucessoCancelamento && (
                <p className={styles.formSuccess} role="status">
                  <CheckCircle2 size={14} /> {sucessoCancelamento}
                </p>
              )}

              {atendimentosVisiveis.length ? (
                <div className={styles.historyList}>
                  {atendimentosVisiveis.map((atendimento) => {
                    const aguardando = aguardandoConfirmacao(atendimento);
                    return (
                      <article className={styles.historyItem} key={atendimento.id}>
                        <div className={styles.historyItemTop}>
                          <div>
                            <strong>{atendimento.tipo || "Atendimento pastoral"}</strong>
                            <span>{formatarData(atendimento.data_atendimento)}</span>
                          </div>
                          <span className={`${styles.status} ${classeStatus(atendimento.status)}`}>
                            {rotuloAtendimento(atendimento)}
                          </span>
                        </div>
                        {atendimento.motivo && (
                          <p className={styles.historyReason}>{atendimento.motivo}</p>
                        )}
                        <dl className={styles.detailGrid}>
                          <div>
                            <dt>Pastor</dt>
                            <dd>{atendimento.pastor_responsavel || RESPONSAVEL_PENDENTE}</dd>
                          </div>
                          <div>
                            <dt>Horário</dt>
                            <dd>
                              <Clock3 size={12} aria-hidden="true" />
                              {formatarHora(atendimento.hora_atendimento)}
                            </dd>
                          </div>
                          <div>
                            <dt>Status</dt>
                            <dd>{rotuloAtendimento(atendimento)}</dd>
                          </div>
                        </dl>
                        <p className={styles.statusExplanation}>{explicacaoAtendimento(atendimento)}</p>

                        {atendimento.status === STATUS_ATENDIMENTO[0] && (
                          <div className={styles.cancelArea}>
                            {confirmarCancelamento === atendimento.id ? (
                              <div className={styles.cancelConfirmation} role="group" aria-label="Confirmar cancelamento">
                                <span>Cancelar este pedido?</span>
                                <button
                                  type="button"
                                  className={styles.dangerButton}
                                  onClick={() => void cancelarAtendimento(atendimento.id)}
                                  disabled={cancelandoId === atendimento.id}
                                >
                                  {cancelandoId === atendimento.id ? (
                                    <Loader2 size={13} className="animate-spin" />
                                  ) : (
                                    <Check size={13} />
                                  )}
                                  Sim, cancelar
                                </button>
                                <button
                                  type="button"
                                  className={styles.quietButton}
                                  onClick={() => setConfirmarCancelamento(null)}
                                  disabled={cancelandoId === atendimento.id}
                                >
                                  <X size={13} /> Manter pedido
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className={styles.cancelButton}
                                onClick={() => {
                                  setErroCancelamento("");
                                  setConfirmarCancelamento(atendimento.id);
                                }}
                                disabled={Boolean(cancelandoId)}
                              >
                                Cancelar pedido
                              </button>
                            )}
                          </div>
                        )}
                        {aguardando && (
                          <p className={styles.pendingNote}>
                            O pastor ainda não foi atribuído a este pedido.
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.emptyHistory}>
                  Você ainda não registrou um pedido de atendimento.
                </p>
              )}

              {totalPaginasAtendimento > 1 && (
                <nav className={styles.pagination} aria-label="Paginação dos pedidos de atendimento">
                  <button
                    type="button"
                    onClick={() => setPaginaAtendimento((pagina) => Math.max(1, pagina - 1))}
                    disabled={paginaAtendimentoAtual === 1}
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <span>
                    Página {paginaAtendimentoAtual} de {totalPaginasAtendimento}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPaginaAtendimento((pagina) =>
                        Math.min(totalPaginasAtendimento, pagina + 1),
                      )
                    }
                    disabled={paginaAtendimentoAtual === totalPaginasAtendimento}
                  >
                    Próxima <ChevronRight size={14} />
                  </button>
                </nav>
              )}
            </section>

            <section className={styles.historyCard} aria-labelledby="pastoral-care-emotion-history-title">
              <div className={styles.historyHeader}>
                <div>
                  <h3 id="pastoral-care-emotion-history-title">Histórico de sentimentos</h3>
                  <p>Suas atualizações ao longo do tempo.</p>
                </div>
                <span className={styles.historyCount}>{registros.length}</span>
              </div>

              {registrosVisiveis.length ? (
                <div className={styles.historyList}>
                  {registrosVisiveis.map((registro) => (
                    <article className={styles.emotionHistoryItem} key={registro.id}>
                      <span className={styles.historyEmoji} aria-hidden="true">
                        {ICONE_EMOCAO[registro.emoji as (typeof EMOCOES)[number]] || "💬"}
                      </span>
                      <div className={styles.emotionHistoryText}>
                        <div className={styles.emotionHistoryTop}>
                          <strong>{registro.emoji}</strong>
                          <time dateTime={registro.created_at}>
                            {formatarDataHora(registro.created_at)}
                          </time>
                        </div>
                        <p>{registro.observacao || "Sem observação."}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyHistory}>
                  Seu histórico de sentimentos aparecerá aqui.
                </p>
              )}

              {totalPaginasEmocional > 1 && (
                <nav className={styles.pagination} aria-label="Paginação do histórico de sentimentos">
                  <button
                    type="button"
                    onClick={() => setPaginaEmocional((pagina) => Math.max(1, pagina - 1))}
                    disabled={paginaEmocionalAtual === 1}
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <span>
                    Página {paginaEmocionalAtual} de {totalPaginasEmocional}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPaginaEmocional((pagina) =>
                        Math.min(totalPaginasEmocional, pagina + 1),
                      )
                    }
                    disabled={paginaEmocionalAtual === totalPaginasEmocional}
                  >
                    Próxima <ChevronRight size={14} />
                  </button>
                </nav>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default PastoralCareCard;
