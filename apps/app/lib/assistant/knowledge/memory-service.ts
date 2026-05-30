/**
 * Memory service — stores and retrieves facts with vector similarity search.
 *
 * The LLM can call `remember` to persist knowledge and `recall` to retrieve
 * relevant memories using cosine similarity over embeddings.
 */
import type { LlmMemoryRow, LlmRepository } from "@radarboard/types/database";

/** Function that generates an embedding vector for a text string. */
export type EmbedFn = (text: string) => Promise<number[]>;

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  projectSlug: string | null;
  similarity?: number;
}

export class MemoryService {
  constructor(
    private repo: LlmRepository,
    private embedFn: EmbedFn
  ) {}

  /** Store a named fact with an embedding for later semantic retrieval. */
  async remember(key: string, value: string, projectSlug: string | null = null): Promise<void> {
    const embedding = await this.embedFn(`${key}: ${value}`);
    const now = new Date().toISOString();

    await this.repo.upsertMemory({
      id: crypto.randomUUID(),
      key,
      value,
      embedding: JSON.stringify(embedding),
      projectSlug,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Find the most relevant memories by semantic similarity to a query. */
  async recall(query: string, limit = 5, projectSlug?: string): Promise<MemoryEntry[]> {
    const allMemories = await this.repo.listMemory(projectSlug);
    if (allMemories.length === 0) return [];

    const queryEmbedding = await this.embedFn(query);

    // Score each memory by cosine similarity
    const scored = allMemories
      .filter((m) => m.embedding !== null)
      .map((m) => ({
        ...memoryRowToEntry(m),
        similarity: cosineSimilarity(queryEmbedding, JSON.parse(m.embedding as string)),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return scored;
  }

  /** List all stored memories, optionally filtered by project. */
  async listAll(projectSlug?: string): Promise<MemoryEntry[]> {
    const rows = await this.repo.listMemory(projectSlug);
    return rows.map(memoryRowToEntry);
  }

  /** Delete a memory by id. */
  async forget(id: string): Promise<void> {
    await this.repo.deleteMemory(id);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function memoryRowToEntry(row: LlmMemoryRow): MemoryEntry {
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    projectSlug: row.projectSlug,
  };
}

/** Cosine similarity between two vectors. Returns value in [-1, 1]. */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
