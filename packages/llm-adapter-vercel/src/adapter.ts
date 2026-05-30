/**
 * Vercel AI SDK v6 adapter implementing the @radarboard/llm LlmAdapter interface.
 *
 * This is the ONLY package that depends on `ai`, `@ai-sdk/anthropic`, etc.
 * Swapping to TanStack AI = replacing this package with @radarboard/llm-adapter-tanstack.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type {
  EmbeddingModelId,
  EmbedParams,
  EmbedResult,
  GenerateTextParams,
  GenerateTextResult,
  LlmAdapter,
  StreamChatParams,
} from "@radarboard/llm/types";
import {
  embed as aiEmbed,
  embedMany as aiEmbedMany,
  generateText as aiGenerateText,
  stepCountIs,
  streamText,
} from "ai";
import { createOllama } from "ollama-ai-provider";
import { convertFromLlmMessages } from "./message-converter";
import { createLanguageModel, isSupportedProvider } from "./provider-factory";

/** Create a Vercel AI SDK adapter instance. */
export function createVercelAdapter(): LlmAdapter {
  return {
    streamChat,
    generateText,
    embed,
  };
}

/**
 * Split a system prompt into static (cacheable) and dynamic parts for Anthropic.
 * Uses [IDENTITY] and [SKILLS] as the cache boundary — everything up to and
 * including skills is static; the rest (context, memory, tools) changes per request.
 */
function splitCacheablePrompt(
  systemPrompt: string
): { staticPrefix: string; dynamicSuffix: string } | null {
  const skillsIdx = systemPrompt.indexOf("[SKILLS]");
  const identityIdx = systemPrompt.indexOf("[IDENTITY]");

  if (identityIdx === -1) return null;

  let splitPoint: number;
  if (skillsIdx !== -1) {
    const afterSkills = systemPrompt.indexOf("\n[", skillsIdx + 8);
    splitPoint = afterSkills !== -1 ? afterSkills : systemPrompt.length;
  } else {
    const afterIdentity = systemPrompt.indexOf("\n[", identityIdx + 10);
    splitPoint = afterIdentity !== -1 ? afterIdentity : systemPrompt.length;
  }

  const staticPrefix = systemPrompt.slice(0, splitPoint).trim();
  const dynamicSuffix = systemPrompt.slice(splitPoint).trim();

  // Only cache if static part is substantial (>= 1024 chars ≈ 256 tokens)
  if (staticPrefix.length < 1024) return null;

  return { staticPrefix, dynamicSuffix };
}

async function streamChat(params: StreamChatParams): Promise<Response> {
  if (!isSupportedProvider(params.providerId)) {
    throw new Error(`Unsupported LLM provider: ${params.providerId}`);
  }

  const model = createLanguageModel({
    providerId: params.providerId,
    apiKey: params.apiKey,
    modelId: params.model,
  });

  const messages = convertFromLlmMessages(params.messages);

  // For Anthropic, split system prompt for prompt caching (90% cheaper reads)
  const cacheSplit =
    params.providerId === "anthropic" ? splitCacheablePrompt(params.systemPrompt) : null;

  // biome-ignore lint/suspicious/noExplicitAny: Vercel AI SDK system param accepts string | content parts
  const systemPrompt: any = cacheSplit
    ? [
        {
          type: "text",
          text: cacheSplit.staticPrefix,
          providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
        },
        { type: "text", text: cacheSplit.dynamicSuffix },
      ]
    : params.systemPrompt;

  const result = streamText({
    model,
    system: systemPrompt,
    messages,
    tools: params.nativeTools as Parameters<typeof streamText>[0]["tools"],
    stopWhen: params.nativeTools ? stepCountIs(8) : undefined,
    onFinish: params.onFinish
      ? async ({ text, usage }) => {
          await params.onFinish?.({
            text,
            usage:
              usage.inputTokens != null && usage.outputTokens != null
                ? {
                    promptTokens: usage.inputTokens,
                    completionTokens: usage.outputTokens,
                    totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
                  }
                : undefined,
          });
        }
      : undefined,
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === "finish") {
        const { inputTokens, outputTokens } = part.totalUsage;
        return {
          usage: {
            promptTokens: inputTokens ?? 0,
            completionTokens: outputTokens ?? 0,
            totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0),
          },
          model: params.model,
        };
      }
      return undefined;
    },
  });
}

async function embed(params: EmbedParams): Promise<EmbedResult> {
  if (!isSupportedProvider(params.providerId)) {
    throw new Error(`Unsupported LLM provider: ${params.providerId}`);
  }

  const model = createEmbeddingModel(params.providerId, params.apiKey, params.modelId);

  const { embeddings, usage } = await aiEmbedMany({
    model,
    values: params.texts,
    ...(params.dimensions != null && {
      experimental_dimensions: params.dimensions,
    }),
  });

  return {
    embeddings,
    usage: usage ? { totalTokens: usage.tokens } : undefined,
  };
}

async function generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
  if (!isSupportedProvider(params.providerId)) {
    throw new Error(`Unsupported LLM provider: ${params.providerId}`);
  }

  const model = createLanguageModel({
    providerId: params.providerId,
    apiKey: params.apiKey,
    modelId: params.model,
  });

  const messages = convertFromLlmMessages(params.messages);
  const { text, usage } = await aiGenerateText({
    model,
    system: params.systemPrompt,
    messages,
  });

  return {
    text,
    usage:
      usage.inputTokens != null && usage.outputTokens != null
        ? {
            promptTokens: usage.inputTokens,
            completionTokens: usage.outputTokens,
            totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
          }
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// Embedding model factory
// ---------------------------------------------------------------------------

/** Default embedding model per provider. */
const DEFAULT_EMBEDDING_MODELS: Record<string, EmbeddingModelId> = {
  openai: "text-embedding-3-small",
  anthropic: "text-embedding-3-small",
  google: "text-embedding-004",
  ollama: "nomic-embed-text",
};

function createEmbeddingModel(providerId: string, apiKey: string, modelId?: EmbeddingModelId) {
  const resolvedModel = modelId ?? DEFAULT_EMBEDDING_MODELS[providerId];

  switch (providerId) {
    case "openai":
    case "anthropic": {
      // Anthropic has no embedding API — use OpenAI's model
      const openai = createOpenAI({ apiKey });
      return openai.embedding(resolvedModel ?? "text-embedding-3-small");
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey });
      return google.embedding(resolvedModel ?? "text-embedding-004");
    }
    case "ollama": {
      // For Ollama, `apiKey` is actually the base URL.
      // Cast needed: ollama-ai-provider returns EmbeddingModelV1, SDK v6 expects V3.
      const ollama = createOllama({ baseURL: `${apiKey}/api` });
      // biome-ignore lint/suspicious/noExplicitAny: ollama provider version mismatch with AI SDK v6
      return ollama.embedding(resolvedModel ?? "nomic-embed-text") as any;
    }
    default:
      throw new Error(`Unsupported LLM provider for embeddings: ${providerId}`);
  }
}

/**
 * Create a standalone embed function for use with MemoryService or EmbeddingService.
 * Returns a function: text → number[] embedding vector.
 */
export function createEmbedFn(params: {
  providerId: string;
  apiKey: string;
  modelId?: EmbeddingModelId;
  dimensions?: number;
}): (text: string) => Promise<number[]> {
  if (!isSupportedProvider(params.providerId)) {
    throw new Error(`Unsupported LLM provider: ${params.providerId}`);
  }

  const model = createEmbeddingModel(params.providerId, params.apiKey, params.modelId);

  return async (text: string): Promise<number[]> => {
    const { embedding } = await aiEmbed({
      model,
      value: text,
      ...(params.dimensions != null && {
        experimental_dimensions: params.dimensions,
      }),
    });
    return embedding;
  };
}

/**
 * Create a standalone batch embed function.
 * Returns a function: texts[] → number[][] embedding vectors.
 */
export function createBatchEmbedFn(params: {
  providerId: string;
  apiKey: string;
  modelId?: EmbeddingModelId;
  dimensions?: number;
}): (texts: string[]) => Promise<number[][]> {
  if (!isSupportedProvider(params.providerId)) {
    throw new Error(`Unsupported LLM provider: ${params.providerId}`);
  }

  const model = createEmbeddingModel(params.providerId, params.apiKey, params.modelId);

  return async (texts: string[]): Promise<number[][]> => {
    const { embeddings } = await aiEmbedMany({
      model,
      values: texts,
      ...(params.dimensions != null && {
        experimental_dimensions: params.dimensions,
      }),
    });
    return embeddings;
  };
}
