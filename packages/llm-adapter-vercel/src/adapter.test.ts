import type { StreamChatParams } from "@radarboard/llm/types";
import { describe, expect, it } from "vitest";
import { createEmbedFn, createVercelAdapter } from "./adapter";

/**
 * These tests validate the adapter's public interface and error handling.
 * They do NOT make real API calls — they test the wiring and contract.
 * Integration tests with actual providers belong in a separate e2e suite.
 */

describe("createVercelAdapter", () => {
  it("returns an object implementing LlmAdapter", () => {
    const adapter = createVercelAdapter();

    expect(adapter.streamChat).toBeTypeOf("function");
    expect(adapter.generateText).toBeTypeOf("function");
    expect(adapter.embed).toBeTypeOf("function");
  });

  it("streamChat throws for unsupported provider", async () => {
    const adapter = createVercelAdapter();

    const params: StreamChatParams = {
      providerId: "unknown-provider",
      apiKey: "test",
      model: "some-model",
      systemPrompt: "You are helpful.",
      messages: [
        {
          id: "1",
          role: "user",
          parts: [{ type: "text", text: "Hi" }],
          createdAt: new Date(),
        },
      ],
    };

    await expect(adapter.streamChat(params)).rejects.toThrow("Unsupported LLM provider");
  });

  it("embed throws for unsupported provider", async () => {
    const adapter = createVercelAdapter();

    await expect(
      adapter.embed({ providerId: "nonexistent", apiKey: "key", texts: ["hello"] })
    ).rejects.toThrow("Unsupported LLM provider");
  });

  it("generateText throws for unsupported provider", async () => {
    const adapter = createVercelAdapter();

    await expect(
      adapter.generateText({
        providerId: "nonexistent",
        apiKey: "key",
        model: "bad-model",
        systemPrompt: "You are helpful.",
        messages: [
          {
            id: "1",
            role: "user",
            parts: [{ type: "text", text: "Hi" }],
            createdAt: new Date(),
          },
        ],
      })
    ).rejects.toThrow("Unsupported LLM provider");
  });

  it("createEmbedFn returns a function for supported providers", () => {
    const fn = createEmbedFn({ providerId: "openai", apiKey: "test-key" });
    expect(fn).toBeTypeOf("function");
  });

  it("createEmbedFn works with ollama provider", () => {
    const fn = createEmbedFn({ providerId: "ollama", apiKey: "http://localhost:11434" });
    expect(fn).toBeTypeOf("function");
  });

  it("createEmbedFn accepts custom modelId", () => {
    const fn = createEmbedFn({
      providerId: "openai",
      apiKey: "test-key",
      modelId: "text-embedding-3-large",
    });
    expect(fn).toBeTypeOf("function");
  });

  it("createEmbedFn accepts ollama model", () => {
    const fn = createEmbedFn({
      providerId: "ollama",
      apiKey: "http://localhost:11434",
      modelId: "nomic-embed-text",
    });
    expect(fn).toBeTypeOf("function");
  });

  it("createEmbedFn throws for unsupported providers", () => {
    expect(() => createEmbedFn({ providerId: "unknown", apiKey: "key" })).toThrow("Unsupported");
  });
});
