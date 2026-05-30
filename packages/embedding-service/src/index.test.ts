import type { EmbeddingRow, LlmRepository } from "@radarboard/types/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmbeddingService } from "./index";

// Simple mock embedding: hash the text into a 3-dimensional vector
function mockEmbedFn(text: string): Promise<number[]> {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  return Promise.resolve([Math.sin(h), Math.cos(h), Math.sin(h * 2)]);
}

function mockBatchEmbedFn(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(mockEmbedFn));
}

function createMockRepo(): Pick<
  LlmRepository,
  | "listEmbeddings"
  | "upsertEmbedding"
  | "upsertEmbeddings"
  | "deleteEmbedding"
  | "deleteEmbeddingsBySource"
> {
  const store = new Map<string, EmbeddingRow>();
  return {
    listEmbeddings: vi.fn(async (source?: string, projectSlug?: string) => {
      return [...store.values()].filter(
        (r) => (!source || r.source === source) && (!projectSlug || r.projectSlug === projectSlug)
      );
    }),
    upsertEmbedding: vi.fn(async (row: EmbeddingRow) => {
      store.set(row.id, row);
    }),
    upsertEmbeddings: vi.fn(async (rows: EmbeddingRow[]) => {
      for (const row of rows) store.set(row.id, row);
    }),
    deleteEmbedding: vi.fn(async (id: string) => {
      store.delete(id);
    }),
    deleteEmbeddingsBySource: vi.fn(async (source: string) => {
      for (const [id, row] of store) {
        if (row.source === source) store.delete(id);
      }
    }),
  };
}

describe("EmbeddingService", () => {
  let service: EmbeddingService;
  let repo: ReturnType<typeof createMockRepo>;

  beforeEach(() => {
    repo = createMockRepo();
    service = new EmbeddingService({
      repo: repo as unknown as LlmRepository,
      embedFn: mockEmbedFn,
      batchEmbedFn: mockBatchEmbedFn,
      modelId: "text-embedding-3-small",
    });
  });

  it("embedAndStore creates and stores an embedding", async () => {
    const row = await service.embedAndStore({
      source: "gsc",
      sourceId: "query-1",
      text: "best restaurants in paris",
    });

    expect(row.source).toBe("gsc");
    expect(row.sourceId).toBe("query-1");
    expect(row.modelId).toBe("text-embedding-3-small");
    expect(row.dimensions).toBe(3);
    expect(JSON.parse(row.embedding)).toHaveLength(3);
    expect(repo.upsertEmbedding).toHaveBeenCalledOnce();
  });

  it("embedAndStoreBatch stores multiple embeddings", async () => {
    const rows = await service.embedAndStoreBatch([
      { source: "gsc", sourceId: "q1", text: "react hooks" },
      { source: "gsc", sourceId: "q2", text: "react context" },
      { source: "gsc", sourceId: "q3", text: "vue composition api" },
    ]);

    expect(rows).toHaveLength(3);
    expect(repo.upsertEmbeddings).toHaveBeenCalledOnce();
  });

  it("embedAndStoreBatch returns empty array for empty input", async () => {
    const rows = await service.embedAndStoreBatch([]);
    expect(rows).toHaveLength(0);
    expect(repo.upsertEmbeddings).not.toHaveBeenCalled();
  });

  it("findSimilar returns scored results", async () => {
    // Store some embeddings
    await service.embedAndStore({ source: "gsc", sourceId: "q1", text: "react hooks tutorial" });
    await service.embedAndStore({ source: "gsc", sourceId: "q2", text: "react hooks tutorial" }); // same text = identical vector
    await service.embedAndStore({ source: "gsc", sourceId: "q3", text: "python machine learning" });

    const results = await service.findSimilar("react hooks tutorial");
    expect(results.length).toBeGreaterThan(0);
    // Identical text should have similarity ≈ 1
    expect(results[0]?.similarity).toBeCloseTo(1, 1);
  });

  it("findSimilar respects limit", async () => {
    await service.embedAndStore({ source: "gsc", sourceId: "q1", text: "aaa" });
    await service.embedAndStore({ source: "gsc", sourceId: "q2", text: "bbb" });
    await service.embedAndStore({ source: "gsc", sourceId: "q3", text: "ccc" });

    const results = await service.findSimilar("aaa", { limit: 1 });
    expect(results).toHaveLength(1);
  });

  it("findSimilar filters by source", async () => {
    await service.embedAndStore({ source: "gsc", sourceId: "q1", text: "test" });
    await service.embedAndStore({ source: "github", sourceId: "i1", text: "test" });

    const results = await service.findSimilar("test", { source: "gsc" });
    expect(results.every((r) => r.row.source === "gsc")).toBe(true);
  });

  it("list returns all embeddings", async () => {
    await service.embedAndStore({ source: "gsc", sourceId: "q1", text: "aaa" });
    await service.embedAndStore({ source: "gsc", sourceId: "q2", text: "bbb" });

    const rows = await service.list();
    expect(rows).toHaveLength(2);
  });

  it("delete removes an embedding", async () => {
    const row = await service.embedAndStore({ source: "gsc", sourceId: "q1", text: "aaa" });
    await service.delete(row.id);
    expect(repo.deleteEmbedding).toHaveBeenCalledWith(row.id);
  });

  it("deleteBySource removes all embeddings for a source", async () => {
    await service.embedAndStore({ source: "gsc", sourceId: "q1", text: "aaa" });
    await service.embedAndStore({ source: "gsc", sourceId: "q2", text: "bbb" });
    await service.deleteBySource("gsc");
    expect(repo.deleteEmbeddingsBySource).toHaveBeenCalledWith("gsc", undefined);
  });
});
