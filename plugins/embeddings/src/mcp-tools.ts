/**
 * Embeddings & Clustering — MCP tool definitions
 *
 * These tools expose embedding capabilities to the AI assistant,
 * enabling semantic search and topic clustering via natural language.
 *
 * Tool execute functions receive a `serviceResolver` via the plugin's DB
 * that lazily loads the EmbeddingService singleton from the app layer.
 */

import type { EmbeddingService } from "@radarboard/embedding-service";
import type { McpToolDefinition, PluginAPI } from "@radarboard/plugin-sdk/types";
import { z } from "zod";
import { clusterEmbeddings } from "./clustering";
import { DEFAULT_SETTINGS, type EmbeddingsSettings, resolveModelId } from "./types";

const SETTINGS_KEY = "embeddings:settings";

/** Options passed to the service resolver (mirrors EmbeddingServiceOptions in the app layer). */
interface ServiceResolverOptions {
  modelId?: string;
  providerId?: string;
  dimensions?: number;
}

type ServiceResolver = (options?: ServiceResolverOptions) => Promise<EmbeddingService | null>;
let serviceResolver: ServiceResolver | null = null;

/** Register the embedding service resolver. Called once from the app layer. */
export function setEmbeddingServiceResolver(resolver: ServiceResolver): void {
  serviceResolver = resolver;
}

async function getSettings(api: PluginAPI): Promise<EmbeddingsSettings> {
  const raw = await api.db.get<Record<string, unknown>>(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...raw } as EmbeddingsSettings;
}

async function getService(settings: EmbeddingsSettings): Promise<EmbeddingService | null> {
  if (!serviceResolver) return null;
  const modelId = resolveModelId(settings);
  const dimensions =
    settings.dimensions && settings.dimensions > 0 ? settings.dimensions : undefined;
  return serviceResolver({
    modelId,
    providerId: settings.providerId !== "auto" ? settings.providerId : undefined,
    dimensions,
  });
}

export const embeddingsMcpTools: McpToolDefinition[] = [
  {
    name: "embed_text",
    description:
      "Generate an embedding vector for a text string and store it. Useful for adding new content to the embedding index for semantic search.",
    parameters: z.object({
      text: z.string().describe("The text to embed"),
      source: z.string().describe("Source identifier (e.g. 'gsc', 'github-issues', 'manual')"),
      source_id: z.string().describe("Unique item ID within the source"),
      project_slug: z.string().optional().describe("Project to associate with"),
    }),
    execute: async (args, api: PluginAPI) => {
      const { text, source, source_id, project_slug } = args as {
        text: string;
        source: string;
        source_id: string;
        project_slug?: string;
      };
      const settings = await getSettings(api);
      const service = await getService(settings);
      if (!service) return { error: "Embedding service unavailable — no LLM provider configured" };

      const row = await service.embedAndStore({
        source,
        sourceId: source_id,
        text,
        projectSlug: project_slug,
      });
      return {
        id: row.id,
        source: row.source,
        sourceId: row.sourceId,
        dimensions: row.dimensions,
        modelId: row.modelId,
      };
    },
  },
  {
    name: "find_similar",
    description:
      "Find stored embeddings most similar to a query text. Use for semantic search across all embedded content (GSC queries, issues, etc.). Returns results ranked by cosine similarity.",
    parameters: z.object({
      query: z.string().describe("The search query text"),
      source: z.string().optional().describe("Filter by source (e.g. 'gsc', 'github-issues')"),
      project_slug: z.string().optional().describe("Filter by project"),
      limit: z.number().optional().default(10).describe("Maximum results to return (default: 10)"),
    }),
    execute: async (args, api: PluginAPI) => {
      const { query, source, project_slug, limit } = args as {
        query: string;
        source?: string;
        project_slug?: string;
        limit?: number;
      };
      const settings = await getSettings(api);
      const service = await getService(settings);
      if (!service) return { error: "Embedding service unavailable — no LLM provider configured" };

      const results = await service.findSimilar(query, {
        source,
        projectSlug: project_slug,
        limit: limit ?? 10,
        minSimilarity: settings.minSimilarity > 0 ? settings.minSimilarity / 100 : undefined,
      });
      return {
        results: results.map((r) => ({
          text: r.row.text,
          source: r.row.source,
          sourceId: r.row.sourceId,
          similarity: Math.round(r.similarity * 1000) / 1000,
          metadata: r.row.metadata ? JSON.parse(r.row.metadata) : null,
        })),
      };
    },
  },
  {
    name: "list_embedding_sources",
    description:
      "List all stored embeddings grouped by source, with counts. Shows what data has been embedded.",
    parameters: z.object({
      source: z.string().optional().describe("Filter to a specific source"),
      project_slug: z.string().optional().describe("Filter by project"),
    }),
    execute: async (args, api: PluginAPI) => {
      const { source, project_slug } = args as {
        source?: string;
        project_slug?: string;
      };
      const settings = await getSettings(api);
      const service = await getService(settings);
      if (!service) return { error: "Embedding service unavailable — no LLM provider configured" };

      const rows = await service.list(source, project_slug);

      // Group by source for a summary
      const bySource: Record<string, number> = {};
      for (const row of rows) {
        bySource[row.source] = (bySource[row.source] ?? 0) + 1;
      }

      return {
        totalEmbeddings: rows.length,
        sources: Object.entries(bySource).map(([id, count]) => ({ id, count })),
      };
    },
  },
  {
    name: "cluster_topics",
    description:
      "Run topic clustering on stored embeddings using K-means++. Groups similar items into labeled clusters. Great for discovering content themes in GSC queries or issues.",
    parameters: z.object({
      source: z
        .string()
        .optional()
        .describe("Cluster only items from this source, or all if omitted"),
      project_slug: z.string().optional().describe("Filter by project"),
      num_clusters: z
        .number()
        .optional()
        .default(5)
        .describe("Target number of clusters (default: 5)"),
    }),
    execute: async (args, api: PluginAPI) => {
      const { source, project_slug, num_clusters } = args as {
        source?: string;
        project_slug?: string;
        num_clusters?: number;
      };
      const settings = await getSettings(api);
      const service = await getService(settings);
      if (!service) return { error: "Embedding service unavailable — no LLM provider configured" };

      const rows = await service.list(source, project_slug);
      if (rows.length === 0) {
        return { clusters: [], message: "No embeddings found to cluster" };
      }

      const clusters = clusterEmbeddings(rows, { k: num_clusters ?? settings.clusterCount ?? 5 });
      return {
        clusters: clusters.map((c) => ({
          id: c.id,
          label: c.label,
          itemCount: c.items.length,
          topItems: c.items.slice(0, 10).map((item) => ({
            text: item.text,
            source: item.source,
            similarity: Math.round(item.similarity * 1000) / 1000,
          })),
        })),
      };
    },
  },
];
