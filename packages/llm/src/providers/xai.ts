import type { LlmProviderDescriptor } from "../types";

export const xaiProvider: LlmProviderDescriptor = {
  id: "xai",
  name: "xAI (Grok)",
  auth: "api_key",
  credentialKeyPrefix: "llm::xai",
  credentialFields: [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      placeholder: "xai-...",
      required: true,
    },
  ],
  defaultModel: "grok-3",
  models: [
    {
      id: "grok-3",
      name: "Grok 3",
      contextWindow: 131_072,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "grok-3-mini",
      name: "Grok 3 Mini",
      contextWindow: 131_072,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "grok-3-fast",
      name: "Grok 3 Fast",
      contextWindow: 131_072,
      supportsTools: true,
      supportsStreaming: true,
    },
  ],
};
