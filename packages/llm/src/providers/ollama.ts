import type { LlmProviderDescriptor } from "../types";

export const ollamaProvider: LlmProviderDescriptor = {
  id: "ollama",
  name: "Ollama (Local)",
  auth: "none",
  credentialKeyPrefix: "llm::ollama",
  credentialFields: [
    {
      key: "baseUrl",
      label: "Base URL",
      type: "text",
      placeholder: "http://localhost:11434",
      required: true,
    },
  ],
  defaultModel: "llama3.1",
  models: [
    {
      id: "llama3.1",
      name: "Llama 3.1 (8B)",
      contextWindow: 128_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "llama3.1:70b",
      name: "Llama 3.1 (70B)",
      contextWindow: 128_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "mistral",
      name: "Mistral 7B",
      contextWindow: 32_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "codellama",
      name: "Code Llama",
      contextWindow: 16_000,
      supportsTools: false,
      supportsStreaming: true,
    },
    {
      id: "deepseek-coder-v2",
      name: "DeepSeek Coder V2",
      contextWindow: 128_000,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: "qwen2.5",
      name: "Qwen 2.5",
      contextWindow: 128_000,
      supportsTools: true,
      supportsStreaming: true,
    },
  ],
};
