export function formatNumber(value: number, options?: { compact?: boolean }): string {
  if (options?.compact) {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    }
  }

  return new Intl.NumberFormat("en-US").format(value);
}
