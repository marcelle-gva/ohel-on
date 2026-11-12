export const MESES_DO_ANO = [
  { numero: "01", nome: "Janeiro" },
  { numero: "02", nome: "Fevereiro" },
  { numero: "03", nome: "Março" },
  { numero: "04", nome: "Abril" },
  { numero: "05", nome: "Maio" },
  { numero: "06", nome: "Junho" },
  { numero: "07", nome: "Julho" },
  { numero: "08", nome: "Agosto" },
  { numero: "09", nome: "Setembro" },
  { numero: "10", nome: "Outubro" },
  { numero: "11", nome: "Novembro" },
  { numero: "12", nome: "Dezembro" },
] as const;

export interface ContaResumoMensal {
  id: string;
  descricao: string;
  valor: number | string;
  data_vencimento: string;
  status: string;
}

export function calcularResumoMensal(
  contas: ContaResumoMensal[],
  periodo: string,
) {
  const contasDoMes = contas
    .filter((conta) => conta.data_vencimento?.startsWith(periodo))
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
  const totalPrevisto = contasDoMes.reduce(
    (total, conta) => total + Number(conta.valor || 0),
    0,
  );
  const totalPago = contasDoMes
    .filter((conta) => conta.status === "Pago")
    .reduce((total, conta) => total + Number(conta.valor || 0), 0);
  const totalEmAberto = contasDoMes
    .filter((conta) => conta.status !== "Pago")
    .reduce((total, conta) => total + Number(conta.valor || 0), 0);
  const maiorConta = Math.max(
    0,
    ...contasDoMes.map((conta) => Number(conta.valor || 0)),
  );

  return {
    contasDoMes,
    quantidade: contasDoMes.length,
    totalPrevisto,
    totalPago,
    totalEmAberto,
    maiorConta,
  };
}

export function obterPeriodoAtualSaoPaulo(agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(agora);
  const ano = partes.find((parte) => parte.type === "year")?.value;
  const mes = partes.find((parte) => parte.type === "month")?.value;
  return `${ano}-${mes}`;
}
