/**
 * Conversation context summarizer.
 *
 * When message pruning drops many messages, this module produces a concise
 * summary of the dropped content so the assistant retains semantic context
 * without the full token cost.
 *
 * Uses a cheap model (Haiku) for summarization to minimize cost.
 */

import type { LlmAdapter, LlmMessage } from "@radarboard/llm/types";

const SUMMARIZATION_PROMPT = `Summarize the following conversation history in 2-3 concise paragraphs.
Focus on: key questions asked, important data points mentioned, decisions made, and any ongoing tasks.
Do NOT include greetings or meta-commentary. Be factual and dense.`;

/**
 * Summarize a set of dropped messages into a concise context paragraph.
 *
 * @param messages - Messages that were pruned from the conversation
 * @param adapter - LLM adapter instance for generating the summary
 * @param params - Provider/model to use for summarization
 * @returns Summary text, or null if messages are too few to summarize
 */
export async function summarizeDroppedMessages(
  messages: LlmMessage[],
  adapter: LlmAdapter,
  params: {
    providerId: string;
    apiKey: string;
    /** Model to use for summarization. Recommend a cheap/fast model. */
    model: string;
  }
): Promise<string | null> {
  if (messages.length < 3) return null;

  // Build a text representation of the dropped messages
  const transcript = messages
    .map((m) => {
      const textParts = m.parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { text: string }).text)
        .join(" ");
      return `[${m.role}]: ${textParts}`;
    })
    .filter((line) => line.length > 10) // Skip empty/short messages
    .join("\n");

  if (transcript.length < 100) return null; // Not enough content to summarize

  try {
    const result = await adapter.generateText({
      providerId: params.providerId,
      apiKey: params.apiKey,
      model: params.model,
      systemPrompt: SUMMARIZATION_PROMPT,
      messages: [
        {
          id: "summarize-request",
          role: "user",
          parts: [{ type: "text", text: transcript }],
          createdAt: new Date(),
        },
      ],
    });

    return result.text || null;
  } catch {
    // Summarization is best-effort — return null on failure
    return null;
  }
}

/**
 * Format a summary for injection into the system prompt.
 */
export function formatSummarySection(summary: string): string {
  return `[CONVERSATION HISTORY]\nThe following is a summary of earlier conversation that was pruned for context space:\n\n${summary}`;
}
