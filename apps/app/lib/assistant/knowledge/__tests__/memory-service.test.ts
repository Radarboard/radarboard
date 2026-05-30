import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryService } from "../memory-service";

const mockLlmRepo = {
  listConversations: vi.fn(),
  createConversation: vi.fn(),
  updateConversationTitle: vi.fn(),
  deleteConversation: vi.fn(),
  getMessages: vi.fn(),
  appendMessage: vi.fn(),
  searchMessages: vi.fn(),
  listMemory: vi.fn(),
  upsertMemory: vi.fn(),
  deleteMemory: vi.fn(),
  listSkills: vi.fn(),
  upsertSkill: vi.fn(),
  deleteSkill: vi.fn(),
  insertTrace: vi.fn(),
  listTraces: vi.fn(),
  updateTraceRating: vi.fn(),
  listArtifacts: vi.fn(),
  getArtifact: vi.fn(),
  upsertArtifact: vi.fn(),
};

const mockEmbed = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockLlmRepo.listMemory.mockResolvedValue([]);
  mockEmbed.mockResolvedValue([0.1, 0.2, 0.3]);
});

describe("MemoryService", () => {
  it("remembers a fact and stores it with an embedding", async () => {
    const service = new MemoryService(mockLlmRepo, mockEmbed);

    await service.remember("current_focus", "Improve SEO for Goshuin", "goshuin");

    expect(mockLlmRepo.upsertMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "current_focus",
        value: "Improve SEO for Goshuin",
        projectSlug: "goshuin",
        embedding: JSON.stringify([0.1, 0.2, 0.3]),
      })
    );
    expect(mockEmbed).toHaveBeenCalledWith("current_focus: Improve SEO for Goshuin");
  });

  it("recalls memories by semantic similarity", async () => {
    mockLlmRepo.listMemory.mockResolvedValue([
      {
        id: "m1",
        key: "focus",
        value: "SEO improvements",
        embedding: JSON.stringify([0.1, 0.2, 0.3]),
        projectSlug: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "m2",
        key: "goal",
        value: "Reach $1k MRR",
        embedding: JSON.stringify([0.9, 0.8, 0.7]),
        projectSlug: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
    // Query embedding is close to m1's embedding
    mockEmbed.mockResolvedValue([0.1, 0.2, 0.3]);

    const service = new MemoryService(mockLlmRepo, mockEmbed);
    const results = await service.recall("What should I focus on?", 1);

    expect(results.length).toBe(1);
    expect(results[0].key).toBe("focus");
  });

  it("lists all memories for a project", async () => {
    mockLlmRepo.listMemory.mockResolvedValue([
      {
        id: "m1",
        key: "k1",
        value: "v1",
        embedding: null,
        projectSlug: "p1",
        createdAt: "",
        updatedAt: "",
      },
    ]);

    const service = new MemoryService(mockLlmRepo, mockEmbed);
    const results = await service.listAll("p1");

    expect(results).toHaveLength(1);
    expect(mockLlmRepo.listMemory).toHaveBeenCalledWith("p1");
  });

  it("forgets a memory by id", async () => {
    const service = new MemoryService(mockLlmRepo, mockEmbed);
    await service.forget("m1");

    expect(mockLlmRepo.deleteMemory).toHaveBeenCalledWith("m1");
  });

  it("recall returns empty when no memories exist", async () => {
    mockLlmRepo.listMemory.mockResolvedValue([]);

    const service = new MemoryService(mockLlmRepo, mockEmbed);
    const results = await service.recall("anything", 5);

    expect(results).toEqual([]);
  });
});
