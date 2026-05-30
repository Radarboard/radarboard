import { beforeEach, describe, expect, it, vi } from "vitest";
import { TursoLlmRepository } from "../turso-llm";

const mockExecute = vi.fn();

vi.mock("@libsql/client", () => ({
  createClient: vi.fn(() => ({ execute: mockExecute })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockResolvedValue({ rows: [] });
});

const config = { url: "libsql://test.turso.io", authToken: "token" };

describe("TursoLlmRepository", () => {
  describe("listConversations", () => {
    it("returns empty array when no rows", async () => {
      const repo = new TursoLlmRepository(config);
      const result = await repo.listConversations();
      expect(result).toEqual([]);
    });

    it("returns mapped rows", async () => {
      mockExecute.mockResolvedValue({
        rows: [
          {
            id: "c1",
            title: "Test",
            project_slug: "myapp",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      });

      const repo = new TursoLlmRepository(config);
      const result = await repo.listConversations();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: "c1", title: "Test", projectSlug: "myapp" });
    });
  });

  describe("createConversation", () => {
    it("executes an INSERT statement", async () => {
      const repo = new TursoLlmRepository(config);
      await repo.createConversation("c1", "My chat", null);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({ args: expect.arrayContaining(["c1", "My chat", null]) })
      );
    });
  });

  describe("deleteConversation", () => {
    it("executes DELETE for messages then conversation", async () => {
      const repo = new TursoLlmRepository(config);
      await repo.deleteConversation("c1");

      expect(mockExecute).toHaveBeenCalledTimes(2);
    });
  });

  describe("appendMessage", () => {
    it("executes an INSERT statement", async () => {
      const repo = new TursoLlmRepository(config);
      await repo.appendMessage({
        id: "m1",
        conversationId: "c1",
        role: "user",
        parts: "[]",
        createdAt: "2026-01-01T00:00:00Z",
      });

      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({ args: expect.arrayContaining(["m1", "c1", "user"]) })
      );
    });
  });

  describe("upsertMemory", () => {
    it("executes an upsert statement", async () => {
      const repo = new TursoLlmRepository(config);
      await repo.upsertMemory({
        id: "mem1",
        key: "focus",
        value: "SEO",
        embedding: null,
        projectSlug: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe("listSkills", () => {
    it("returns empty array when no rows", async () => {
      const repo = new TursoLlmRepository(config);
      const result = await repo.listSkills();
      expect(result).toEqual([]);
    });
  });

  describe("traces", () => {
    it("inserts trace rows into llm_traces", async () => {
      const repo = new TursoLlmRepository(config);
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

      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({ sql: expect.stringContaining("INSERT INTO llm_traces") })
      );
    });

    it("maps trace rows from the database", async () => {
      mockExecute.mockResolvedValueOnce({
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
            rating: -1,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      });

      const repo = new TursoLlmRepository(config);
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
          rating: -1,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ]);
    });
  });
});
