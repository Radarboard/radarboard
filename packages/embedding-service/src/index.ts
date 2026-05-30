/**
 * Embedding Service — generate, store, and search vector embeddings.
 *
 * This is a shared service used by plugins (topic clustering, semantic search)
 * and core features (memory service). It delegates embedding generation to
 * the LLM adapter and stores vectors in the repository layer.
 */
import type { EmbeddingModelId } from "@radarboard/llm/types";
import type { EmbeddingRow, LlmRepository } from "@radarboard/types/database";
import { cosineSimilarity } from "./similarity";

export { cosineSimilarity, euclideanDistance } from "./similarity";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Function that generates an embedding vector for a text string. */
export type EmbedFn = (text: string) => Promise<number[]>;

/** Function that generates embedding vectors for multiple texts. */
export type BatchEmbedFn = (texts: string[]) => Promise<number[][]>;

export interface EmbeddingServiceOptions {
  repo: LlmRepository;
  embedFn: EmbedFn;
  batchEmbedFn?: BatchEmbedFn;
  modelId: EmbeddingModelId;
  dimensions?: number;
}

export interface SimilarityResult {
  row: EmbeddingRow;
  similarity: number;
}

export interface EmbedAndStoreOptions {
  source: string;
  sourceId: string;
  text: string;
  projectSlug?: string | null;
  metadata?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class EmbeddingService {
  private repo: LlmRepository;
  private embedFn: EmbedFn;
  private batchEmbedFn: BatchEmbedFn;
  private modelId: EmbeddingModelId;
  private dimensions: number | undefined;

  constructor(options: EmbeddingServiceOptions) {
    this.repo = options.repo;
    this.embedFn = options.embedFn;
    this.batchEmbedFn = options.batchEmbedFn ?? defaultBatchEmbedFn(options.embedFn);
    this.modelId = options.modelId;
    this.dimensions = options.dimensions;
  }

  /** Embed a single text and store it. */
  async embedAndStore(options: EmbedAndStoreOptions): Promise<EmbeddingRow> {
    const vector = await this.embedFn(options.text);
    const now = new Date().toISOString();

    const row: EmbeddingRow = {
      id: crypto.randomUUID(),
      source: options.source,
      sourceId: options.sourceId,
      text: options.text,
      embedding: JSON.stringify(vector),
      modelId: this.modelId,
      dimensions: vector.length,
      projectSlug: options.projectSlug ?? null,
      metadata: options.metadata ? JSON.stringify(options.metadata) : null,
      createdAt: now,
      updatedAt: now,
    };

    await this.repo.upsertEmbedding(row);
    return row;
  }

  /** Embed multiple texts and store them all. */
  async embedAndStoreBatch(items: EmbedAndStoreOptions[]): Promise<EmbeddingRow[]> {
    if (items.length === 0) return [];

    const texts = items.map((item) => item.text);
    const vectors = await this.batchEmbedFn(texts);
    const now = new Date().toISOString();

    const rows: EmbeddingRow[] = items.map((item, i) => ({
      id: crypto.randomUUID(),
      source: item.source,
      sourceId: item.sourceId,
      text: item.text,
      embedding: JSON.stringify(vectors[i]),
      modelId: this.modelId,
      dimensions: (vectors[i] ?? []).length,
      projectSlug: item.projectSlug ?? null,
      metadata: item.metadata ? JSON.stringify(item.metadata) : null,
      createdAt: now,
      updatedAt: now,
    }));

    await this.repo.upsertEmbeddings(rows);
    return rows;
  }

  /**
   * Find stored embeddings most similar to a query text.
   * Optionally filter by source and/or project.
   */
  async findSimilar(
    query: string,
    options?: { source?: string; projectSlug?: string; limit?: number; minSimilarity?: number }
  ): Promise<SimilarityResult[]> {
    const limit = options?.limit ?? 10;
    const minSimilarity = options?.minSimilarity ?? 0;

    const queryVector = await this.embedFn(query);
    const rows = await this.repo.listEmbeddings(options?.source, options?.projectSlug);

    if (rows.length === 0) return [];

    const scored: SimilarityResult[] = rows
      .map((row) => ({
        row,
        similarity: cosineSimilarity(queryVector, JSON.parse(row.embedding)),
      }))
      .filter((r) => r.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return scored;
  }

  /** List all stored embeddings, optionally filtered. */
  async list(source?: string, projectSlug?: string): Promise<EmbeddingRow[]> {
    return this.repo.listEmbeddings(source, projectSlug);
  }

  /** Delete a single embedding by ID. */
  async delete(id: string): Promise<void> {
    return this.repo.deleteEmbedding(id);
  }

  /** Delete all embeddings for a source (and optionally a project). */
  async deleteBySource(source: string, projectSlug?: string): Promise<void> {
    return this.repo.deleteEmbeddingsBySource(source, projectSlug);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fallback batch embed that calls single embed in sequence. */
function defaultBatchEmbedFn(embedFn: EmbedFn): BatchEmbedFn {
  return async (texts: string[]): Promise<number[][]> => {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await embedFn(text));
    }
    return results;
  };
}
