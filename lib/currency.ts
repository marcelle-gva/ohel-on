export function formatCurrencyInput(value: string): string {
  const isNegative = value.trimStart().startsWith("-");
  const digits = value.replace(/\D/g, "");

  if (!digits) return isNegative ? "-" : "";

  const amount = Number(digits) / 100;
  const formatted = amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return isNegative ? `-${formatted}` : formatted;
}

export function parseCurrencyInput(value: string): number {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;

  const amount = Number(digits) / 100;
  return value.trimStart().startsWith("-") ? -amount : amount;
}

export function formatCurrency(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
