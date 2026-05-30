import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanetscaleLlmRepository } from "../planetscale-llm";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const config = { host: "aws.connect.psdb.cloud", username: "user", password: "pass" };

function okJson(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ rows: Array.isArray(data) ? data : [] }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockImplementation(() => okJson([]));
});

describe("PlanetscaleLlmRepository", () => {
  describe("listConversations", () => {
    it("returns empty array when no rows", async () => {
      const repo = new PlanetscaleLlmRepository(config);
      const result = await repo.listConversations();
      expect(result).toEqual([]);
    });

    it("maps rows to LlmConversationRow shape", async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              rows: [
                {
                  id: "c1",
                  title: "Test",
                  project_slug: "myapp",
                  created_at: "2026-01-01T00:00:00Z",
                  updated_at: "2026-01-01T00:00:00Z",
                },
              ],
            }),
        })
      );

      const repo = new PlanetscaleLlmRepository(config);
      const result = await repo.listConversations();

      expect(result[0]).toMatchObject({ id: "c1", projectSlug: "myapp" });
    });
  });

  describe("createConversation", () => {
    it("executes an INSERT query", async () => {
      const repo = new PlanetscaleLlmRepository(config);
      await repo.createConversation("c1", "Chat", null);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(config.host),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("deleteConversation", () => {
    it("executes two DELETE queries", async () => {
      const repo = new PlanetscaleLlmRepository(config);
      await repo.deleteConversation("c1");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("appendMessage", () => {
    it("executes an INSERT query", async () => {
      const repo = new PlanetscaleLlmRepository(config);
      await repo.appendMessage({
        id: "m1",
        conversationId: "c1",
        role: "user",
        parts: "[]",
        createdAt: "2026-01-01T00:00:00Z",
      });

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("upsertMemory", () => {
    it("executes an upsert query", async () => {
      const repo = new PlanetscaleLlmRepository(config);
      await repo.upsertMemory({
        id: "mem1",
        key: "focus",
        value: "SEO",
        embedding: null,
        projectSlug: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("traces", () => {
    it("executes an INSERT query for trace rows", async () => {
      const repo = new PlanetscaleLlmRepository(config);
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

      expect(mockFetch).toHaveBeenCalled();
    });

    it("maps trace rows into the shared shape", async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              rows: [
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
              ],
            }),
        })
      );

      const repo = new PlanetscaleLlmRepository(config);
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
