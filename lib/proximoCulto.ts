export interface ProgramacaoCultoFixa {
  nome: string;
  tipo: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  vigencia_desde: string;
}

export interface ProximoCulto {
  nome: string;
  tipo: string;
  data_inicio: string;
  hora_abertura: string;
}

const FUSO = "America/Sao_Paulo";

function partesLocais(data: Date) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(data);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value || "00";
  return {
    ano: valor("year"),
    mes: valor("month"),
    dia: valor("day"),
    hora: valor("hour"),
    minuto: valor("minute"),
    segundo: valor("second"),
  };
}

function chaveLocal(data: Date) {
  const p = partesLocais(data);
  return `${p.ano}-${p.mes}-${p.dia}T${p.hora}:${p.minuto}:${p.segundo}`;
}

function somarDias(dataLocal: string, dias: number) {
  const data = new Date(`${dataLocal}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

function diaSemana(dataLocal: string) {
  return new Date(`${dataLocal}T12:00:00Z`).getUTCDay();
}

export function encontrarProximoCulto(
  programacoes: ProgramacaoCultoFixa[],
  agora = new Date(),
): ProximoCulto | null {
  const agoraLocal = chaveLocal(agora);
  const dataHoje = agoraLocal.slice(0, 10);
  const candidatos: { chave: string; modelo: ProgramacaoCultoFixa }[] = [];

  for (const modelo of programacoes) {
    if (
      !Number.isInteger(modelo.dia_semana) ||
      modelo.dia_semana < 0 ||
      modelo.dia_semana > 6 ||
      !modelo.horario_inicio ||
      !modelo.vigencia_desde
    ) continue;

    const vigenciaLocal = chaveLocal(new Date(modelo.vigencia_desde));
    const primeiraData = vigenciaLocal > agoraLocal
      ? vigenciaLocal.slice(0, 10)
      : dataHoje;
    const primeiroDiaSemana = diaSemana(primeiraData);
    const diasAteProximo = (modelo.dia_semana - primeiroDiaSemana + 7) % 7;
    let dataCulto = somarDias(primeiraData, diasAteProximo);
    let hora = modelo.horario_inicio.slice(0, 8);
    if (hora.length === 5) hora += ":00";

    let chave = `${dataCulto}T${hora}`;
    if (chave <= agoraLocal || chave < vigenciaLocal) {
      dataCulto = somarDias(dataCulto, 7);
      chave = `${dataCulto}T${hora}`;
    }
    candidatos.push({ chave, modelo });
  }

  candidatos.sort((a, b) => a.chave.localeCompare(b.chave));
  const proximo = candidatos[0];
  if (!proximo) return null;
  return {
    nome: proximo.modelo.nome,
    tipo: proximo.modelo.tipo,
    data_inicio: proximo.chave.slice(0, 10),
    hora_abertura: proximo.chave.slice(11, 16),
  };
}
