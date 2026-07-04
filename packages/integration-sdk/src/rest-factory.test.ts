import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authHeader,
  createHttpCredentialTest,
  createRestIntegration,
  type RestIntegrationConfig,
} from "./rest-factory";
import { createMockDataSourceContext } from "./testing";
import type { CommonRouteParams } from "./types";

const Icon = () => createElement("svg");

const COMMON: CommonRouteParams & Record<string, unknown> = {
  projectSlug: "acme",
  range: "30d",
  timeZone: "UTC",
  forceRefresh: false,
};

function baseConfig(overrides: Partial<RestIntegrationConfig> = {}): RestIntegrationConfig {
  return {
    id: "acme",
    name: "Acme",
    description: "Acme metrics",
    icon: Icon,
    category: "analytics",
    baseUrl: "https://api.acme.test/",
    auth: { scheme: "bearer", testPath: "/me" },
    dataSources: [
      {
        action: "summary",
        description: "Summary metrics",
        cacheTtlSeconds: 300,
        path: "/v1/summary",
        query: (p) => ({ project: p.projectSlug ?? undefined, range: p.range }),
        map: (json) => ({ total: (json as { count: number }).count }),
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("authHeader", () => {
  it("formats each scheme", () => {
    expect(authHeader("bearer", "tok")).toBe("Bearer tok");
    expect(authHeader("token", "tok")).toBe("token tok");
    expect(authHeader("basic", "tok")).toBe(`Basic ${Buffer.from("tok:").toString("base64")}`);
    expect(authHeader("none", "tok")).toBeUndefined();
  });
});

describe("createRestIntegration — descriptor shape", () => {
  it("builds a valid api_key descriptor with provider defaulting to id", () => {
    const d = createRestIntegration(baseConfig());
    expect(d.id).toBe("acme");
    expect(d.auth.type).toBe("api_key");
    expect(d.auth.id).toBe("acme");
    expect(d.auth.provider).toBe("acme");
    expect(d.auth.fields).toEqual([{ key: "apiKey", label: "API Key", type: "password" }]);
    expect(d.auth.credentialTest).toBeTypeOf("function");
    expect(d.dataSources).toHaveLength(1);
    expect(d.dataSources?.[0]?.action).toBe("summary");
  });

  it("uses an explicit provider as the credential grouping key", () => {
    const d = createRestIntegration(baseConfig({ id: "github-stars", provider: "github" }));
    expect(d.auth.id).toBe("github");
    expect(d.auth.provider).toBe("github");
  });

  it("omits credentialTest when no testPath is given", () => {
    const d = createRestIntegration(baseConfig({ auth: { scheme: "bearer" } }));
    expect(d.auth.credentialTest).toBeUndefined();
    expect(d.auth.testEndpoint).toBeUndefined();
  });
});

describe("createRestIntegration — generated data-source fetch", () => {
  it("resolves the credential by provider, builds URL+query, sets the auth header, and maps", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ count: 42 }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const d = createRestIntegration(baseConfig({ id: "github-stars", provider: "github" }));
    const ctx = createMockDataSourceContext({ github: { apiKey: "ghp_secret" } });

    const result = await d.dataSources?.[0]?.fetch(COMMON, ctx);

    expect(result).toEqual({ total: 42 });
    expect(ctx.resolvedCredentialKeys).toEqual(["github"]); // resolved by provider, not id
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.acme.test/v1/summary?project=acme&range=30d");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer ghp_secret");
  });

  it("throws when the credential is missing", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const d = createRestIntegration(baseConfig());
    const ctx = createMockDataSourceContext(); // no credentials
    await expect(d.dataSources?.[0]?.fetch(COMMON, ctx)).rejects.toThrow(
      /Missing Acme credentials/
    );
  });

  it("throws on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 401 }))
    );
    const d = createRestIntegration(baseConfig());
    const ctx = createMockDataSourceContext({ acme: { apiKey: "k" } });
    await expect(d.dataSources?.[0]?.fetch(COMMON, ctx)).rejects.toThrow(/HTTP 401/);
  });
});

describe("createHttpCredentialTest", () => {
  const test = createHttpCredentialTest({
    baseUrl: "https://api.acme.test",
    testPath: "/me",
    scheme: "bearer",
    tokenField: "apiKey",
  });

  it("returns ok on a 2xx and sends the auth header", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(test({ apiKey: "k" })).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.acme.test/me");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer k");
  });

  it("returns an error on a non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 403 }))
    );
    await expect(test({ apiKey: "k" })).resolves.toEqual({ ok: false, error: "HTTP 403" });
  });

  it("returns an error when the token field is missing", async () => {
    await expect(test({})).resolves.toEqual({ ok: false, error: "Missing apiKey" });
  });
});
