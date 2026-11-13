export interface TipoCulto {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface CultoModelo {
  id: string;
  nome: string;
  tipo: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  ativo: boolean;
  vigencia_desde: string;
}

export interface ProgramacaoCultoAnual {
  id: string;
  ano: number;
  data_culto: string;
  titulo: string;
  tipo: string;
  horario_inicio: string;
  horario_fim: string;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProgramacaoCultoAnualForm {
  data_culto: string;
  titulo: string;
  tipo: string;
  horario_inicio: string;
  horario_fim: string;
  observacoes: string;
}

export interface ProgramacaoCultoForm {
  nome: string;
  tipo: string;
  dia_semana: string;
  horario_inicio: string;
  horario_fim: string;
}

export const DIAS_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

export function anoAtualAgenda(): string {
  return String(new Date().getFullYear());
}

export function dataAgendaLegivel(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  if (!ano || !mes || !dia) return data;
  return new Intl.DateTimeFormat("pt-BR").format(new Date(ano, mes - 1, dia));
}

export function intervaloValido(inicio: string, fim: string): boolean {
  return Boolean(inicio && fim && fim > inicio);
}
