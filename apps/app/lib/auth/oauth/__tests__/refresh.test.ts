import { beforeEach, describe, expect, it, vi } from "vitest";
import { isExpiredOAuthToken, refreshOAuthToken } from "../refresh";

const mockRepo = {
  getCredential: vi.fn(),
  setCredential: vi.fn().mockResolvedValue(undefined),
  deleteCredential: vi.fn(),
  listCredentialKeys: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("oauth refresh", () => {
  it("detects expired oauth tokens", () => {
    expect(
      isExpiredOAuthToken({ authMethod: "oauth", expiresAt: "2000-01-01T00:00:00.000Z" })
    ).toBe(true);
    expect(
      isExpiredOAuthToken({ authMethod: "oauth", expiresAt: "2999-01-01T00:00:00.000Z" })
    ).toBe(false);
    expect(isExpiredOAuthToken({ authMethod: "api_key", expiresAt: "2000-01-01" })).toBe(false);
  });

  it("throws when no refresh token is present", async () => {
    await expect(
      refreshOAuthToken(
        "openai",
        {
          apiKey: "token",
          refreshToken: null,
          clientId: "client-id",
          clientSecret: null,
          tokenType: "bearer",
          expiresAt: "2000-01-01T00:00:00.000Z",
          authMethod: "oauth",
        },
        mockRepo as never
      )
    ).rejects.toThrow("No refresh token available");
  });
});
