import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupabaseLlmRepository } from "../supabase-llm";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const config = { url: "https://test.supabase.co", anonKey: "anon-key" };

function okJson(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockImplementation(() => okJson([]));
});

describe("SupabaseLlmRepository", () => {
  describe("listConversations", () => {
    it("returns empty array when no rows", async () => {
      const repo = new SupabaseLlmRepository(config);
      const result = await repo.listConversations();
      expect(result).toEqual([]);
    });

    it("maps snake_case DB columns to camelCase", async () => {
      mockFetch.mockImplementationOnce(() =>
        okJson([
          {
            id: "c1",
            title: "Revenue chat",
            project_slug: "myapp",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ])
      );

      const repo = new SupabaseLlmRepository(config);
      const result = await repo.listConversations();

      expect(result[0]).toMatchObject({ id: "c1", projectSlug: "myapp" });
    });
  });

  describe("createConversation", () => {
    it("POSTs to llm_conversations", async () => {
      const repo = new SupabaseLlmRepository(config);
      await repo.createConversation("c1", "Chat", "myapp");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("llm_conversations"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("deleteConversation", () => {
    it("sends DELETE for messages then conversation", async () => {
      const repo = new SupabaseLlmRepository(config);
      await repo.deleteConversation("c1");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const calls = mockFetch.mock.calls.map((c) => c[0] as string);
      expect(calls.some((u) => u.includes("llm_messages"))).toBe(true);
      expect(calls.some((u) => u.includes("llm_conversations"))).toBe(true);
    });
  });

  describe("appendMessage", () => {
    it("POSTs to llm_messages", async () => {
      const repo = new SupabaseLlmRepository(config);
      await repo.appendMessage({
        id: "m1",
        conversationId: "c1",
        role: "user",
        parts: "[]",
        createdAt: "2026-01-01T00:00:00Z",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("llm_messages"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("upsertMemory", () => {
    it("POSTs to llm_memory", async () => {
      const repo = new SupabaseLlmRepository(config);
      await repo.upsertMemory({
        id: "mem1",
        key: "focus",
        value: "SEO",
        embedding: null,
        projectSlug: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("llm_memory"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("traces", () => {
    it("POSTs trace rows to llm_traces", async () => {
      const repo = new SupabaseLlmRepository(config);
      await repo.insertTrace({
        id: "t1",
        conversationId: "c1",
        providerId: "openai",
        modelId: "gpt-5.4-mini",
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        durationMs: 123,
        rating: null,
        createdAt: "2026-01-01T00:00:00Z",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("llm_traces"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("maps llm_traces rows back to camelCase", async () => {
      mockFetch.mockImplementationOnce(() =>
        okJson([
          {
            id: "t1",
            conversation_id: "c1",
            provider_id: "openai",
            model_id: "gpt-5.4-mini",
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
            duration_ms: 123,
            rating: 1,
            created_at: "2026-01-01T00:00:00Z",
          },
        ])
      );

      const repo = new SupabaseLlmRepository(config);
      const result = await repo.listTraces(10);

      expect(result).toEqual([
        {
          id: "t1",
          conversationId: "c1",
          providerId: "openai",
          modelId: "gpt-5.4-mini",
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          durationMs: 123,
          rating: 1,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ]);
    });
  });
});
