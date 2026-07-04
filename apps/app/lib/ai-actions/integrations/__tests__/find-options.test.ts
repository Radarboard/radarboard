import { beforeEach, describe, expect, it, vi } from "vitest";

const getAllIntegrations = vi.fn();
const getCredential = vi.fn();
const getExtensionCatalog = vi.fn();

vi.mock("@radarboard/integration-sdk/registry", () => ({
  getAllIntegrations: () => getAllIntegrations(),
}));

vi.mock("@/data/core/repository", () => ({
  getCredentialRepo: () => ({ getCredential }),
}));

vi.mock("@/modules/extensions-shell/routes/catalog", () => ({
  getExtensionCatalog: () => getExtensionCatalog(),
}));

import { executeFindOptions } from "../find-options";

function integration(overrides: Record<string, unknown> = {}) {
  return {
    id: "acme",
    name: "Acme",
    description: "Acme metrics",
    auth: { id: "acme", type: "api_key" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getAllIntegrations.mockReturnValue([]);
  getCredential.mockResolvedValue(null);
  getExtensionCatalog.mockResolvedValue({ extensions: [] });
});

describe("executeFindOptions", () => {
  it("always offers the no-code REST fallback and recommends it when nothing matches", async () => {
    const res = await executeFindOptions({ service: "nonesuch" });
    expect(res.options.at(-1)).toMatchObject({ rung: "rest" });
    expect(res.recommendedRung).toBe("rest");
  });

  it("surfaces a matching registered integration and its connected state", async () => {
    getAllIntegrations.mockReturnValue([integration({ auth: { id: "acme", type: "api_key" } })]);
    getCredential.mockResolvedValue({ apiKey: "sk_live" });
    const res = await executeFindOptions({ service: "acme" });
    const reg = res.options.find((o) => o.rung === "registered");
    expect(reg).toMatchObject({ id: "acme", connected: true });
    expect(res.recommendedRung).toBe("registered");
  });

  it("resolves the connected check under the provider key, not the id", async () => {
    getAllIntegrations.mockReturnValue([
      integration({
        id: "acme-stars",
        auth: { id: "acme-stars", provider: "acme", type: "api_key" },
      }),
    ]);
    await executeFindOptions({ service: "acme" });
    expect(getCredential).toHaveBeenCalledWith("acme");
  });

  it("treats a type:none integration as always connected", async () => {
    getAllIntegrations.mockReturnValue([integration({ auth: { id: "acme", type: "none" } })]);
    const res = await executeFindOptions({ service: "acme" });
    expect(res.options.find((o) => o.rung === "registered")).toMatchObject({ connected: true });
    expect(getCredential).not.toHaveBeenCalled();
  });

  it("matches a known MCP server and recommends it when no integration exists", async () => {
    const res = await executeFindOptions({ service: "sentry" });
    const mcp = res.options.find((o) => o.rung === "mcp");
    expect(mcp).toMatchObject({ service: "sentry", requiresAuth: true });
    expect(res.recommendedRung).toBe("mcp");
  });

  it("includes installable community extensions, skipping installed/registered ones", async () => {
    getExtensionCatalog.mockResolvedValue({
      extensions: [
        {
          id: "acme-pro",
          name: "Acme Pro",
          description: "Acme extended",
          type: "integration",
          installable: true,
          installed: false,
          tags: ["acme"],
          installUrl: "https://github.com/x/acme-pro",
        },
        {
          id: "acme-old",
          name: "Acme Old",
          description: "installed already",
          type: "integration",
          installable: true,
          installed: true,
          tags: ["acme"],
        },
      ],
    });
    const res = await executeFindOptions({ service: "acme" });
    const community = res.options.filter((o) => o.rung === "community");
    expect(community).toHaveLength(1);
    expect(community[0]).toMatchObject({ id: "acme-pro" });
  });

  it("survives a catalog fetch failure", async () => {
    getExtensionCatalog.mockRejectedValue(new Error("catalog down"));
    const res = await executeFindOptions({ service: "acme" });
    expect(res.options.some((o) => o.rung === "rest")).toBe(true);
  });
});
