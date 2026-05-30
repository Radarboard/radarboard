import type { LlmProviderDescriptor } from "../types";

export const anthropicProvider: LlmProviderDescriptor = {
  id: "anthropic",
  name: "Anthropic",
  auth: "api_key",
  credentialKeyPrefix: "llm::anthropic",
  credentialFields: [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      placeholder: "sk-ant-api03-...",
      required: true,
    },
  ],
  defaultModel: "claude-sonnet-4-6",
  models: [
    {
      id: "claude-opus-4-6",
      name: "Claude Opus 4.6",
      contextWindow: 1_000_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "claude-sonnet-4-6",
      name: "Claude Sonnet 4.6",
      contextWindow: 1_000_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "claude-haiku-4-5",
      name: "Claude Haiku 4.5",
      contextWindow: 200_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "claude-sonnet-4-5",
      name: "Claude Sonnet 4.5",
      contextWindow: 1_000_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "claude-opus-4-5",
      name: "Claude Opus 4.5",
      contextWindow: 200_000,
      supportsTools: true,
      supportsStreaming: true,
    },
  ],
};
