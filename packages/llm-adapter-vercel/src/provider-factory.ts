/**
 * Maps provider IDs to AI SDK LanguageModel instances.
 *
 * This is the only file that imports from @ai-sdk/anthropic, @ai-sdk/openai, etc.
 * When switching adapters, this entire package gets swapped — nothing leaks.
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";
import { createOllama } from "ollama-ai-provider";

const SUPPORTED_PROVIDERS = new Set([
  "anthropic",
  "openai",
  "google",
  "xai",
  "deepseek",
  "mistral",
  "ollama",
]);

/** Check if a provider ID is supported by this adapter. */
export function isSupportedProvider(providerId: string): boolean {
  return SUPPORTED_PROVIDERS.has(providerId);
}

interface CreateModelParams {
  providerId: string;
  /** API key for cloud providers, or base URL for Ollama. */
  apiKey: string;
  modelId: string;
}

/** Create an AI SDK LanguageModel for the given provider + model + API key. */
export function createLanguageModel(params: CreateModelParams): LanguageModel {
  const { providerId, apiKey, modelId } = params;

  switch (providerId) {
    case "anthropic": {
      const provider = createAnthropic({ apiKey });
      return provider(modelId);
    }
    case "openai": {
      const provider = createOpenAI({ apiKey });
      return provider(modelId);
    }
    case "google": {
      const provider = createGoogleGenerativeAI({ apiKey });
      return provider(modelId);
    }
    case "xai": {
      const provider = createXai({ apiKey });
      return provider(modelId);
    }
    case "deepseek": {
      const provider = createDeepSeek({ apiKey });
      return provider(modelId);
    }
    case "mistral": {
      const provider = createMistral({ apiKey });
      return provider(modelId);
    }
    case "ollama": {
      // For Ollama, `apiKey` is actually the base URL
      const provider = createOllama({ baseURL: `${apiKey}/api` });
      return provider(modelId) as unknown as LanguageModel;
    }
    default:
      throw new Error(`Unsupported LLM provider: ${providerId}`);
  }
}
