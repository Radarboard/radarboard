import { describe, expect, it } from "vitest";
import {
  calculateMessageBudget,
  estimateSystemPromptTokens,
  estimateTokens,
  pruneMessages,
} from "./context-window";
import type { LlmMessage } from "./types";

function makeMessage(role: "user" | "assistant", text: string, id?: string): LlmMessage {
  return {
    id: id ?? crypto.randomUUID(),
    role,
    parts: [{ type: "text", text }],
    createdAt: new Date(),
  };
}

describe("estimateTokens", () => {
  it("estimates text message tokens", () => {
    const msgs = [makeMessage("user", "Hello world")]; // 11 chars / 4 ≈ 3 + 4 overhead = 7
    const tokens = estimateTokens(msgs);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  it("scales with message length", () => {
    const short = estimateTokens([makeMessage("user", "Hi")]);
    const long = estimateTokens([makeMessage("user", "A".repeat(1000))]);
    expect(long).toBeGreaterThan(short);
  });

  it("handles empty messages", () => {
    expect(estimateTokens([])).toBe(0);
  });

  it("counts tool call parts", () => {
    const msg: LlmMessage = {
      id: "1",
      role: "assistant",
      parts: [
        { type: "tool-call", toolCallId: "tc1", toolName: "get_revenue", input: { range: "30d" } },
      ],
      createdAt: new Date(),
    };
    const tokens = estimateTokens([msg]);
    expect(tokens).toBeGreaterThan(10);
  });
});

describe("estimateSystemPromptTokens", () => {
  it("estimates from string length", () => {
    const tokens = estimateSystemPromptTokens("You are a helpful assistant.");
    expect(tokens).toBeGreaterThan(5);
    expect(tokens).toBeLessThan(20);
  });
});

describe("pruneMessages", () => {
  it("returns all messages when within budget", () => {
    const msgs = [makeMessage("user", "Hello"), makeMessage("assistant", "Hi")];
    const result = pruneMessages(msgs, 10000);
    expect(result.droppedCount).toBe(0);
    expect(result.messages).toHaveLength(2);
  });

  it("drops oldest messages when over budget", () => {
    const msgs = [
      makeMessage("user", `First question ${"A".repeat(500)}`, "first"),
      makeMessage("assistant", `First answer ${"B".repeat(500)}`),
      makeMessage("user", `Second question ${"C".repeat(500)}`),
      makeMessage("assistant", `Second answer ${"D".repeat(500)}`),
      makeMessage("user", "Third question"),
      makeMessage("assistant", "Third answer"),
    ];

    // Set budget to roughly fit 3 messages
    const result = pruneMessages(msgs, 400);
    expect(result.droppedCount).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThan(msgs.length);
  });

  it("keeps the first user message", () => {
    const msgs = [
      makeMessage("user", `Original question ${"A".repeat(200)}`, "first-user"),
      makeMessage("assistant", `Answer ${"B".repeat(200)}`),
      makeMessage("user", `Follow up ${"C".repeat(200)}`),
      makeMessage("assistant", `Response ${"D".repeat(200)}`),
      makeMessage("user", "Latest"),
      makeMessage("assistant", "Latest response"),
    ];

    const result = pruneMessages(msgs, 200);
    const firstUserKept = result.messages.some((m) => m.id === "first-user");
    expect(firstUserKept).toBe(true);
  });

  it("keeps the most recent messages", () => {
    const msgs = [
      makeMessage("user", `Old ${"A".repeat(300)}`),
      makeMessage("assistant", `Old reply ${"B".repeat(300)}`),
      makeMessage("user", "Recent", "recent-user"),
      makeMessage("assistant", "Recent reply", "recent-assistant"),
    ];

    const result = pruneMessages(msgs, 100);
    const recentKept = result.messages.some(
      (m) => m.id === "recent-user" || m.id === "recent-assistant"
    );
    expect(recentKept).toBe(true);
  });
});

describe("calculateMessageBudget", () => {
  it("subtracts system prompt and output reserve", () => {
    const budget = calculateMessageBudget(200_000, 5000, 4096);
    expect(budget).toBe(200_000 - 5000 - 4096);
  });

  it("returns 0 for tiny context windows", () => {
    const budget = calculateMessageBudget(1000, 800, 4096);
    expect(budget).toBe(0);
  });

  it("uses default output reserve of 4096", () => {
    const budget = calculateMessageBudget(100_000, 10_000);
    expect(budget).toBe(100_000 - 10_000 - 4096);
  });
});
