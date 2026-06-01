import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  credentials: {} as Record<string, Record<string, string>>,
}));

vi.mock("@/data/core/repository", () => ({
  getCredentialRepo: () => ({
    getCredential: vi.fn(async (key: string) => mocks.credentials[key] ?? null),
  }),
  getGitHubStarHistoryRepo: () => ({}),
  getSettingsRepo: () => ({
    getProjectIntegrations: vi.fn(async () => ({})),
  }),
}));

vi.mock("@/lib/mcp/mcp-client", () => ({
  getMcpClient: vi.fn(),
}));

vi.mock("@/lib/mcp/named-mcp-client", () => ({
  callNamedMcpToolJson: vi.fn(),
  listNamedMcpTools: vi.fn(),
}));

vi.mock("@/lib/projects/derived-projects", () => ({
  deriveAllProjects: vi.fn(() => []),
}));

import { buildDataSourceContext } from "../data-source-context";

describe("buildDataSourceContext", () => {
  beforeEach(() => {
    mocks.credentials = {};
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves regular credentials unchanged", async () => {
    mocks.credentials.github = { token: "gh-token" };

    await expect(buildDataSourceContext().resolveCredential("github")).resolves.toEqual({
      token: "gh-token",
    });
  });

  it("converts broker-backed Google Search Console credentials to short-lived access tokens", async () => {
    mocks.credentials["google-search-console"] = {
      authMethod: "oauth_broker",
      brokerUrl: "https://auth.radarboard.app",
      brokerCredentialToken: "broker-token",
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: "google-access-token" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      buildDataSourceContext().resolveCredential("google-search-console")
    ).resolves.toEqual({
      authMethod: "oauth_broker",
      brokerUrl: "https://auth.radarboard.app",
      brokerCredentialToken: "broker-token",
      accessToken: "google-access-token",
      token: "google-access-token",
    });
  });
});
