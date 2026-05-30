/**
 * AI Action: Conversation memory — persists key insights across conversations.
 *
 * Stores insights (anomalies found, actions taken, preferences) in
 * a per-dashboard in-memory store. On conversation start, relevant
 * memories are injected into the system prompt.
 */

export interface ConversationInsight {
  id: string;
  key: string;
  value: string;
  category: "anomaly" | "action" | "preference" | "finding";
  createdAt: number;
}

const GLOBAL_KEY = "__radarboard_conversation_memory__" as const;
const MAX_INSIGHTS = 100;
let insertionCounter = 0;

function getInsightStore(): Map<string, ConversationInsight> {
  const g = globalThis as unknown as Record<string, Map<string, ConversationInsight>>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map();
  }
  return g[GLOBAL_KEY];
}

export function saveInsight(
  key: string,
  value: string,
  category: ConversationInsight["category"]
): ConversationInsight {
  const store = getInsightStore();

  // Evict oldest if at capacity
  if (store.size >= MAX_INSIGHTS) {
    const oldest = Array.from(store.values()).sort((a, b) => a.createdAt - b.createdAt)[0];
    if (oldest) store.delete(oldest.id);
  }

  // Use counter suffix to ensure strict ordering even within the same ms
  insertionCounter += 1;
  const insight: ConversationInsight = {
    id: crypto.randomUUID(),
    key,
    value,
    category,
    createdAt: Date.now() + insertionCounter * 0.001,
  };
  store.set(insight.id, insight);
  return insight;
}

export function recallInsights(
  category?: ConversationInsight["category"],
  limit = 20
): ConversationInsight[] {
  const store = getInsightStore();
  let insights = Array.from(store.values());

  if (category) {
    insights = insights.filter((i) => i.category === category);
  }

  return insights.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export function deleteInsight(id: string): boolean {
  return getInsightStore().delete(id);
}

/** Reset store (for testing). */
export function resetConversationMemory(): void {
  const g = globalThis as unknown as Record<string, undefined>;
  g[GLOBAL_KEY] = undefined;
  insertionCounter = 0;
}
