import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../client", () => ({
  getDb: vi.fn(),
}));
vi.mock("../schema", () => ({
  llmArtifacts: { id: "id", createdAt: "created_at" },
  llmConversations: { id: "id" },
  llmMessages: { id: "id", conversationId: "conversation_id" },
  llmMemory: { id: "id" },
  llmSkills: { id: "id" },
  llmTraces: { id: "id" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...conditions) => conditions),
  sql: { raw: vi.fn((s: string) => s) },
  desc: vi.fn((col) => ({ col, dir: "desc" })),
  asc: vi.fn((col) => ({ col, dir: "asc" })),
}));

import { getDb } from "@/data/core/client";
import { SqliteLlmRepository } from "../sqlite-llm";

function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  // select().from().where().orderBy().limit() chain
  chain.limit = vi.fn().mockResolvedValue([]);
  chain.orderBy = vi.fn().mockImplementation(() => {
    const result = Promise.resolve([]);
    (result as any).limit = chain.limit;
    return result;
  });
  chain.where = vi.fn().mockReturnValue({ orderBy: chain.orderBy });
  chain.from = vi.fn().mockReturnValue({ where: chain.where, orderBy: chain.orderBy });
  chain.select = vi.fn().mockReturnValue({ from: chain.from });

  // insert().values().onConflictDoUpdate()
  chain.onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  chain.values = vi.fn().mockReturnValue({ onConflictDoUpdate: chain.onConflictDoUpdate });
  chain.insert = vi.fn().mockReturnValue({ values: chain.values });

  // delete(table).where()
  chain.deleteWhere = vi.fn().mockResolvedValue(undefined);
  chain.delete = vi.fn().mockReturnValue({ where: chain.deleteWhere });

  // run() for raw SQL (DDL)
  chain.run = vi.fn().mockResolvedValue(undefined);
  chain.all = vi.fn().mockResolvedValue([{ name: "content_type" }, { name: "evidence_refs" }]);

  return chain;
}

let mockDb: ReturnType<typeof createMockDb>;
let repo: SqliteLlmRepository;

beforeEach(() => {
  vi.clearAllMocks();
  mockDb = createMockDb();
  vi.mocked(getDb).mockReturnValue(mockDb as ReturnType<typeof getDb>);
  repo = new SqliteLlmRepository();
});

describe("SqliteLlmRepository", () => {
  describe("listConversations", () => {
    it("returns an empty array when no conversations exist", async () => {
      mockDb.orderBy.mockResolvedValue([]);
      const result = await repo.listConversations();
      expect(result).toEqual([]);
    });

    it("returns conversations from the database", async () => {
      const rows = [
        {
          id: "conv-1",
          title: "Chat about revenue",
          projectSlug: "goshuin",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ];
      mockDb.orderBy.mockResolvedValue(rows);

      const result = await repo.listConversations();
      expect(result).toEqual(rows);
    });
  });

  describe("createConversation", () => {
    it("inserts a new conversation row", async () => {
      await repo.createConversation("conv-1", "Test chat", "goshuin");

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "conv-1",
          title: "Test chat",
          projectSlug: "goshuin",
        })
      );
    });

    it("accepts null projectSlug for cross-project chats", async () => {
      await repo.createConversation("conv-2", "General chat", null);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "conv-2",
          projectSlug: null,
        })
      );
    });
  });

  describe("deleteConversation", () => {
    it("deletes the conversation by id", async () => {
      await repo.deleteConversation("conv-1");

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe("getMessages", () => {
    it("returns messages for a conversation ordered by createdAt", async () => {
      const msgs = [
        {
          id: "msg-1",
          conversationId: "conv-1",
          role: "user",
          parts: '[{"type":"text","text":"Hi"}]',
          createdAt: "2026-01-01T00:00:00Z",
        },
      ];
      mockDb.orderBy.mockResolvedValue(msgs);

      const result = await repo.getMessages("conv-1");
      expect(result).toEqual(msgs);
    });
  });

  describe("appendMessage", () => {
    it("inserts a message row", async () => {
      await repo.appendMessage({
        id: "msg-1",
        conversationId: "conv-1",
        role: "user",
        parts: '[{"type":"text","text":"Hello"}]',
        createdAt: "2026-01-01T00:00:00Z",
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "msg-1",
          conversationId: "conv-1",
          role: "user",
        })
      );
    });
  });

  describe("upsertMemory", () => {
    it("inserts or updates a memory entry", async () => {
      await repo.upsertMemory({
        id: "mem-1",
        key: "priorities",
        value: "Focus on SEO",
        embedding: null,
        projectSlug: "goshuin",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.onConflictDoUpdate).toHaveBeenCalled();
    });
  });

  describe("upsertSkill", () => {
    it("inserts or updates a custom skill", async () => {
      await repo.upsertSkill({
        id: "skill-1",
        name: "My Skill",
        description: "Custom skill",
        instructions: "Do things",
        enabled: true,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.onConflictDoUpdate).toHaveBeenCalled();
    });
  });

  describe("artifacts", () => {
    it("lists saved artifacts", async () => {
      const rows = [
        {
          id: "artifact-1",
          projectSlug: "radarboard",
          mode: "plan",
          title: "Plan",
          summary: "Summary",
          body: "Body",
          contentType: "markdown",
          status: "completed",
          sourceConversationId: "conv-1",
          createdAt: "2026-03-19T12:00:00.000Z",
          nextMode: "review",
          nextReason: "Next",
          evidenceRefs: [],
        },
      ];
      mockDb.orderBy.mockResolvedValue(rows);

      const result = await repo.listArtifacts({ projectSlug: "radarboard" });
      expect(result).toEqual(rows);
    });

    it("upserts workflow artifacts", async () => {
      await repo.upsertArtifact({
        id: "artifact-1",
        projectSlug: "radarboard",
        mode: "review",
        title: "Review",
        summary: "Summary",
        body: "Body",
        status: "completed",
        sourceConversationId: "conv-1",
        createdAt: "2026-03-19T12:00:00.000Z",
        nextMode: "qa",
        nextReason: "Run QA",
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.onConflictDoUpdate).toHaveBeenCalled();
    });
  });

  describe("clearAll", () => {
    it("deletes every LLM table (factory reset)", async () => {
      await repo.clearAll();

      // messages, conversations, memory, skills, traces, artifacts, embeddings
      expect(mockDb.delete).toHaveBeenCalledTimes(7);
    });
  });
});
