import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  defaultCredentials: {
    revenuecat: { apiKey: "rc_key", projectId: "rc_proj" },
    sentry: { authToken: "sentry_tok", orgSlug: "my-org" },
    openpanel: { clientId: "op_id", clientSecret: "op_secret" },
    betterstack: { apiToken: "bs_tok" },
    opencollective: { apiToken: "oc_tok" },
    linear: { apiKey: "lin_key" },
    vercel: { token: "vrc_tok", teamId: "team_1" },
    github: { token: "gh_tok" },
    "app-store-connect": { keyId: "k1", issuerId: "i1", privateKey: "pk\\nline2" },
    "google-search-console": {
      clientId: "gc_id",
      clientSecret: "gc_secret",
      refreshToken: "gc_refresh",
    },
    resend: { apiKey: "rs_key", fromEmail: "a@b.com", toEmail: "c@d.com" },
  } as Record<string, Record<string, string>>,
  credentials: {} as Record<string, Record<string, string>>,
}));

// Mock the repository module
vi.mock("@/data/core/repository", () => ({
  getCredentialRepo: () => ({
    getCredential: vi.fn().mockImplementation(async (key: string) => {
      return mocks.credentials[key] ?? null;
    }),
  }),
}));

import {
  resolveASCConfig,
  resolveBetterStackConfig,
  resolveGSCConfig,
  resolveLinearConfig,
  resolveOCConfig,
  resolveOpenPanelConfig,
  resolveResendConfig,
  resolveRevenueCatConfig,
  resolveSentryConfig,
  resolveVercelConfig,
} from "../credential-resolver";

describe("credential resolvers", () => {
  beforeEach(() => {
    mocks.credentials = Object.fromEntries(
      Object.entries(mocks.defaultCredentials).map(([key, value]) => [key, { ...value }])
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves RevenueCat config with projectId override", async () => {
    const config = await resolveRevenueCatConfig("override_proj");
    expect(config).toEqual({ apiKey: "rc_key", projectId: "override_proj" });
  });

  it("resolves RevenueCat config with fallback projectId", async () => {
    const config = await resolveRevenueCatConfig();
    expect(config).toEqual({ apiKey: "rc_key", projectId: "rc_proj" });
  });

  it("resolves Sentry config", async () => {
    const config = await resolveSentryConfig();
    expect(config).toEqual({ authToken: "sentry_tok", orgSlug: "my-org" });
  });

  it("resolves OpenPanel config", async () => {
    const config = await resolveOpenPanelConfig("my-project");
    expect(config).toEqual({
      clientId: "op_id",
      clientSecret: "op_secret",
      projectId: "my-project",
    });
  });

  it("resolves BetterStack config", async () => {
    const config = await resolveBetterStackConfig();
    expect(config).toEqual({ apiToken: "bs_tok" });
  });

  it("resolves OpenCollective config", async () => {
    const config = await resolveOCConfig("my-slug");
    expect(config).toEqual({ apiToken: "oc_tok", slug: "my-slug" });
  });

  it("resolves Linear config", async () => {
    const config = await resolveLinearConfig();
    expect(config).toEqual({ apiKey: "lin_key" });
  });

  it("resolves Vercel config with teamId", async () => {
    const config = await resolveVercelConfig();
    expect(config).toEqual({ token: "vrc_tok", teamId: "team_1" });
  });

  it("resolves ASC config and unescapes private key newlines", async () => {
    const config = await resolveASCConfig();
    expect(config).toBeDefined();
    expect(config?.privateKey).toContain("\n");
  });

  it("resolves GSC config", async () => {
    const config = await resolveGSCConfig();
    expect(config).toEqual({
      clientId: "gc_id",
      clientSecret: "gc_secret",
      refreshToken: "gc_refresh",
    });
  });

  it("resolves broker-backed GSC config with a short-lived access token", async () => {
    mocks.credentials["google-search-console"] = {
      authMethod: "oauth_broker",
      brokerUrl: "https://auth.radarboard.app/",
      brokerCredentialToken: "broker-token",
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: "broker_access_token" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const config = await resolveGSCConfig();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://auth.radarboard.app/api/auth/broker/google/access-token",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ brokerCredentialToken: "broker-token" }),
      })
    );
    expect(config).toEqual({
      authMethod: "oauth_broker",
      brokerUrl: "https://auth.radarboard.app/",
      brokerCredentialToken: "broker-token",
      accessToken: "broker_access_token",
    });
  });

  it("resolves Resend config", async () => {
    const config = await resolveResendConfig();
    expect(config).toEqual({ apiKey: "rs_key", fromEmail: "a@b.com", toEmail: "c@d.com" });
  });
});
