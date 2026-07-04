import { createMockDataSourceContext } from "@radarboard/integration-sdk";
import type { CommonRouteParams } from "@radarboard/integration-sdk/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRestIntegrationFromUserConfig,
  type UserRestIntegrationConfig,
  validateBaseUrl,
} from "../user-rest-integration";

function baseConfig(overrides: Partial<UserRestIntegrationConfig> = {}): UserRestIntegrationConfig {
  return {
    id: "acme",
    name: "Acme",
    description: "Acme metrics",
    category: "analytics",
    baseUrl: "https://api.acme.test",
    auth: {
      scheme: "bearer",
      fields: [{ key: "apiKey", label: "API Key", type: "password" }],
      testPath: "/me",
    },
    dataSources: [
      {
        action: "summary",
        description: "Summary",
        cacheTtlSeconds: 300,
        path: "/v1/projects/{projectSlug}/summary",
        query: { range: "{range}" },
      },
    ],
    ...overrides,
  };
}

const COMMON: CommonRouteParams & Record<string, unknown> = {
  projectSlug: "acme-co",
  range: "30d",
  timeZone: "UTC",
  forceRefresh: false,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("validateBaseUrl", () => {
  it("accepts https and http-on-localhost, rejects the rest", () => {
    expect(validateBaseUrl("https://api.acme.test").ok).toBe(true);
    expect(validateBaseUrl("http://localhost:3000").ok).toBe(true);
    expect(validateBaseUrl("http://127.0.0.1:8080").ok).toBe(true);
    expect(validateBaseUrl("http://evil.example.com").ok).toBe(false);
    expect(validateBaseUrl("ftp://x").ok).toBe(false);
    expect(validateBaseUrl("not a url").ok).toBe(false);
  });
});

describe("buildRestIntegrationFromUserConfig — validation", () => {
  it("hydrates a valid config into a descriptor", () => {
    const res = buildRestIntegrationFromUserConfig(baseConfig());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.descriptor.id).toBe("acme");
    expect(res.descriptor.auth.type).toBe("api_key");
    expect(res.descriptor.icon).toBeDefined();
    expect(res.descriptor.dataSources).toHaveLength(1);
  });

  it("rejects a non-kebab id", () => {
    const res = buildRestIntegrationFromUserConfig(baseConfig({ id: "Acme_Co" }));
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/kebab-case/) });
  });

  it("rejects an unknown category", () => {
    const res = buildRestIntegrationFromUserConfig(baseConfig({ category: "unknown" as never }));
    expect(res.ok).toBe(false);
  });

  it("rejects a non-https, non-localhost baseUrl", () => {
    const res = buildRestIntegrationFromUserConfig(
      baseConfig({ baseUrl: "http://evil.example.com" })
    );
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/https/) });
  });

  it("requires at least one data source", () => {
    const res = buildRestIntegrationFromUserConfig(baseConfig({ dataSources: [] }));
    expect(res.ok).toBe(false);
  });

  it("rejects duplicate data-source actions", () => {
    const ds = baseConfig().dataSources[0];
    const res = buildRestIntegrationFromUserConfig(baseConfig({ dataSources: [ds, ds] }));
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/Duplicate/) });
  });
});

describe("buildRestIntegrationFromUserConfig — compiled data source", () => {
  it("interpolates path + query placeholders and sends the auth header", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = buildRestIntegrationFromUserConfig(baseConfig());
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const ctx = createMockDataSourceContext({ acme: { apiKey: "sk_test" } });
    const out = await res.descriptor.dataSources?.[0]?.fetch(COMMON, ctx);
    expect(out).toEqual({ ok: 1 });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.acme.test/v1/projects/acme-co/summary?range=30d");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer sk_test");
    // Credential resolved under the provider key (defaults to id).
    expect(ctx.resolvedCredentialKeys).toEqual(["acme"]);
  });
});
