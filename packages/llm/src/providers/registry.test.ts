import { describe, expect, it } from "vitest";
import { getProvider, listProviders } from "./registry";

describe("LLM Provider Registry", () => {
  it("returns all registered providers", () => {
    const providers = listProviders();
    const ids = providers.map((p) => p.id);

    expect(ids).toContain("anthropic");
    expect(ids).toContain("openai");
    expect(ids).toContain("google");
    expect(ids).toContain("xai");
    expect(ids).toContain("deepseek");
    expect(ids).toContain("mistral");
    expect(ids).toContain("ollama");
    expect(providers.length).toBe(7);
  });

  it("retrieves a provider by id", () => {
    const provider = getProvider("anthropic");

    expect(provider).toBeDefined();
    expect(provider?.name).toBe("Anthropic");
    expect(provider?.auth).toBe("api_key");
  });

  it("returns undefined for unknown provider id", () => {
    const provider = getProvider("nonexistent");

    expect(provider).toBeUndefined();
  });

  it("every provider has a valid default model", () => {
    for (const provider of listProviders()) {
      const defaultModel = provider.models.find((m) => m.id === provider.defaultModel);
      expect(
        defaultModel,
        `${provider.id} defaultModel "${provider.defaultModel}" not found in models`
      ).toBeDefined();
    }
  });

  it("every provider has a credential key prefix starting with llm::", () => {
    for (const provider of listProviders()) {
      expect(provider.credentialKeyPrefix).toMatch(/^llm::/);
    }
  });

  it("every provider has at least one credential field", () => {
    for (const provider of listProviders()) {
      expect(provider.credentialFields.length).toBeGreaterThan(0);
    }
  });

  it("every provider has at least one model", () => {
    for (const provider of listProviders()) {
      expect(provider.models.length).toBeGreaterThan(0);
    }
  });
});
