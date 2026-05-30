import type { LlmMessage } from "@radarboard/llm/types";
import { describe, expect, it } from "vitest";
import { convertFromLlmMessages, convertToLlmMessage } from "./message-converter";

describe("message-converter", () => {
  describe("convertFromLlmMessages", () => {
    it("converts a user text message to AI SDK format", () => {
      const messages: LlmMessage[] = [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "What is my MRR?" }],
          createdAt: new Date("2026-01-01"),
        },
      ];

      const result = convertFromLlmMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: "user",
        content: "What is my MRR?",
      });
    });

    it("converts an assistant text message to AI SDK format", () => {
      const messages: LlmMessage[] = [
        {
          id: "msg-2",
          role: "assistant",
          parts: [{ type: "text", text: "Your MRR is $500." }],
          createdAt: new Date("2026-01-01"),
        },
      ];

      const result = convertFromLlmMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: "assistant",
        content: "Your MRR is $500.",
      });
    });

    it("concatenates multiple text parts into a single content string", () => {
      const messages: LlmMessage[] = [
        {
          id: "msg-3",
          role: "user",
          parts: [
            { type: "text", text: "Hello " },
            { type: "text", text: "world" },
          ],
          createdAt: new Date("2026-01-01"),
        },
      ];

      const result = convertFromLlmMessages(messages);

      expect(result[0]).toEqual({
        role: "user",
        content: "Hello world",
      });
    });

    it("skips system messages (system prompt is handled separately)", () => {
      const messages: LlmMessage[] = [
        {
          id: "msg-sys",
          role: "system",
          parts: [{ type: "text", text: "You are helpful." }],
          createdAt: new Date("2026-01-01"),
        },
        {
          id: "msg-usr",
          role: "user",
          parts: [{ type: "text", text: "Hi" }],
          createdAt: new Date("2026-01-01"),
        },
      ];

      const result = convertFromLlmMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]?.role).toBe("user");
    });

    it("handles empty message list", () => {
      expect(convertFromLlmMessages([])).toEqual([]);
    });
  });

  describe("convertToLlmMessage", () => {
    it("converts an AI SDK assistant text chunk to LlmMessage", () => {
      const result = convertToLlmMessage({
        id: "resp-1",
        role: "assistant",
        text: "Here is the answer.",
      });

      expect(result.id).toBe("resp-1");
      expect(result.role).toBe("assistant");
      expect(result.parts).toEqual([{ type: "text", text: "Here is the answer." }]);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it("creates a message with empty text gracefully", () => {
      const result = convertToLlmMessage({
        id: "resp-2",
        role: "assistant",
        text: "",
      });

      expect(result.parts).toEqual([{ type: "text", text: "" }]);
    });
  });
});
