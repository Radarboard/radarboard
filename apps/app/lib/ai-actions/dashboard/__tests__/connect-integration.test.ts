import { beforeEach, describe, expect, it, vi } from "vitest";

const getIntegration = vi.fn();
const setCredential = vi.fn();
const saveUserIntegration = vi.fn();

vi.mock("@radarboard/integration-sdk/registry", () => ({
  getIntegration: (id: string) => getIntegration(id),
}));

vi.mock("@/data/core/repository", () => ({
  getCredentialRepo: () => ({ setCredential }),
}));

vi.mock("@/lib/integrations/user-integrations-registry", () => ({
  saveUserIntegration: (...args: unknown[]) => saveUserIntegration(...args),
}));

import { executeConnectIntegration, executeCreateIntegration } from "../connect-integration";

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
});
