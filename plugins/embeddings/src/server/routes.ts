import type { EmbeddingModelId } from "@radarboard/llm/types";
import type { EmbeddingRow } from "@radarboard/types/database";
import { clusterEmbeddings } from "../clustering";

export interface EmbeddingsRouteBody {
  action:
    | "embed"
    | "embed_batch"
    | "find_similar"
    | "list"
    | "delete"
    | "delete_by_source"
    | "cluster";
  modelId?: EmbeddingModelId;
  providerId?: string;
  dimensions?: number;
  text?: string;
  source?: string;
  sourceId?: string;
  projectSlug?: string;
  metadata?: Record<string, unknown>;
  items?: Array<{
    source: string;
    sourceId: string;
    text: string;
    projectSlug?: string;
    metadata?: Record<string, unknown>;
  }>;
  query?: string;
  limit?: number;
  minSimilarity?: number;
  id?: string;
  numClusters?: number;
}

interface SimilarityResult {
  row: EmbeddingRow;
  similarity: number;
}

interface EmbeddingServiceLike {
  embedAndStore(input: {
    source: string;
    sourceId: string;
    text: string;
    projectSlug?: string;
    metadata?: Record<string, unknown>;
  }): Promise<EmbeddingRow>;
  embedAndStoreBatch(
    items: Array<{
      source: string;
      sourceId: string;
      text: string;
      projectSlug?: string;
      metadata?: Record<string, unknown>;
    }>
  ): Promise<EmbeddingRow[]>;
  findSimilar(
    query: string,
    options?: {
      source?: string;
      projectSlug?: string;
      limit?: number;
      minSimilarity?: number;
    }
  ): Promise<SimilarityResult[]>;
  list(source?: string, projectSlug?: string): Promise<EmbeddingRow[]>;
  delete(id: string): Promise<void>;
  deleteBySource(source: string, projectSlug?: string): Promise<void>;
}

export async function handleEmbeddingsRoute(
  service: EmbeddingServiceLike,
  body: EmbeddingsRouteBody
): Promise<{ status: number; payload: Record<string, unknown> }> {
  switch (body.action) {
    case "embed": {
      if (!body.text || !body.source || !body.sourceId) {
        return { status: 400, payload: { error: "text, source, and sourceId are required" } };
      }
      const row = await service.embedAndStore({
        source: body.source,
        sourceId: body.sourceId,
        text: body.text,
        projectSlug: body.projectSlug,
        metadata: body.metadata,
      });
      return {
        status: 200,
        payload: {
          row: {
            id: row.id,
            source: row.source,
            sourceId: row.sourceId,
            dimensions: row.dimensions,
            modelId: row.modelId,
          },
        },
      };
    }

    case "embed_batch": {
      if (!body.items?.length) {
        return { status: 400, payload: { error: "items array is required" } };
      }
      const rows = await service.embedAndStoreBatch(body.items);
      return {
        status: 200,
        payload: {
          count: rows.length,
          rows: rows.map((row) => ({ id: row.id, source: row.source, sourceId: row.sourceId })),
        },
      };
    }

    case "find_similar": {
      if (!body.query) {
        return { status: 400, payload: { error: "query is required" } };
      }
      const results = await service.findSimilar(body.query, {
        source: body.source,
        projectSlug: body.projectSlug,
        limit: body.limit,
        minSimilarity: body.minSimilarity,
      });
      return {
        status: 200,
        payload: {
          results: results.map((result) => ({
            id: result.row.id,
            text: result.row.text,
            source: result.row.source,
            sourceId: result.row.sourceId,
            similarity: Math.round(result.similarity * 1000) / 1000,
            metadata: result.row.metadata ? JSON.parse(result.row.metadata) : null,
          })),
        },
      };
    }

    case "list": {
      const rows = await service.list(body.source, body.projectSlug);
      return {
        status: 200,
        payload: {
          count: rows.length,
          rows: rows.map((row) => ({
            id: row.id,
            source: row.source,
            sourceId: row.sourceId,
            text: row.text.slice(0, 100),
            modelId: row.modelId,
            dimensions: row.dimensions,
          })),
        },
      };
    }

    case "delete": {
      if (!body.id) {
        return { status: 400, payload: { error: "id is required" } };
      }
      await service.delete(body.id);
      return { status: 200, payload: { deleted: true } };
    }

    case "delete_by_source": {
      if (!body.source) {
        return { status: 400, payload: { error: "source is required" } };
      }
      await service.deleteBySource(body.source, body.projectSlug);
      return { status: 200, payload: { deleted: true, source: body.source } };
    }

    case "cluster": {
      const rows = await service.list(body.source, body.projectSlug);
      if (rows.length === 0) {
        return {
          status: 200,
          payload: { clusters: [], message: "No embeddings found to cluster" },
        };
      }
      const clusters = clusterEmbeddings(rows, { k: body.numClusters ?? 5 });
      return {
        status: 200,
        payload: {
          clusters: clusters.map((cluster) => ({
            id: cluster.id,
            label: cluster.label,
            itemCount: cluster.items.length,
            items: cluster.items.slice(0, 20).map((item) => ({
              text: item.text,
              source: item.source,
              sourceId: item.sourceId,
              similarity: Math.round(item.similarity * 1000) / 1000,
            })),
          })),
        },
      };
    }

    default:
      return { status: 400, payload: { error: `Unknown action: ${body.action}` } };
  }
}
