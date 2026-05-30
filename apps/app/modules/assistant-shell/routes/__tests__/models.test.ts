import type { CredentialRepository } from "@radarboard/types/database";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listProvidersMock = vi.fn();
const isFeatureEnabledMock = vi.fn();
const featureNotFoundMock = vi.fn();

vi.mock("@radarboard/llm/providers/registry", () => ({
  listProviders: (...args: unknown[]) => listProvidersMock(...args),
}));

vi.mock("@/lib/features", () => ({
  isFeatureEnabled: (...args: unknown[]) => isFeatureEnabledMock(...args),
  featureNotFound: (...args: unknown[]) => featureNotFoundMock(...args),
}));

vi.mock("@/db/repository", () => ({
  getCredentialRepo: vi.fn(),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { getCredentialRepo } from "@/db/repository";
import { handleGetChatModels as GET } from "@/modules/assistant-shell/routes/models";

const mockCredRepo: Record<
  keyof Pick<CredentialRepository, "listCredentialKeys">,
  ReturnType<typeof vi.fn>
> = {
  listCredentialKeys: vi.fn(),
};

beforeEach(() => {
  listProvidersMock.mockReset();
  isFeatureEnabledMock.mockReset();
  featureNotFoundMock.mockReset();
  mockCredRepo.listCredentialKeys.mockReset();
  vi.mocked(getCredentialRepo).mockReturnValue(mockCredRepo as unknown as CredentialRepository);
  isFeatureEnabledMock.mockReturnValue(true);
});

describe("GET /api/chat/models", () => {
  it("returns 404 when assistant is disabled", async () => {
    isFeatureEnabledMock.mockReturnValue(false);
    const notFoundResponse = new Response(JSON.stringify({ error: "Feature not found" }), {
      status: 404,
    });
    featureNotFoundMock.mockReturnValue(notFoundResponse);

    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns only providers with matching credentials", async () => {
    mockCredRepo.listCredentialKeys.mockResolvedValue(["openai", "anthropic"]);

    listProvidersMock.mockReturnValue([
      {
        id: "openai",
        name: "OpenAI",
        credentialKeyPrefix: "openai",
        defaultModel: "gpt-4",
        models: [
          {
            id: "gpt-4",
            name: "GPT-4",
            contextWindow: 128000,
            supportsTools: true,
          },
        ],
      },
      {
        id: "anthropic",
        name: "Anthropic",
        credentialKeyPrefix: "anthropic",
        defaultModel: "claude-3-opus",
        models: [
          {
            id: "claude-3-opus",
            name: "Claude 3 Opus",
            contextWindow: 200000,
            supportsTools: true,
          },
        ],
      },
      {
        id: "google",
        name: "Google",
        credentialKeyPrefix: "google_ai",
        defaultModel: "gemini-pro",
        models: [
          {
            id: "gemini-pro",
            name: "Gemini Pro",
            contextWindow: 100000,
            supportsTools: false,
          },
        ],
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.providers).toHaveLength(2);
    expect(body.providers.map((p: { id: string }) => p.id)).toEqual(["openai", "anthropic"]);
  });

  it("returns empty providers when no credentials configured", async () => {
    mockCredRepo.listCredentialKeys.mockResolvedValue([]);
    listProvidersMock.mockReturnValue([
      {
        id: "openai",
        name: "OpenAI",
        credentialKeyPrefix: "openai",
        defaultModel: "gpt-4",
        models: [],
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.providers).toEqual([]);
  });

  it("returns model details for each matched provider", async () => {
    mockCredRepo.listCredentialKeys.mockResolvedValue(["openai"]);
    listProvidersMock.mockReturnValue([
      {
        id: "openai",
        name: "OpenAI",
        credentialKeyPrefix: "openai",
        defaultModel: "gpt-4",
        models: [
          {
            id: "gpt-4",
            name: "GPT-4",
            contextWindow: 128000,
            supportsTools: true,
            internalField: "should be stripped",
          },
        ],
      },
    ]);

    const res = await GET();
    const body = await res.json();

    const provider = body.providers[0];
    expect(provider.models[0]).toEqual({
      id: "gpt-4",
      name: "GPT-4",
      contextWindow: 128000,
      supportsTools: true,
    });
    // Internal fields should not leak
    expect(provider.models[0].internalField).toBeUndefined();
  });

  it("returns 500 on credential repo error", async () => {
    mockCredRepo.listCredentialKeys.mockRejectedValue(new Error("DB connection lost"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatch(/Failed to list models/);
    expect(body.error).toContain("DB connection lost");
  });
});
