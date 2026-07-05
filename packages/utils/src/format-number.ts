export function formatNumber(value: number, options?: { compact?: boolean }): string {
  if (options?.compact) {
    // Threshold on magnitude so negatives compact too; divide the signed value
    // to preserve the sign (e.g. -1_200_000 → "-1.2M").
    const magnitude = Math.abs(value);
    if (magnitude >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (magnitude >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    }
  }

  return new Intl.NumberFormat("en-US").format(value);
}
