// --- Helper to generate sparkline data ---
export function generateSparkline(base: number, count = 14): { date: string; value: number }[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-03-${String(i + 1).padStart(2, "0")}`,
    value: Math.round(base + (Math.random() - 0.4) * base * 0.3),
  }));
}
