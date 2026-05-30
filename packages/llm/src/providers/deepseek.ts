import type { LlmProviderDescriptor } from "../types";

export const deepseekProvider: LlmProviderDescriptor = {
  id: "deepseek",
  name: "DeepSeek",
  auth: "api_key",
  credentialKeyPrefix: "llm::deepseek",
  credentialFields: [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      placeholder: "sk-...",
      required: true,
    },
  ],
  defaultModel: "deepseek-chat",
  models: [
    {
      id: "deepseek-chat",
      name: "DeepSeek V3",
      contextWindow: 64_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "deepseek-reasoner",
      name: "DeepSeek R1",
      contextWindow: 64_000,
      supportsTools: true,
      supportsStreaming: true,
    },
  ],
};
