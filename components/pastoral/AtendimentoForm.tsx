"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  ChangeEvent,
  FormEvent,
} from "react";
import { ArrowLeft, Calendar, FileText, Lock, Loader2, Save, User, Users } from "lucide-react";
import { useAccess } from "@/components/layout/AccessShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { Input } from "@/components/ui/Input";
import { podeAcessar } from "@/lib/access";
import {
  RESPONSAVEL_PENDENTE,
  STATUS_ATENDIMENTO,
  TIPOS_ATENDIMENTO,
  type AtendimentoEquipe,
} from "@/lib/pastoral-care";
import {
  atualizarAtendimento,
  criarAtendimento,
  obterAtendimento,
  obterAtendimentoOpcoes,
  mensagemPastoral,
  requisicaoAbortada,
  type AtendimentoOpcoes,
  type AtendimentoPayload,
} from "@/components/pastoral/api";

interface AtendimentoFormProps {
  mode: "novo" | "editar";
  id?: string;
}

type TipoAtendimento = (typeof TIPOS_ATENDIMENTO)[number];
type StatusAtendimento = (typeof STATUS_ATENDIMENTO)[number];
type PessoaAtendida = "Membro" | "Visitante";

type FormState = {
  membro_id: string;
  nome_visitante: string;
  pastor_responsavel: string;
  data_atendimento: string;
  hora_atendimento: string;
  tipo: TipoAtendimento;
  motivo: string;
  observacoes: string;
  status: StatusAtendimento;
};

const FORM_ID_PREFIX = "atendimento-form";

function hojeLocal() {
  return new Date().toISOString().slice(0, 10);
}

function formularioInicial(): FormState {
  return {
    membro_id: "",
    nome_visitante: "",
    pastor_responsavel: "",
    data_atendimento: hojeLocal(),
    hora_atendimento: "14:00",
    tipo: "Aconselhamento",
    motivo: "",
    observacoes: "",
    status: "Agendado",
  };
}

function valorStatus(value: string | null): StatusAtendimento {
  return STATUS_ATENDIMENTO.includes(value as StatusAtendimento)
    ? (value as StatusAtendimento)
    : "Agendado";
}

function valorTipo(value: string | null): TipoAtendimento {
  return TIPOS_ATENDIMENTO.includes(value as TipoAtendimento)
    ? (value as TipoAtendimento)
    : "Aconselhamento";
}

function pessoaDoAtendimento(atendimento: AtendimentoEquipe) {
  return atendimento.membros?.nome || atendimento.nome_visitante || "Pessoa não informada";
}

export function AtendimentoForm({ mode, id }: AtendimentoFormProps) {
  const router = useRouter();
  const contexto = useAccess();
  const podeLer = Boolean(contexto && podeAcessar(contexto, "gabinete", "ler"));
  const podeSalvar = Boolean(
    podeLer && contexto && podeAcessar(contexto, "gabinete", mode === "novo" ? "criar" : "editar"),
  );
  const formId = `${FORM_ID_PREFIX}-${mode}`;
  const [formData, setFormData] = useState<FormState>(formularioInicial);
  const [tipoPessoa, setTipoPessoa] = useState<PessoaAtendida>("Membro");
  const [opcoes, setOpcoes] = useState<AtendimentoOpcoes | null>(null);
  const [atendimento, setAtendimento] = useState<AtendimentoEquipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [modal, setModal] = useState({
    isOpen: false,
    type: "success" as "success" | "error",
    title: "",
    message: "",
  });
  const statusOriginal = useRef<string | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const carregar = async () => {
      setLoading(true);
      setErroCarregamento("");
      try {
        const dadosOpcoes = await obterAtendimentoOpcoes(controller.signal);
        if (controller.signal.aborted) return;
        setOpcoes(dadosOpcoes);

        if (mode === "editar") {
          if (!id) throw new Error("Identificador do atendimento ausente.");
          const dadosAtendimento = await obterAtendimento(id, controller.signal);
          if (controller.signal.aborted) return;
          setAtendimento(dadosAtendimento);
          statusOriginal.current = dadosAtendimento.status;
          setTipoPessoa(dadosAtendimento.membro_id ? "Membro" : "Visitante");
          setFormData({
            membro_id: dadosAtendimento.membro_id || "",
            nome_visitante: dadosAtendimento.nome_visitante || "",
            pastor_responsavel: dadosAtendimento.pastor_responsavel || "",
            data_atendimento: dadosAtendimento.data_atendimento || hojeLocal(),
            hora_atendimento: dadosAtendimento.hora_atendimento || "",
            tipo: valorTipo(dadosAtendimento.tipo),
            motivo: dadosAtendimento.motivo || "",
            observacoes: dadosAtendimento.observacoes || "",
            status: valorStatus(dadosAtendimento.status),
          });
        } else {
          const pastorDoUsuario = dadosOpcoes.pastores.find(
            (pastor) => pastor.nome === contexto?.membro?.nome,
          );
          if (pastorDoUsuario) {
            setFormData((atual) => ({
              ...atual,
              pastor_responsavel: pastorDoUsuario.nome,
            }));
          }
        }
      } catch (error) {
        if (requisicaoAbortada(error) || controller.signal.aborted) return;
        setErroCarregamento(
          mensagemPastoral(
            error,
            mode === "editar"
              ? "Não foi possível carregar o atendimento. Tente novamente."
              : "Não foi possível carregar as opções do formulário. Tente novamente.",
          ),
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void carregar();
    return () => controller.abort();
  }, [contexto?.membro?.nome, id, mode, tentativa]);

  useEffect(() => () => {
    if (redirectTimer.current) clearTimeout(redirectTimer.current);
  }, []);

  const statusTerminal =
    mode === "editar" &&
    (atendimento?.status === "Realizado" || atendimento?.status === "Cancelado");

  const pastores = useMemo(() => {
    const lista = opcoes?.pastores || [];
    if (
      formData.pastor_responsavel &&
      !lista.some((pastor) => pastor.nome === formData.pastor_responsavel) &&
      formData.pastor_responsavel !== RESPONSAVEL_PENDENTE
    ) {
      return [
        {
          id: `atual-${formData.pastor_responsavel}`,
          nome: formData.pastor_responsavel,
          cargo: null,
        },
        ...lista,
      ];
    }
    return lista;
  }, [formData.pastor_responsavel, opcoes?.pastores]);

  const atualizarCampo = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.currentTarget;
    setFormData((atual) => ({ ...atual, [name]: value } as FormState));
  };

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!podeSalvar) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Permissão necessária",
        message: "Você não tem permissão para salvar atendimentos neste módulo.",
      });
      return;
    }
    if (mode === "editar" && (!id || !atendimento)) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Atendimento indisponível",
        message: "Carregue o atendimento novamente antes de salvar.",
      });
      return;
    }
    if (mode === "novo" && tipoPessoa === "Membro" && !formData.membro_id) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Pessoa atendida obrigatória",
        message: "Selecione o membro que será atendido.",
      });
      return;
    }
    if (mode === "novo" && tipoPessoa === "Visitante" && !formData.nome_visitante.trim()) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Pessoa atendida obrigatória",
        message: "Informe o nome do visitante.",
      });
      return;
    }

    const payload: AtendimentoPayload = {
      pastor_responsavel: formData.pastor_responsavel,
      data_atendimento: formData.data_atendimento,
      hora_atendimento: formData.hora_atendimento || null,
      tipo: formData.tipo,
      motivo: formData.motivo.trim() || null,
      observacoes: formData.observacoes.trim() || null,
      status: formData.status,
    };
    if (mode === "novo") {
      payload.membro_id = tipoPessoa === "Membro" ? formData.membro_id : null;
      payload.nome_visitante = tipoPessoa === "Visitante" ? formData.nome_visitante.trim() : null;
    } else {
      payload.status_anterior = statusOriginal.current;
    }

    setSaving(true);
    try {
      if (mode === "novo") {
        await criarAtendimento(payload);
      } else {
        await atualizarAtendimento(id as string, payload);
      }
      setModal({
        isOpen: true,
        type: "success",
        title: "Sucesso",
        message: mode === "novo" ? "Atendimento registrado com sucesso!" : "Atendimento atualizado com sucesso!",
      });
      redirectTimer.current = setTimeout(() => router.push("/gabinete/atendimentos"), 900);
    } catch (error) {
      setModal({
        isOpen: true,
        type: "error",
        title: mode === "novo" ? "Erro ao registrar" : "Erro ao atualizar",
        message: mensagemPastoral(
          error,
          mode === "novo"
            ? "Não foi possível registrar o atendimento. Tente novamente."
            : "Não foi possível atualizar o atendimento. Tente novamente.",
        ),
      });
      setSaving(false);
    }
  };

  const titulo = mode === "novo" ? "Novo Atendimento" : "Editar Atendimento";
  const subtitulo = mode === "novo"
    ? "Agende ou registre um aconselhamento pastoral."
    : "Atualize a agenda, o responsável e as anotações do atendimento.";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-10">
      <FeedbackModal
        isOpen={modal.isOpen}
        onClose={() => setModal((atual) => ({ ...atual, isOpen: false }))}
        type={modal.type}
        title={modal.title}
        message={modal.message}
      />

      <div className="mb-2 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="flex items-center gap-3">
          <Link href="/gabinete/atendimentos" className="mt-0.5 text-gray-400 transition-colors hover:text-white" aria-label="Voltar aos atendimentos">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">{titulo}</h1>
            <p className="mt-0.5 text-xs text-gray-400">{subtitulo}</p>
          </div>
        </div>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          disabled={loading || saving || !podeSalvar}
          className="w-auto px-6 py-2 text-xs"
        >
          <Save className="mr-1.5 h-3.5 w-3.5" /> {saving ? "Salvando..." : mode === "novo" ? "Salvar Atendimento" : "Salvar Alterações"}
        </Button>
      </div>

      {erroCarregamento && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between">
          <span>{erroCarregamento}</span>
          <button type="button" onClick={() => setTentativa((valor) => valor + 1)} className="shrink-0 rounded-md border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-500/20">Tentar novamente</button>
        </div>
      )}

      <Card className="p-6">
        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando atendimento...
          </div>
        ) : erroCarregamento || (mode === "editar" && !atendimento) ? (
          <div className="py-8 text-center text-sm text-gray-400">Não foi possível abrir o formulário.</div>
        ) : (
          <form id={formId} onSubmit={enviar} className="flex flex-col gap-6">
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ohel-blue">
                <Calendar className="h-3.5 w-3.5" /> Informações do Atendimento
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label htmlFor={`${formId}-pastor`} className="text-[10px] font-semibold uppercase text-ohel-silver">Pastor / Responsável *</label>
                  <select id={`${formId}-pastor`} name="pastor_responsavel" value={formData.pastor_responsavel} onChange={atualizarCampo} required className="input-ohel w-full rounded-md px-3 py-2 text-xs">
                    <option value="">Selecione o Pastor...</option>
                    {pastores.map((pastor) => <option key={pastor.id} value={pastor.nome}>{pastor.nome}{pastor.cargo ? ` (${pastor.cargo})` : ""}</option>)}
                    <option value={RESPONSAVEL_PENDENTE}>Aguardando confirmação</option>
                  </select>
                </div>
                <Input label="Data *" type="date" name="data_atendimento" value={formData.data_atendimento} onChange={atualizarCampo} required className="py-2 text-xs" />
                <Input label="Hora" type="time" name="hora_atendimento" value={formData.hora_atendimento} onChange={atualizarCampo} className="py-2 text-xs" />

                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label htmlFor={`${formId}-tipo`} className="text-[10px] font-semibold uppercase text-ohel-silver">Tipo de Atendimento *</label>
                  <select id={`${formId}-tipo`} name="tipo" value={formData.tipo} onChange={atualizarCampo} required className="input-ohel w-full rounded-md px-3 py-2 text-xs">
                    {TIPOS_ATENDIMENTO.map((tipo) => <option key={tipo} value={tipo}>{tipo === "Oração" ? "Oração / Intercessão" : tipo === "Visita" ? "Visita Domiciliar" : tipo}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label htmlFor={`${formId}-status`} className="text-[10px] font-semibold uppercase text-ohel-silver">Status *</label>
                  <select id={`${formId}-status`} name="status" value={formData.status} onChange={atualizarCampo} required disabled={statusTerminal} className="input-ohel w-full rounded-md px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60">
                    {STATUS_ATENDIMENTO.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  {statusTerminal && <p className="text-[10px] text-gray-500">Estados Realizado e Cancelado são finais; anotações continuam editáveis.</p>}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-5">
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ohel-blue">
                <User className="h-3.5 w-3.5" /> Pessoa Atendida
              </h3>
              {mode === "editar" && atendimento ? (
                <div className="rounded-md border border-gray-800 bg-ohel-bg px-3 py-3">
                  <p className="text-sm font-medium text-white">{pessoaDoAtendimento(atendimento)}</p>
                  <p className="mt-1 text-[10px] text-gray-500">A pessoa atendida não pode ser alterada durante a edição.</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex w-full gap-2 rounded-lg border border-gray-800 bg-ohel-bg p-1.5 md:w-fit">
                    <button type="button" onClick={() => { setTipoPessoa("Membro"); setFormData((atual) => ({ ...atual, nome_visitante: "" })); }} className={`flex items-center gap-2 rounded-md px-6 py-1.5 text-xs font-bold transition-colors ${tipoPessoa === "Membro" ? "bg-ohel-blue text-white" : "text-gray-400 hover:text-white"}`}>
                      <Users className="h-3.5 w-3.5" /> Membro
                    </button>
                    <button type="button" onClick={() => { setTipoPessoa("Visitante"); setFormData((atual) => ({ ...atual, membro_id: "" })); }} className={`flex items-center gap-2 rounded-md px-6 py-1.5 text-xs font-bold transition-colors ${tipoPessoa === "Visitante" ? "bg-purple-500 text-white" : "text-gray-400 hover:text-white"}`}>
                      <User className="h-3.5 w-3.5" /> Visitante
                    </button>
                  </div>
                  {tipoPessoa === "Membro" ? (
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`${formId}-membro`} className="text-[10px] font-semibold uppercase text-ohel-silver">Selecione o Membro *</label>
                      <select id={`${formId}-membro`} name="membro_id" value={formData.membro_id} onChange={atualizarCampo} required className="input-ohel w-full rounded-md px-3 py-2 text-xs">
                        <option value="">Selecione um membro...</option>
                        {(opcoes?.membros || []).map((membro) => <option key={membro.id} value={membro.id}>{membro.nome}{membro.cargo ? ` (${membro.cargo})` : ""}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={`${formId}-visitante-cadastrado`} className="text-[10px] font-semibold uppercase text-ohel-silver">Buscar Visitante Cadastrado</label>
                        <select id={`${formId}-visitante-cadastrado`} value={formData.nome_visitante} onChange={(event) => setFormData((atual) => ({ ...atual, nome_visitante: event.currentTarget.value }))} className="input-ohel w-full rounded-md px-3 py-2 text-xs">
                          <option value="">Selecione um visitante...</option>
                          {(opcoes?.visitantes || []).map((visitante) => <option key={visitante.id} value={visitante.nome}>{visitante.nome}</option>)}
                        </select>
                      </div>
                      <Input label="Ou digite um nome novo *" name="nome_visitante" placeholder="Ex: Maria (visitante)" value={formData.nome_visitante} onChange={atualizarCampo} required className="py-2 text-xs" />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-gray-800 pt-5">
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ohel-blue">
                <FileText className="h-3.5 w-3.5" /> Detalhes do Atendimento
              </h3>
              <div className="flex flex-col gap-3">
                <Input label="Motivo / Assunto Principal" name="motivo" placeholder="Ex: Problemas familiares, orientação financeira..." value={formData.motivo} onChange={atualizarCampo} className="py-2 text-xs" />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${formId}-observacoes`} className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-ohel-silver">
                    <Lock className="h-3 w-3 text-red-400" /> Observações Sigilosas (Apenas Liderança)
                  </label>
                  <textarea id={`${formId}-observacoes`} name="observacoes" value={formData.observacoes} onChange={atualizarCampo} placeholder="Registre aqui os detalhes da conversa, orações realizadas e encaminhamentos..." className="input-ohel min-h-[120px] w-full resize-y rounded-md px-3 py-2 text-xs" />
                  <p className="text-[10px] italic text-gray-500">Essas informações não são exibidas para membros.</p>
                </div>
              </div>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
