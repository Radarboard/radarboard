import type { LlmAdapter, LlmMessage } from "@radarboard/llm/types";
import { describe, expect, it, vi } from "vitest";
import { formatSummarySection, summarizeDroppedMessages } from "./conversation-summarizer";

function buildMessage(id: string, text: string, role: "user" | "assistant" = "user"): LlmMessage {
  return {
    id,
    role,
    createdAt: new Date("2026-03-27T00:00:00.000Z"),
    parts: [{ type: "text", text }],
  };
}

describe("conversation summarizer", () => {
  it("returns null when there is not enough content to summarize", async () => {
    const adapter: LlmAdapter = {
      streamChat: vi.fn(),
      generateText: vi.fn(),
      embed: vi.fn(),
    };

    const result = await summarizeDroppedMessages(
      [buildMessage("1", "short"), buildMessage("2", "tiny"), buildMessage("3", "brief")],
      adapter,
      {
        providerId: "anthropic",
        apiKey: "secret",
        model: "claude-haiku",
      }
    );

    expect(result).toBeNull();
    expect(adapter.generateText).not.toHaveBeenCalled();
  });

  it("summarizes dropped messages with a compact transcript request", async () => {
    const adapter: LlmAdapter = {
      streamChat: vi.fn(),
      generateText: vi.fn(async () => ({ text: "User asked about pricing and next steps." })),
      embed: vi.fn(),
    };

    const result = await summarizeDroppedMessages(
      [
        buildMessage("1", "I need help deciding on a pricing plan for the dashboard."),
        buildMessage(
          "2",
          "We compared monthly and annual options with a few tradeoffs.",
          "assistant"
        ),
        buildMessage("3", "We should keep the free tier narrow and document the upsell path."),
      ],
      adapter,
      {
        providerId: "anthropic",
        apiKey: "secret",
        model: "claude-haiku",
      }
    );

    expect(result).toBe("User asked about pricing and next steps.");
    expect(adapter.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: "anthropic",
        apiKey: "secret",
        model: "claude-haiku",
        messages: [
          expect.objectContaining({
            role: "user",
            parts: [
              expect.objectContaining({
                text: expect.stringContaining("[user]: I need help deciding on a pricing plan"),
              }),
            ],
          }),
        ],
      })
    );
  });

  it("returns null when summarization fails and formats summary sections for prompt injection", async () => {
    const adapter: LlmAdapter = {
      streamChat: vi.fn(),
      generateText: vi.fn(async () => {
        throw new Error("provider down");
      }),
      embed: vi.fn(),
    };

    const result = await summarizeDroppedMessages(
      [
        buildMessage("1", "This is a long enough message to count toward summary generation."),
        buildMessage("2", "This is another detailed message with enough content to summarize."),
        buildMessage(
          "3",
          "This third message keeps the transcript well above the minimum threshold."
        ),
      ],
      adapter,
      {
        providerId: "openai",
        apiKey: "secret",
        model: "gpt-4.1-mini",
      }
    );

    expect(result).toBeNull();
    expect(formatSummarySection("Summary body")).toContain("[CONVERSATION HISTORY]");
    expect(formatSummarySection("Summary body")).toContain("Summary body");
  });
});
