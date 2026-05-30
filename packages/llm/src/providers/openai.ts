import type { LlmProviderDescriptor } from "../types";

export const openaiProvider: LlmProviderDescriptor = {
  id: "openai",
  name: "OpenAI",
  auth: "api_key",
  credentialKeyPrefix: "llm::openai",
  credentialFields: [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      placeholder: "sk-...",
      required: true,
    },
  ],
  defaultModel: "gpt-5.4-mini",
  models: [
    {
      id: "gpt-5.4",
      name: "GPT-5.4",
      contextWindow: 270_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "gpt-5.4-mini",
      name: "GPT-5.4 Mini",
      contextWindow: 270_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "gpt-5.4-nano",
      name: "GPT-5.4 Nano",
      contextWindow: 270_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "o4-mini",
      name: "o4-mini (Reasoning)",
      contextWindow: 200_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "gpt-4.1",
      name: "GPT-4.1",
      contextWindow: 1_000_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "gpt-4.1-mini",
      name: "GPT-4.1 Mini",
      contextWindow: 1_000_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "gpt-4.1-nano",
      name: "GPT-4.1 Nano",
      contextWindow: 1_000_000,
      supportsTools: true,
      supportsStreaming: true,
    },
  ],
};
