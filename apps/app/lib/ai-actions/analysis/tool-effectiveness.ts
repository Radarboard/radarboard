/**
 * AI Action: Tool effectiveness tracking.
 *
 * Tracks tool call outcomes (success/failure) and optional
 * user ratings. Used to re-rank tool suggestions over time.
 */

export interface ToolOutcome {
  toolId: string;
  success: boolean;
  rating?: "positive" | "negative";
  timestamp: number;
}

export interface ToolEffectiveness {
  toolId: string;
  totalCalls: number;
  successRate: number;
  positiveRatings: number;
  negativeRatings: number;
  score: number; // Weighted effectiveness score (0-1)
}

const GLOBAL_KEY = "__radarboard_tool_effectiveness__" as const;
const MAX_OUTCOMES = 500;

function getOutcomeStore(): ToolOutcome[] {
  const g = globalThis as unknown as Record<string, ToolOutcome[]>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = [];
  }
  return g[GLOBAL_KEY];
}

export function recordToolOutcome(
  toolId: string,
  success: boolean,
  rating?: "positive" | "negative"
): void {
  const store = getOutcomeStore();

  store.push({ toolId, success, rating, timestamp: Date.now() });

  // Trim to max size (FIFO)
  if (store.length > MAX_OUTCOMES) {
    store.splice(0, store.length - MAX_OUTCOMES);
  }
}

export function getToolEffectiveness(toolId?: string): ToolEffectiveness[] {
  const store = getOutcomeStore();
  const byTool = new Map<string, ToolOutcome[]>();

  for (const outcome of store) {
    if (toolId && outcome.toolId !== toolId) continue;
    const list = byTool.get(outcome.toolId) ?? [];
    list.push(outcome);
    byTool.set(outcome.toolId, list);
  }

  const results: ToolEffectiveness[] = [];

  for (const [id, outcomes] of byTool) {
    const total = outcomes.length;
    const successes = outcomes.filter((o) => o.success).length;
    const positives = outcomes.filter((o) => o.rating === "positive").length;
    const negatives = outcomes.filter((o) => o.rating === "negative").length;

    const successRate = total > 0 ? successes / total : 0;
    const ratingScore = total > 0 ? (positives - negatives) / total : 0;
    const score = Math.round((successRate * 0.6 + ((ratingScore + 1) / 2) * 0.4) * 1000) / 1000;

    results.push({
      toolId: id,
      totalCalls: total,
      successRate: Math.round(successRate * 1000) / 1000,
      positiveRatings: positives,
      negativeRatings: negatives,
      score,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

/** Reset store (for testing). */
export function resetToolEffectiveness(): void {
  const g = globalThis as unknown as Record<string, undefined>;
  g[GLOBAL_KEY] = undefined;
}
