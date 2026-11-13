export const TIPOS_ATENDIMENTO = ["Aconselhamento", "Oração", "Visita", "Outros"] as const;
export const EMOCOES = ["Feliz", "Agradecido", "Acolhido", "Ansioso", "Desanimado", "Fragilizado", "Doente", "Sem Amigos", "Sem Esperança"] as const;
export const STATUS_ATENDIMENTO = ["Agendado", "Realizado", "Cancelado"] as const;
// Compatibilidade com o schema atual: solicitação usa Agendado sem um pastor atribuído.
export const RESPONSAVEL_PENDENTE = "Aguardando confirmação";
export interface AtendimentoPessoal {
  id: string;
  pastor_responsavel: string;
  data_atendimento: string;
  hora_atendimento: string | null;
  tipo: string | null;
  motivo: string | null;
  status: string | null;
  created_at: string;
}
export interface AtendimentoEquipe extends AtendimentoPessoal {
  membro_id: string | null;
  nome_visitante: string | null;
  membros: { nome: string } | null;
  observacoes: string | null;
}
export interface RegistroEmocionalPessoal {
  id: string;
  emoji: string;
  observacao: string | null;
  created_at: string;
}
export interface RegistroEmocionalEquipe extends RegistroEmocionalPessoal {
  membro_id: string | null;
  membros: { nome: string } | null;
}
export interface CuidadoPessoalData {
  atendimentos: AtendimentoPessoal[];
  registros: RegistroEmocionalPessoal[];
}
export function aguardandoConfirmacao(atendimento: Pick<AtendimentoPessoal, "status" | "pastor_responsavel">) {
  return atendimento.status === "Agendado" && atendimento.pastor_responsavel === RESPONSAVEL_PENDENTE;
}
export function rotuloAtendimento(atendimento: Pick<AtendimentoPessoal, "status" | "pastor_responsavel">) {
  return aguardandoConfirmacao(atendimento) ? "Aguardando confirmação" : atendimento.status || "Não informado";
}
export function dataValida(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
export function horaValida(value: unknown) {
  return value === null || value === "" || (typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
}
export function idValido(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
// Projeção explícita também protege contra inclusão acidental de campos privados.
export function atendimentoParaMembro(atendimento: AtendimentoPessoal): AtendimentoPessoal {
  return {
    id: atendimento.id,
    pastor_responsavel: atendimento.pastor_responsavel,
    data_atendimento: atendimento.data_atendimento,
    hora_atendimento: atendimento.hora_atendimento,
    tipo: atendimento.tipo,
    motivo: atendimento.motivo,
    status: atendimento.status,
    created_at: atendimento.created_at,
  };
}
