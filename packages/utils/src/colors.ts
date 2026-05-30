export const PROJECT_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#6366f1", // indigo
] as const;

export function getProjectColor(index: number): string {
  return PROJECT_COLORS[index % PROJECT_COLORS.length] ?? PROJECT_COLORS[0];
}
