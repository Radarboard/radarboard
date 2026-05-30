/**
 * Converts between @radarboard/llm message types and AI SDK model message types.
 *
 * This is the seam that gets replaced when switching to a different adapter.
 * No AI SDK types leak outside this file.
 */
import type { LlmMessage, LlmTextPart } from "@radarboard/llm/types";
import type { ModelMessage } from "ai";

// ---------------------------------------------------------------------------
// Our message → AI SDK ModelMessage (for streamText input)
// ---------------------------------------------------------------------------

/** Convert an array of LlmMessages into the format AI SDK's streamText expects. */
export function convertFromLlmMessages(messages: LlmMessage[]): ModelMessage[] {
  const result: ModelMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") continue;

    const textParts = msg.parts.filter((p): p is LlmTextPart => p.type === "text");
    const content = textParts.map((p) => p.text).join("");

    if (msg.role === "user") {
      result.push({ role: "user", content });
    } else if (msg.role === "assistant") {
      result.push({ role: "assistant", content });
    }
    // tool messages need more complex handling — skipping for now
  }

  return result;
}

// ---------------------------------------------------------------------------
// AI SDK response → Our LlmMessage (for returning to the client)
// ---------------------------------------------------------------------------

interface AiSdkResponseInput {
  id: string;
  role: "assistant";
  text: string;
}

/** Convert an AI SDK response into our LlmMessage format. */
export function convertToLlmMessage(input: AiSdkResponseInput): LlmMessage {
  return {
    id: input.id,
    role: input.role,
    parts: [{ type: "text", text: input.text }],
    createdAt: new Date(),
  };
}
