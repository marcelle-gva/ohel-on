export function getMonthlyDate(date: string, monthsAhead: number, preferredDay?: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const firstOfTargetMonth = new Date(Date.UTC(year, month - 1 + monthsAhead, 1));
  const targetYear = firstOfTargetMonth.getUTCFullYear();
  const targetMonth = firstOfTargetMonth.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(preferredDay || day, lastDay);

  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}
