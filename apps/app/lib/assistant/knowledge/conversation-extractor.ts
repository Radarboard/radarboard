/**
 * Conversation extractor — runs after each session to distill facts,
 * decisions, corrections, and strategic context into persistent memory.
 *
 * Uses the already-configured LLM provider (no new infrastructure).
 * Extracted memories are stored via MemoryService and recalled semantically
 * in future sessions.
 */

import { createLanguageModel } from "@radarboard/llm-adapter-vercel/provider-factory";
import type { LlmMessageRow, LlmRepository } from "@radarboard/types/database";
import { generateText } from "ai";
import { MemoryService } from "./memory-service";

export interface ExtractionResult {
  extracted: number;
  skipped: boolean;
  reason?: string;
}

interface ExtractedMemory {
  key: string;
  value: string;
  projectSlug: string | null;
}

const EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting durable, high-value facts from conversations.

Your job is to read a conversation between a user and an AI advisor, then extract facts worth remembering for future sessions.

Focus on what the USER said — their statements are ground truth. Ignore the AI's responses unless the user corrected them (corrections are valuable signal).

Extract facts in these categories:
1. **Business metrics**: Any number the user mentioned (revenue, MRR, downloads, DAU, conversion rate, churn, CAC, LTV, etc.)
2. **Strategic context**: What the user is trying to achieve, constraints (time, money, energy), what they value most
3. **Decisions**: Choices the user made or is planning to make ("I'm going to...", "we decided to...", "I'm cutting...")
4. **Corrections**: Things the user said were wrong in the AI's responses — these are critical signal
5. **Project facts**: What each project does, who the users are, business model, current stage, main challenge
6. **Priorities and focus**: What the user explicitly said matters most right now
7. **What's working / not working**: Patterns the user has observed in their own data

Rules:
- Be specific. "User's MRR is $3,200" not "User mentioned revenue"
- Include the project slug when a fact is clearly about one project
- Skip generic/obvious statements — only extract durable facts
- If the user corrected the AI, start the key with "CORRECTION: "
- 3–10 memories per conversation is the right range; don't over-extract

Return ONLY valid JSON, no markdown, no explanation:
{
  "memories": [
    { "key": "short label", "value": "specific fact with context", "projectSlug": "slug-or-null" }
  ]
}`;

function buildExtractionPrompt(messages: LlmMessageRow[]): string {
  const lines: string[] = [];

  for (const msg of messages) {
    const role = msg.role === "user" ? "USER" : "AI";
    let text = "";
    try {
      const parts = JSON.parse(msg.parts) as Array<{ type: string; text?: string }>;
      text = parts
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text)
        .join(" ")
        .trim();
    } catch {
      text = msg.parts;
    }
    if (text) {
      lines.push(`${role}: ${text}`);
    }
  }

  return lines.join("\n\n");
}

function parseMemories(raw: string): ExtractedMemory[] {
  try {
    // Strip markdown code fences if the model wrapped its JSON
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const parsed = JSON.parse(cleaned) as { memories?: unknown[] };
    if (!Array.isArray(parsed.memories)) return [];

    return parsed.memories
      .filter(
        (m): m is { key: string; value: string; projectSlug: string | null } =>
          typeof m === "object" &&
          m !== null &&
          typeof (m as Record<string, unknown>).key === "string" &&
          typeof (m as Record<string, unknown>).value === "string"
      )
      .map((m) => ({
        key: m.key.trim(),
        value: m.value.trim(),
        projectSlug: typeof m.projectSlug === "string" ? m.projectSlug : null,
      }));
  } catch {
    return [];
  }
}

export async function extractConversationMemories(
  conversationId: string,
  repo: LlmRepository,
  providerId: string,
  apiKey: string,
  modelId: string,
  embedFn: (text: string) => Promise<number[]>,
  extractionSystemPrompt?: string
): Promise<ExtractionResult> {
  const messages = await repo.getMessages(conversationId);

  // Require at least 3 user messages — less than that is a shallow exchange
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length < 3) {
    return { extracted: 0, skipped: true, reason: "too few user messages" };
  }

  const conversationText = buildExtractionPrompt(messages);
  if (!conversationText.trim()) {
    return { extracted: 0, skipped: true, reason: "empty conversation" };
  }

  const model = createLanguageModel({ providerId, apiKey, modelId });

  const { text } = await generateText({
    model,
    system: extractionSystemPrompt?.trim() || EXTRACTION_SYSTEM_PROMPT,
    prompt: `Extract memories from this conversation:\n\n${conversationText}`,
    temperature: 0.1, // Low temperature — we want consistent, factual extraction
    maxOutputTokens: 1500,
  });

  const memories = parseMemories(text);
  if (memories.length === 0) {
    return { extracted: 0, skipped: false };
  }

  const memoryService = new MemoryService(repo, embedFn);

  // Store all memories in parallel
  await Promise.all(memories.map((m) => memoryService.remember(m.key, m.value, m.projectSlug)));

  return { extracted: memories.length, skipped: false };
}
