/**
 * Context window management — token estimation and message pruning.
 *
 * Prevents context overflow by estimating token counts and pruning
 * the oldest messages when the conversation exceeds the model's limit.
 * Keeps the first user message for continuity.
 */

import type { LlmMessage, LlmMessagePart } from "./types";

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/** Rough token estimate per character (English text average). */
const CHARS_PER_TOKEN = 4;

/** Overhead tokens per message (role, formatting). */
const MESSAGE_OVERHEAD = 4;

/** Estimate tokens for a single message part. */
function estimatePartTokens(part: LlmMessagePart): number {
  switch (part.type) {
    case "text":
    case "reasoning":
      return Math.ceil(part.text.length / CHARS_PER_TOKEN);
    case "tool-call":
      return Math.ceil(JSON.stringify(part.input).length / CHARS_PER_TOKEN) + 10;
    case "tool-result":
      return Math.ceil(JSON.stringify(part.output).length / CHARS_PER_TOKEN) + 10;
    case "image":
      // Images use ~85 tokens per tile (768px). Rough estimate for a single image.
      return 300;
    case "runtime-context":
      return Math.ceil((part as { text?: string }).text?.length ?? 0 / CHARS_PER_TOKEN);
    default:
      return 50;
  }
}

/**
 * Estimate the total token count for an array of messages.
 * This is a heuristic — actual token counts depend on the tokenizer.
 */
export function estimateTokens(messages: LlmMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += MESSAGE_OVERHEAD;
    for (const part of msg.parts) {
      total += estimatePartTokens(part);
    }
  }
  return total;
}

/**
 * Estimate tokens for a system prompt string.
 */
export function estimateSystemPromptTokens(systemPrompt: string): number {
  return Math.ceil(systemPrompt.length / CHARS_PER_TOKEN) + MESSAGE_OVERHEAD;
}

// ---------------------------------------------------------------------------
// Message pruning
// ---------------------------------------------------------------------------

export interface PruneResult {
  /** Messages that fit within the budget. */
  messages: LlmMessage[];
  /** Number of messages that were dropped. */
  droppedCount: number;
  /** Estimated tokens after pruning. */
  estimatedTokens: number;
}

/**
 * Prune messages to fit within a token budget.
 *
 * Strategy: drop the oldest messages (except the first user message)
 * until the total estimated tokens fits within `maxTokens`.
 *
 * @param messages - Full conversation messages
 * @param maxTokens - Maximum tokens available for messages
 * @returns Pruned messages + metadata
 */
export function pruneMessages(messages: LlmMessage[], maxTokens: number): PruneResult {
  const currentTokens = estimateTokens(messages);

  if (currentTokens <= maxTokens) {
    return { messages, droppedCount: 0, estimatedTokens: currentTokens };
  }

  // Find the first user message (keep it for context)
  const firstUserIdx = messages.findIndex((m) => m.role === "user");

  // Build a list of droppable message indices (oldest first, skip first user message)
  const droppable: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (i === firstUserIdx) continue;
    // Don't drop the most recent messages — they're the active conversation
    if (i >= messages.length - 2) continue;
    droppable.push(i);
  }

  // Drop messages one at a time from the oldest until we fit
  const dropped = new Set<number>();
  let remaining = currentTokens;

  for (const idx of droppable) {
    if (remaining <= maxTokens) break;
    const parts = messages[idx]?.parts ?? [];
    const msgTokens = MESSAGE_OVERHEAD + parts.reduce((sum, p) => sum + estimatePartTokens(p), 0);
    dropped.add(idx);
    remaining -= msgTokens;
  }

  const pruned = messages.filter((_, i) => !dropped.has(i));

  return {
    messages: pruned,
    droppedCount: dropped.size,
    estimatedTokens: estimateTokens(pruned),
  };
}

/**
 * Calculate the token budget for messages given a model's context window.
 *
 * @param contextWindow - Model's total context window in tokens
 * @param systemPromptTokens - Estimated tokens for the system prompt
 * @param outputReserve - Tokens reserved for the model's response (default: 4096)
 * @returns Available tokens for conversation messages
 */
export function calculateMessageBudget(
  contextWindow: number,
  systemPromptTokens: number,
  outputReserve = 4096
): number {
  return Math.max(0, contextWindow - systemPromptTokens - outputReserve);
}
