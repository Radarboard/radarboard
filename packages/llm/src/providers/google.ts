import type { LlmProviderDescriptor } from "../types";

export const googleProvider: LlmProviderDescriptor = {
  id: "google",
  name: "Google",
  auth: "api_key",
  credentialKeyPrefix: "llm::google",
  credentialFields: [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      placeholder: "AIza...",
      required: true,
    },
  ],
  defaultModel: "gemini-2.5-flash",
  models: [
    {
      id: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      contextWindow: 1_000_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      contextWindow: 1_000_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash",
      contextWindow: 1_000_000,
      supportsTools: true,
      supportsStreaming: true,
    },
  ],
};
