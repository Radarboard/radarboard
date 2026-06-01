/**
 * Embeddings & Clustering — Plugin Descriptor
 *
 * Provides generic vector embedding capabilities for semantic search and
 * topic clustering. Any integration can send data for embedding via intents.
 */

import type { EmbeddingService } from "@radarboard/embedding-service";
import type { PluginDescriptor, PluginServerRuntime } from "@radarboard/plugin-sdk/types";
import { BrainCircuit } from "lucide-react";
import { EmbeddingsOverlay } from "./components/embeddings-overlay";
import { embeddingsMcpTools, setEmbeddingServiceResolver } from "./mcp-tools";
import { type EmbeddingsRouteBody, handleEmbeddingsRoute } from "./server/routes";
import { EMBEDDING_MODEL_GROUPS } from "./types";

type EmbeddingServiceResolver = (options?: {
  modelId?: string;
  providerId?: string;
  dimensions?: number;
}) => Promise<EmbeddingService | null>;

function getEmbeddingServiceResolver(
  runtime: PluginServerRuntime
): EmbeddingServiceResolver | null {
  const resolver = runtime.services.getEmbeddingService;
  return typeof resolver === "function" ? (resolver as EmbeddingServiceResolver) : null;
}

export const embeddingsDescriptor: PluginDescriptor = {
  id: "embeddings",
  name: "Embeddings & Clustering",
  description:
    "Generate vector embeddings for semantic search and topic clustering across integration data",
  icon: BrainCircuit,
  category: "data",
  version: "0.1.0",

  launchSurfaces: ["palette"],
  presentation: { default: "side-panel", alternates: ["fullscreen"], size: "lg" },

  component: EmbeddingsOverlay,

  mcpTools: embeddingsMcpTools,

  server: {
    configure: (runtime) => {
      const resolver = getEmbeddingServiceResolver(runtime);
      if (resolver) setEmbeddingServiceResolver(resolver);
    },
    routes: {
      embeddings: async ({ body, runtime }) => {
        const typedBody = body as unknown as EmbeddingsRouteBody;
        const resolver = getEmbeddingServiceResolver(runtime);
        if (!resolver) {
          return {
            status: 503,
            payload: { error: "Embedding service unavailable — no LLM provider configured" },
          };
        }

        const service = await resolver({
          modelId: typedBody.modelId,
          providerId: typedBody.providerId,
          dimensions:
            typedBody.dimensions && typedBody.dimensions > 0 ? typedBody.dimensions : undefined,
        });
        if (!service) {
          return {
            status: 503,
            payload: { error: "Embedding service unavailable — no LLM provider configured" },
          };
        }

        return handleEmbeddingsRoute(service, typedBody);
      },
    },
  },

  intents: [
    {
      action: "embed-data",
      label: "Embed Data",
      description: "Send data to the embeddings plugin for vector embedding and indexing",
      accepts: ["text"],
      handle: async (_payload, api) => {
        api.notify("Data received for embedding.");
        return { success: true };
      },
    },
  ],

  settings: [
    {
      key: "enabled",
      label: "Enable Embeddings",
      description: "Generate and store vector embeddings for semantic search",
      type: "boolean",
      defaultValue: false,
    },
    {
      key: "provider-id",
      label: "Embedding Provider",
      description: "Which provider to use for embeddings. 'Auto' uses your global chat provider.",
      type: "select",
      defaultValue: "auto",
      options: [
        { label: "Auto (use chat provider)", value: "auto" },
        { label: "Ollama (local)", value: "ollama" },
        { label: "OpenAI", value: "openai" },
        { label: "Google", value: "google" },
      ],
    },
    {
      key: "model-id",
      label: "Embedding Model",
      description:
        "Choose a predefined model, or type a custom name below for unlisted Ollama models.",
      type: "select",
      defaultValue: "text-embedding-3-small",
      searchable: true,
      optionGroups: EMBEDDING_MODEL_GROUPS.map((group) => ({
        label: group.label,
        options: group.models.map((m) => ({
          label: m.name,
          value: m.id,
          description: `Dim: ${m.dimensions}${m.costPer1MTokens ? ` · $${m.costPer1MTokens}/1M tokens` : " · Free (local)"}`,
        })),
      })),
    },
    {
      key: "custom-model-id",
      label: "Custom Model Name",
      description:
        "Override with any Ollama model name (e.g. 'nomic-embed-text:v1.5'). Leave empty to use the selection above.",
      type: "text",
      defaultValue: "",
    },
    {
      key: "dimensions",
      label: "Output Dimensions",
      description:
        "Override embedding dimensions (only OpenAI text-embedding-3 models). 0 = use model default.",
      type: "number",
      defaultValue: 0,
    },
    {
      key: "cluster-count",
      label: "Default Cluster Count",
      description: "Number of topic clusters to generate (K-means k parameter)",
      type: "number",
      defaultValue: 5,
    },
    {
      key: "min-similarity",
      label: "Min Similarity Threshold",
      description: "Minimum cosine similarity (0-100) to include in search results. 0 = show all.",
      type: "number",
      defaultValue: 0,
    },
  ],
};
