export function normalizarCentavos(valor: unknown): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) throw new Error("Valor financeiro inválido.");
    const centavos = Math.round(valor * 100);
    if (!Number.isSafeInteger(centavos)) throw new Error("Valor financeiro fora do limite seguro.");
    return centavos;
  }

  const texto = String(valor).trim().replace(/\s/g, "");
  if (!texto) return 0;
  const sinal = texto.startsWith("-") ? -1 : 1;
  const semSinal = texto.replace(/^[+-]/, "");
  const normalizado = semSinal.includes(",")
    ? semSinal.replace(/\./g, "").replace(",", ".")
    : semSinal;

  if (!/^\d+(?:\.\d+)?$/.test(normalizado)) {
    throw new Error("Valor financeiro inválido.");
  }

  const [inteiro, fracao = ""] = normalizado.split(".");
  const fracaoCentavos = (fracao + "00").slice(0, 2);
  const centavosInteiros = Number(BigInt(inteiro) * BigInt(100) + BigInt(fracaoCentavos));
  const centavos = sinal * centavosInteiros;
  if (!Number.isSafeInteger(centavos)) throw new Error("Valor financeiro fora do limite seguro.");
  return centavos;
}

export function valorPositivoEmCentavos(valor: unknown): number {
  return Math.abs(normalizarCentavos(valor));
}

export function centavosParaReais(centavos: number): number {
  if (!Number.isSafeInteger(centavos)) throw new Error("Centavos financeiros inválidos.");
  return centavos / 100;
}

export function formatarCentavos(centavos: number): string {
  return centavosParaReais(centavos).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
