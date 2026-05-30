/**
 * Embeddings & Clustering — Data types
 */

import type { EmbeddingModelId } from "@radarboard/llm/types";

/** Plugin settings stored in plugin KV. */
export interface EmbeddingsSettings {
  enabled: boolean;
  modelId: EmbeddingModelId;
  /** Custom model name (overrides modelId when set — for unlisted Ollama models). */
  customModelId?: string;
  /** Override output dimensions (only OpenAI text-embedding-3 models support this). */
  dimensions?: number;
  /** Provider to use for embeddings. "auto" = use the global chat provider. */
  providerId: string;
  /** Source IDs to auto-embed on data refresh (e.g. "gsc", "github-issues"). */
  autoEmbedSources: string[];
  /** Number of clusters for topic grouping. */
  clusterCount: number;
  /** Minimum cosine similarity (0-1) to include in search results. */
  minSimilarity: number;
}

export const DEFAULT_SETTINGS: EmbeddingsSettings = {
  enabled: false,
  modelId: "text-embedding-3-small",
  providerId: "auto",
  autoEmbedSources: [],
  clusterCount: 5,
  minSimilarity: 0,
};

/** Resolve the effective model ID from settings (custom overrides predefined). */
export function resolveModelId(settings: EmbeddingsSettings): string {
  return settings.customModelId?.trim() || settings.modelId;
}

/** A cluster of semantically similar items. */
export interface TopicCluster {
  id: string;
  label: string;
  items: ClusterItem[];
  centroid: number[];
}

export interface ClusterItem {
  id: string;
  text: string;
  source: string;
  sourceId: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

/** Available embedding sources that integrations can register. */
export interface EmbeddingSource {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

/** Well-known embedding sources. */
export const EMBEDDING_SOURCES: EmbeddingSource[] = [
  { id: "gsc", name: "Google Search Console", description: "Search queries from GSC" },
  { id: "github-issues", name: "GitHub Issues", description: "Issue titles and descriptions" },
  { id: "linear", name: "Linear Issues", description: "Issue titles and descriptions" },
];

// ---------------------------------------------------------------------------
// Embedding model registry — grouped by provider for the settings UI
// ---------------------------------------------------------------------------

export interface EmbeddingModelOption {
  id: EmbeddingModelId;
  name: string;
  dimensions: number;
  maxTokens?: number;
  costPer1MTokens?: number;
}

export interface EmbeddingProviderGroup {
  provider: string;
  label: string;
  models: EmbeddingModelOption[];
}

/** All available embedding models, grouped by provider. */
export const EMBEDDING_MODEL_GROUPS: EmbeddingProviderGroup[] = [
  {
    provider: "ollama",
    label: "Ollama",
    models: [
      { id: "nomic-embed-text", name: "Nomic Embed Text v1.5", dimensions: 768, maxTokens: 8192 },
      {
        id: "nomic-embed-text:v2-moe",
        name: "Nomic Embed Text v2 MoE (Q6_K)",
        dimensions: 768,
        maxTokens: 8192,
      },
      {
        id: "snowflake-arctic-embed",
        name: "Snowflake Arctic Embed v1",
        dimensions: 1024,
        maxTokens: 512,
      },
      {
        id: "snowflake-arctic-embed2",
        name: "Snowflake Arctic Embed v2",
        dimensions: 1024,
        maxTokens: 512,
      },
      { id: "mxbai-embed-large", name: "mxbai-embed-large", dimensions: 1024, maxTokens: 512 },
      { id: "bge-m3", name: "BGE-M3 (BAAI)", dimensions: 1024, maxTokens: 8192 },
      { id: "bge-large", name: "BGE-Large", dimensions: 1024, maxTokens: 512 },
      { id: "all-minilm", name: "All-MiniLM", dimensions: 384, maxTokens: 256 },
    ],
  },
  {
    provider: "openai",
    label: "OpenAI",
    models: [
      {
        id: "text-embedding-3-small",
        name: "Text Embedding 3 Small",
        dimensions: 1536,
        maxTokens: 8191,
        costPer1MTokens: 0.02,
      },
      {
        id: "text-embedding-3-large",
        name: "Text Embedding 3 Large",
        dimensions: 3072,
        maxTokens: 8191,
        costPer1MTokens: 0.13,
      },
    ],
  },
  {
    provider: "google",
    label: "Google",
    models: [
      { id: "text-embedding-004", name: "Text Embedding 004", dimensions: 768, maxTokens: 2048 },
    ],
  },
];

/** Flat lookup of model metadata by ID. */
export function findEmbeddingModel(modelId: string): EmbeddingModelOption | undefined {
  for (const group of EMBEDDING_MODEL_GROUPS) {
    const found = group.models.find((m) => m.id === modelId);
    if (found) return found;
  }
  return undefined;
}

/** Find which provider a model belongs to. */
export function findEmbeddingProvider(modelId: string): string | undefined {
  for (const group of EMBEDDING_MODEL_GROUPS) {
    if (group.models.some((m) => m.id === modelId)) return group.provider;
  }
  return undefined;
}
