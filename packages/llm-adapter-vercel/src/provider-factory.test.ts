import { describe, expect, it } from "vitest";
import { createLanguageModel, isSupportedProvider } from "./provider-factory";

describe("provider-factory", () => {
  describe("isSupportedProvider", () => {
    it("returns true for anthropic", () => {
      expect(isSupportedProvider("anthropic")).toBe(true);
    });

    it("returns true for openai", () => {
      expect(isSupportedProvider("openai")).toBe(true);
    });

    it("returns true for google", () => {
      expect(isSupportedProvider("google")).toBe(true);
    });

    it("returns false for unknown providers", () => {
      expect(isSupportedProvider("cohere")).toBe(false);
      expect(isSupportedProvider("")).toBe(false);
    });
  });

  describe("createLanguageModel", () => {
    it("creates an Anthropic model instance", () => {
      const model = createLanguageModel({
        providerId: "anthropic",
        apiKey: "test-key",
        modelId: "claude-sonnet-4-20250514",
      });

      expect(model).toBeDefined();
      expect(typeof model).toBe("object");
    });

    it("creates an OpenAI model instance", () => {
      const model = createLanguageModel({
        providerId: "openai",
        apiKey: "test-key",
        modelId: "gpt-4o",
      });

      expect(model).toBeDefined();
      expect(typeof model).toBe("object");
    });

    it("creates a Google model instance", () => {
      const model = createLanguageModel({
        providerId: "google",
        apiKey: "test-key",
        modelId: "gemini-2.5-flash",
      });

      expect(model).toBeDefined();
      expect(typeof model).toBe("object");
    });

    it("throws for unsupported provider", () => {
      expect(() =>
        createLanguageModel({
          providerId: "unknown",
          apiKey: "test-key",
          modelId: "some-model",
        })
      ).toThrow("Unsupported LLM provider: unknown");
    });
  });
});
