import type { LlmMessage } from "@radarboard/llm/types";
import type { AssistantHandoffItem } from "@radarboard/types/assistant";
import type { LlmRepository } from "@radarboard/types/database";
import { buildRuntimeContextParts } from "./tool-evidence";

export function detectTopicSkills(userText: string): string[] {
  if (!userText) return [];
  const lower = userText.toLowerCase();
  const skills: string[] = [];

  if (
    /\bseo\b|search|keyword|ranking|ctr|impression|organic|backlink|content.*optim|google.*search/.test(
      lower
    )
  ) {
    skills.push("growth-advisor");
  }

  if (
    /\brevenue\b|mrr|churn|subscri|pricing|payment|stripe|revenuecat|monetiz|conversion/.test(lower)
  ) {
    skills.push("revenue-analyst");
  }

  if (
    /\berror|deploy|build|incident|outage|uptime|sentry|downtime|crash|bug|500|latency/.test(lower)
  ) {
    skills.push("engineering-health");
  }

  if (/\bpriori|what.*should.*work|focus|roadmap|backlog|next.*step|strategy|decide/.test(lower)) {
    skills.push("prioritization");
  }

  if (
    /\bgrowth|analytics|visitor|traffic|funnel|retention|acquisition|bounce.*rate|user.*journey/.test(
      lower
    )
  ) {
    skills.push("growth-advisor");
  }

  if (/\bseo\b|keyword|search.*console|content.*gap|cannibaliz/.test(lower)) {
    skills.push("seo-expert");
  }
  if (/\banomal|correlat|statistic|z-score|trend|data.*analy/.test(lower)) {
    skills.push("data-analyst");
  }
  if (/\bincident|outage|severity|root.*cause|postmortem|escalat/.test(lower)) {
    skills.push("incident-responder");
  }

  return [...new Set(skills)];
}

interface MemoryServiceLike {
  recall(query: string, limit?: number): Promise<Array<{ key: string; value: string }>>;
}

export async function recallMemories(
  memoryService: MemoryServiceLike,
  query: string,
  limit = 5
): Promise<Array<{ key: string; value: string }>> {
  if (!query) return [];
  try {
    const recalled = await memoryService.recall(query, limit);
    return recalled.map((memory) => ({ key: memory.key, value: memory.value }));
  } catch {
    return [];
  }
}

export async function persistUserMessageWithRuntimeContext(
  llmRepo: LlmRepository,
  conversationId: string,
  lastUser: LlmMessage | undefined,
  attachedRuntimeContextItems: AssistantHandoffItem[]
): Promise<void> {
  if (lastUser?.role !== "user") return;

  const persistedUserParts = [
    ...(Array.isArray(lastUser.parts) ? lastUser.parts : []),
    ...buildRuntimeContextParts(attachedRuntimeContextItems),
  ];

  await llmRepo
    .appendMessage({
      id: crypto.randomUUID(),
      conversationId,
      role: "user",
      parts: JSON.stringify(persistedUserParts),
      createdAt: new Date().toISOString(),
    })
    .catch(() => {
      // Non-critical persistence failure.
    });
}
