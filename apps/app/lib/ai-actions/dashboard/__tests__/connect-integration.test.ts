import { beforeEach, describe, expect, it, vi } from "vitest";

const getIntegration = vi.fn();
const setCredential = vi.fn();
const saveUserIntegration = vi.fn();
const removeUserIntegration = vi.fn();
const loadUserIntegrationConfigs = vi.fn();
const findDataSource = vi.fn();

vi.mock("@radarboard/integration-sdk/registry", () => ({
  getIntegration: (id: string) => getIntegration(id),
  findDataSource: (...args: unknown[]) => findDataSource(...args),
}));

vi.mock("@/data/core/repository", () => ({
  getCredentialRepo: () => ({ setCredential }),
}));

vi.mock("@/lib/integrations/user-integrations-registry", () => ({
  saveUserIntegration: (...args: unknown[]) => saveUserIntegration(...args),
  removeUserIntegration: (...args: unknown[]) => removeUserIntegration(...args),
  loadUserIntegrationConfigs: (...args: unknown[]) => loadUserIntegrationConfigs(...args),
}));

vi.mock("@/lib/assistant/core/data-source-context", () => ({
  buildDataSourceContext: () => ({}),
}));

import {
  executeConnectIntegration,
  executeCreateIntegration,
  executeListUserIntegrations,
  executeRemoveIntegration,
} from "../connect-integration";

function descriptor(auth: Record<string, unknown>) {
  return { id: "acme", name: "Acme", auth };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("executeConnectIntegration", () => {
  it("rejects an unknown integration", async () => {
    getIntegration.mockReturnValue(undefined);
    const res = await executeConnectIntegration({ integrationId: "nope", values: {} });
    expect(res.connected).toBe(false);
    expect(res.error).toMatch(/Unknown integration/);
    expect(setCredential).not.toHaveBeenCalled();
  });

  it("directs OAuth integrations to Settings instead of connecting", async () => {
    getIntegration.mockReturnValue(
      descriptor({
        id: "acme",
        name: "Acme",
        type: "oauth",
        oauth: { provider: "acme", scopes: [] },
      })
    );
    const res = await executeConnectIntegration({ integrationId: "acme", values: {} });
    expect(res.connected).toBe(false);
    expect(res.error).toMatch(/OAuth/);
    expect(setCredential).not.toHaveBeenCalled();
  });

  it("errors on missing required fields", async () => {
    getIntegration.mockReturnValue(
      descriptor({
        id: "acme",
        name: "Acme",
        type: "api_key",
        fields: [{ key: "apiKey", label: "API Key", type: "password" }],
      })
    );
    const res = await executeConnectIntegration({ integrationId: "acme", values: {} });
    expect(res.connected).toBe(false);
    expect(res.error).toMatch(/Missing required field/);
    expect(setCredential).not.toHaveBeenCalled();
  });

  it("does not save when the credential test fails", async () => {
    getIntegration.mockReturnValue(
      descriptor({
        id: "acme",
        name: "Acme",
        type: "api_key",
        fields: [{ key: "apiKey", label: "API Key", type: "password" }],
        credentialTest: vi.fn(async () => ({ ok: false, error: "bad token" })),
      })
    );
    const res = await executeConnectIntegration({ integrationId: "acme", values: { apiKey: "x" } });
    expect(res.connected).toBe(false);
    expect(res.tested).toBe(true);
    expect(res.error).toBe("bad token");
    expect(setCredential).not.toHaveBeenCalled();
  });

  it("tests then saves under the provider key when valid", async () => {
    getIntegration.mockReturnValue(
      descriptor({
        id: "acme-stars",
        provider: "acme",
        name: "Acme",
        type: "api_key",
        fields: [{ key: "apiKey", label: "API Key", type: "password" }],
        credentialTest: vi.fn(async () => ({ ok: true })),
      })
    );
    const res = await executeConnectIntegration({
      integrationId: "acme-stars",
      values: { apiKey: "sk_live" },
    });
    expect(res.connected).toBe(true);
    expect(res.tested).toBe(true);
    expect(res.provider).toBe("acme");
    expect(setCredential).toHaveBeenCalledWith("acme", { apiKey: "sk_live" });
  });

  it("saves without a test when the integration defines none", async () => {
    getIntegration.mockReturnValue(
      descriptor({
        id: "acme",
        name: "Acme",
        type: "api_key",
        fields: [{ key: "apiKey", label: "API Key", type: "password" }],
      })
    );
    const res = await executeConnectIntegration({ integrationId: "acme", values: { apiKey: "k" } });
    expect(res.connected).toBe(true);
    expect(res.tested).toBe(false);
    expect(setCredential).toHaveBeenCalledWith("acme", { apiKey: "k" });
  });
});

describe("executeCreateIntegration", () => {
  const params = {
    id: "acme",
    name: "Acme",
    description: "Acme metrics",
    category: "analytics" as const,
    baseUrl: "https://api.acme.test",
    dataSources: [
      { action: "summary", description: "Summary", cacheTtlSeconds: 300, path: "/v1/summary" },
    ],
  };

  it("maps a successful save into a created result", async () => {
    saveUserIntegration.mockResolvedValue({
      ok: true,
      id: "acme",
      updated: false,
      dataSourceActions: ["summary"],
    });
    const res = await executeCreateIntegration(params);
    expect(res).toEqual({
      created: true,
      id: "acme",
      updated: false,
      dataSourceActions: ["summary"],
    });
    // Auth defaults to {} when not supplied.
    expect(saveUserIntegration).toHaveBeenCalledWith(expect.objectContaining({ auth: {} }));
  });

  it("maps a failed save into a created:false result with the error", async () => {
    saveUserIntegration.mockResolvedValue({ ok: false, id: "acme", error: "boom" });
    const res = await executeCreateIntegration(params);
    expect(res).toEqual({ created: false, id: "acme", error: "boom" });
  });

  it("does not dry-run an authed integration", async () => {
    saveUserIntegration.mockResolvedValue({
      ok: true,
      id: "acme",
      updated: false,
      dataSourceActions: ["summary"],
    });
    const res = await executeCreateIntegration({ ...params, auth: { scheme: "bearer" } });
    expect(res.verified).toBeUndefined();
    expect(findDataSource).not.toHaveBeenCalled();
  });

  describe("no-auth dry-run", () => {
    const noAuthParams = {
      ...params,
      id: "coins",
      auth: { scheme: "none" as const },
      dataSources: [
        { action: "prices", description: "Prices", cacheTtlSeconds: 60, path: "/prices" },
      ],
    };

    beforeEach(() => {
      saveUserIntegration.mockResolvedValue({
        ok: true,
        id: "coins",
        updated: false,
        dataSourceActions: ["prices"],
      });
    });

    it("fetches once and returns the response's field paths", async () => {
      findDataSource.mockReturnValue({
        fetch: vi.fn(async () => ({ bitcoin: { usd: 42 }, ethereum: { usd: 3 } })),
      });
      const res = await executeCreateIntegration(noAuthParams);
      expect(res.created).toBe(true);
      expect(res.verified).toBe(true);
      expect(res.sampleFields).toEqual(["bitcoin.usd", "ethereum.usd"]);
      expect(findDataSource).toHaveBeenCalledWith("coins", "prices");
    });

    it("descends into arrays with a [0] marker", async () => {
      findDataSource.mockReturnValue({
        fetch: vi.fn(async () => ({ items: [{ id: 1, name: "a" }], total: 5 })),
      });
      const res = await executeCreateIntegration(noAuthParams);
      // The bare array path ("items") is kept for list bindings; element paths for KPIs.
      expect(res.sampleFields).toEqual(["items", "items.0.id", "items.0.name", "total"]);
    });

    it("reports a failed dry-run without blocking creation", async () => {
      findDataSource.mockReturnValue({
        fetch: vi.fn(async () => {
          throw new Error("429 rate limited");
        }),
      });
      const res = await executeCreateIntegration(noAuthParams);
      expect(res.created).toBe(true);
      expect(res.verified).toBe(false);
      expect(res.verifyError).toMatch(/429/);
    });

    it("skips the dry-run when verifyEndpoint is false", async () => {
      const res = await executeCreateIntegration({ ...noAuthParams, verifyEndpoint: false });
      expect(res.created).toBe(true);
      expect(res.verified).toBeUndefined();
      expect(findDataSource).not.toHaveBeenCalled();
    });
  });
});

describe("executeListUserIntegrations", () => {
  it("summarizes persisted configs and drops entries without an id", async () => {
    loadUserIntegrationConfigs.mockResolvedValue([
      {
        id: "acme",
        name: "Acme",
        category: "analytics",
        baseUrl: "https://api.acme.test",
        dataSources: [{ action: "summary" }, { action: "trend" }],
      },
      { name: "No id" },
    ]);
    const res = await executeListUserIntegrations();
    expect(res.integrations).toEqual([
      {
        id: "acme",
        name: "Acme",
        category: "analytics",
        baseUrl: "https://api.acme.test",
        dataSourceActions: ["summary", "trend"],
      },
    ]);
  });
});

describe("executeRemoveIntegration", () => {
  it("maps a successful removal", async () => {
    removeUserIntegration.mockResolvedValue({ ok: true, id: "acme", removed: true });
    const res = await executeRemoveIntegration({ id: "acme" });
    expect(res).toEqual({ removed: true, id: "acme", notFound: false });
    expect(removeUserIntegration).toHaveBeenCalledWith("acme");
  });

  it("flags an unknown id as notFound", async () => {
    removeUserIntegration.mockResolvedValue({ ok: true, id: "ghost", removed: false });
    const res = await executeRemoveIntegration({ id: "ghost" });
    expect(res).toEqual({ removed: false, id: "ghost", notFound: true });
  });

  it("surfaces a persistence error", async () => {
    removeUserIntegration.mockResolvedValue({ ok: false, id: "acme", error: "db down" });
    const res = await executeRemoveIntegration({ id: "acme" });
    expect(res).toEqual({ removed: false, id: "acme", error: "db down" });
  });
});
