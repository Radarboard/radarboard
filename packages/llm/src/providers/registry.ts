import type { LlmProviderDescriptor } from "../types";
import { anthropicProvider } from "./anthropic";
import { deepseekProvider } from "./deepseek";
import { googleProvider } from "./google";
import { mistralProvider } from "./mistral";
import { ollamaProvider } from "./ollama";
import { openaiProvider } from "./openai";
import { xaiProvider } from "./xai";

const PROVIDERS: ReadonlyMap<string, LlmProviderDescriptor> = new Map([
  [anthropicProvider.id, anthropicProvider],
  [openaiProvider.id, openaiProvider],
  [googleProvider.id, googleProvider],
  [xaiProvider.id, xaiProvider],
  [deepseekProvider.id, deepseekProvider],
  [mistralProvider.id, mistralProvider],
  [ollamaProvider.id, ollamaProvider],
]);

/** Get all registered LLM provider descriptors. */
export function listProviders(): LlmProviderDescriptor[] {
  return [...PROVIDERS.values()];
}

/** Get a single provider descriptor by its id. Returns undefined if not found. */
export function getProvider(id: string): LlmProviderDescriptor | undefined {
  return PROVIDERS.get(id);
}
