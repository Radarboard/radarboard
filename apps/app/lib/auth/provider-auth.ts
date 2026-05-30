export interface ProviderAuthMethod {
  type: "oauth" | "api";
  label: string;
}

const API_KEY_METHOD: ProviderAuthMethod = {
  type: "api",
  label: "API key",
};

/**
 * Provider auth methods exposed to the UI.
 * Mirrors the OpenCode pattern: each provider declares supported auth methods.
 */
export function getProviderAuthMethods(providerId: string): ProviderAuthMethod[] {
  switch (providerId) {
    case "openai":
      return [{ type: "oauth", label: "Login with ChatGPT Plus/Pro" }, API_KEY_METHOD];
    case "anthropic":
      return [API_KEY_METHOD];
    case "google":
    case "xai":
    case "deepseek":
    case "mistral":
    case "ollama":
      return [API_KEY_METHOD];
    default:
      return [API_KEY_METHOD];
  }
}
