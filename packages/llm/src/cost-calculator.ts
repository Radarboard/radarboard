/**
 * LLM cost calculator.
 *
 * Maps (providerId, modelId) to per-million-token pricing and calculates
 * the cost of individual requests from token usage data.
 *
 * Prices as of March 2026. Update periodically as providers adjust pricing.
 */

interface ModelPricing {
  /** Cost per 1M input tokens in USD. */
  inputPer1M: number;
  /** Cost per 1M output tokens in USD. */
  outputPer1M: number;
}

/**
 * Pricing table: `providerId::modelId` → pricing.
 * Models not listed fall back to provider defaults, then to zero.
 */
const PRICING: Record<string, ModelPricing> = {
  // Anthropic
  "anthropic::claude-opus-4-6": { inputPer1M: 15, outputPer1M: 75 },
  "anthropic::claude-sonnet-4-6": { inputPer1M: 3, outputPer1M: 15 },
  "anthropic::claude-haiku-4-5": { inputPer1M: 0.8, outputPer1M: 4 },
  "anthropic::claude-sonnet-4-5": { inputPer1M: 3, outputPer1M: 15 },
  "anthropic::claude-opus-4-5": { inputPer1M: 15, outputPer1M: 75 },

  // OpenAI
  "openai::gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "openai::gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "openai::gpt-4-turbo": { inputPer1M: 10, outputPer1M: 30 },
  "openai::o1": { inputPer1M: 15, outputPer1M: 60 },
  "openai::o1-mini": { inputPer1M: 1.1, outputPer1M: 4.4 },
  "openai::o3-mini": { inputPer1M: 1.1, outputPer1M: 4.4 },

  // Google
  "google::gemini-2.0-flash": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "google::gemini-1.5-pro": { inputPer1M: 1.25, outputPer1M: 5 },
  "google::gemini-1.5-flash": { inputPer1M: 0.075, outputPer1M: 0.3 },

  // xAI
  "xai::grok-2": { inputPer1M: 2, outputPer1M: 10 },
  "xai::grok-3": { inputPer1M: 3, outputPer1M: 15 },

  // DeepSeek
  "deepseek::deepseek-chat": { inputPer1M: 0.14, outputPer1M: 0.28 },
  "deepseek::deepseek-reasoner": { inputPer1M: 0.55, outputPer1M: 2.19 },

  // Mistral
  "mistral::mistral-large": { inputPer1M: 2, outputPer1M: 6 },
  "mistral::mistral-small": { inputPer1M: 0.2, outputPer1M: 0.6 },
};

/** Default pricing for unknown models (conservative estimate). */
const DEFAULT_PRICING: ModelPricing = { inputPer1M: 3, outputPer1M: 15 };

/** Zero pricing for local models. */
const FREE_PROVIDERS = new Set(["ollama"]);

export interface CostResult {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

/**
 * Calculate the cost of an LLM request from token usage.
 */
export function calculateCost(
  providerId: string,
  modelId: string,
  promptTokens: number,
  completionTokens: number
): CostResult {
  if (FREE_PROVIDERS.has(providerId)) {
    return { inputCostUsd: 0, outputCostUsd: 0, totalCostUsd: 0 };
  }

  const key = `${providerId}::${modelId}`;
  const pricing = PRICING[key] ?? DEFAULT_PRICING;

  const inputCostUsd = (promptTokens / 1_000_000) * pricing.inputPer1M;
  const outputCostUsd = (completionTokens / 1_000_000) * pricing.outputPer1M;

  return {
    inputCostUsd: Math.round(inputCostUsd * 1_000_000) / 1_000_000, // 6 decimal places
    outputCostUsd: Math.round(outputCostUsd * 1_000_000) / 1_000_000,
    totalCostUsd: Math.round((inputCostUsd + outputCostUsd) * 1_000_000) / 1_000_000,
  };
}

/**
 * Get pricing info for a model. Returns null for free/local providers.
 */
export function getModelPricing(providerId: string, modelId: string): ModelPricing | null {
  if (FREE_PROVIDERS.has(providerId)) return null;
  return PRICING[`${providerId}::${modelId}`] ?? DEFAULT_PRICING;
}

/**
 * Aggregate costs from multiple trace rows.
 */
export function aggregateCosts(
  traces: Array<{
    providerId: string;
    modelId: string;
    promptTokens: number;
    completionTokens: number;
  }>
): CostResult {
  let totalInput = 0;
  let totalOutput = 0;

  for (const trace of traces) {
    const cost = calculateCost(
      trace.providerId,
      trace.modelId,
      trace.promptTokens,
      trace.completionTokens
    );
    totalInput += cost.inputCostUsd;
    totalOutput += cost.outputCostUsd;
  }

  return {
    inputCostUsd: Math.round(totalInput * 1_000_000) / 1_000_000,
    outputCostUsd: Math.round(totalOutput * 1_000_000) / 1_000_000,
    totalCostUsd: Math.round((totalInput + totalOutput) * 1_000_000) / 1_000_000,
  };
}
