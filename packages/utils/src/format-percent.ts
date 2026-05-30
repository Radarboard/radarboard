export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export function calculateChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}
