/**
 * Format a number as currency.
 *
 * Uses Intl.NumberFormat for correct currency symbols ($ for USD, CA$ for CAD, etc.).
 * Compact mode abbreviates large values (e.g. $1.2M, CA$3.5K).
 */
export function formatCurrency(
  value: number,
  currency = "USD",
  options?: { compact?: boolean }
): string {
  if (options?.compact) {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });

    // Extract the currency symbol from a formatted zero value
    const parts = formatter.formatToParts(0);
    const symbol = parts
      .filter((p) => p.type === "currency" || p.type === "literal")
      .map((p) => p.value)
      .join("")
      .trim();

    // Threshold on magnitude so negatives compact too, and place the sign before
    // the symbol (e.g. -$5.0K) to match Intl's non-compact formatting.
    const magnitude = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (magnitude >= 1_000_000) {
      return `${sign}${symbol}${(magnitude / 1_000_000).toFixed(1)}M`;
    }
    if (magnitude >= 1_000) {
      return `${sign}${symbol}${(magnitude / 1_000).toFixed(1)}K`;
    }
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}
