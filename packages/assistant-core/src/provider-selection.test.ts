import type { CredentialRepository } from "@radarboard/types/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveModelSelection,
  resolveProvider,
  resolveProviderCredentials,
} from "./provider-selection";

const { getProviderMock, listProvidersMock } = vi.hoisted(() => ({
  getProviderMock: vi.fn(),
  listProvidersMock: vi.fn(),
}));

vi.mock("@radarboard/llm/providers/registry", () => ({
  getProvider: getProviderMock,
  listProviders: listProvidersMock,
}));

describe("provider selection", () => {
  const credentialRepo = {
    getCredential: vi.fn(),
  } as unknown as CredentialRepository;

  const deps = {
    isExpiredOAuthToken: vi.fn(),
    refreshOAuthToken: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the provider is unknown or credentials are unusable", async () => {
    getProviderMock.mockReturnValue(undefined);

    await expect(resolveProviderCredentials("missing", credentialRepo, deps)).resolves.toBeNull();

    getProviderMock.mockReturnValue({
      id: "openai",
      credentialKeyPrefix: "openai",
      defaultModel: "gpt-4o-mini",
    });
    (credentialRepo.getCredential as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      null
    );

    await expect(resolveProviderCredentials("openai", credentialRepo, deps)).resolves.toBeNull();
  });

  it("refreshes expired OAuth tokens and falls back to apiKey or baseUrl credentials", async () => {
    getProviderMock.mockReturnValue({
      id: "anthropic",
      credentialKeyPrefix: "anthropic",
      defaultModel: "claude-sonnet-4-6",
    });
    (credentialRepo.getCredential as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ refreshToken: "refresh-token" })
      .mockResolvedValueOnce({ apiKey: "api-key" })
      .mockResolvedValueOnce({ baseUrl: "http://localhost:11434" });
    deps.isExpiredOAuthToken.mockReturnValueOnce(true).mockReturnValue(false);
    deps.refreshOAuthToken.mockResolvedValueOnce("fresh-token");

    await expect(resolveProviderCredentials("anthropic", credentialRepo, deps)).resolves.toEqual({
      providerId: "anthropic",
      apiKey: "fresh-token",
    });
    await expect(resolveProviderCredentials("anthropic", credentialRepo, deps)).resolves.toEqual({
      providerId: "anthropic",
      apiKey: "api-key",
    });
    await expect(resolveProviderCredentials("anthropic", credentialRepo, deps)).resolves.toEqual({
      providerId: "anthropic",
      apiKey: "http://localhost:11434",
    });
  });

  it("resolves the first available provider and model selection fallback logic", async () => {
    listProvidersMock.mockReturnValue([{ id: "openai" }, { id: "anthropic" }]);
    getProviderMock.mockImplementation((providerId: string) => {
      if (providerId === "openai") {
        return { id: "openai", credentialKeyPrefix: "openai", defaultModel: "gpt-4o-mini" };
      }
      if (providerId === "anthropic") {
        return {
          id: "anthropic",
          credentialKeyPrefix: "anthropic",
          defaultModel: "claude-sonnet-4-6",
        };
      }
      return undefined;
    });
    (credentialRepo.getCredential as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ apiKey: "anthropic-key" })
      .mockResolvedValueOnce(null);
    deps.isExpiredOAuthToken.mockReturnValue(false);

    await expect(resolveProvider(credentialRepo, deps)).resolves.toEqual({
      providerId: "anthropic",
      apiKey: "anthropic-key",
    });

    await expect(
      resolveModelSelection(
        null,
        { providerId: "openai", apiKey: "fallback-key" },
        credentialRepo,
        deps
      )
    ).resolves.toEqual({
      providerId: "openai",
      apiKey: "fallback-key",
      modelId: "gpt-4o-mini",
    });

    await expect(
      resolveModelSelection(
        "anthropic:claude-haiku",
        { providerId: "openai", apiKey: "fallback-key" },
        credentialRepo,
        deps
      )
    ).resolves.toEqual({
      providerId: "openai",
      apiKey: "fallback-key",
      modelId: "gpt-4o-mini",
    });
  });
});
