import type { LlmProviderDescriptor } from "../types";

export const mistralProvider: LlmProviderDescriptor = {
  id: "mistral",
  name: "Mistral AI",
  auth: "api_key",
  credentialKeyPrefix: "llm::mistral",
  credentialFields: [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      placeholder: "...",
      required: true,
    },
  ],
  defaultModel: "mistral-large-latest",
  models: [
    {
      id: "mistral-large-latest",
      name: "Mistral Large",
      contextWindow: 128_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "mistral-small-latest",
      name: "Mistral Small",
      contextWindow: 128_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "codestral-latest",
      name: "Codestral",
      contextWindow: 256_000,
      supportsTools: true,
      supportsStreaming: true,
    },
  ],
};
