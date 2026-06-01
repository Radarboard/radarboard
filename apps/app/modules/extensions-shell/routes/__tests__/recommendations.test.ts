import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations-init", () => ({}));
vi.mock("@/lib/widgets-init", () => ({
  initializeWidgetDescriptors: vi.fn(),
}));

const getAllIntegrationsMock = vi.fn();
const checkDependenciesWithCredentialsMock = vi.fn();

const { WIDGET_REGISTRY_MOCK } = vi.hoisted(() => ({
  WIDGET_REGISTRY_MOCK: new Map(),
}));

vi.mock("@radarboard/integration-sdk/registry", () => ({
  getAllIntegrations: (...args: unknown[]) => getAllIntegrationsMock(...args),
}));

vi.mock("@radarboard/integration-sdk/resolver", () => ({
  checkDependenciesWithCredentials: (...args: unknown[]) =>
    checkDependenciesWithCredentialsMock(...args),
}));

vi.mock("@radarboard/widget-engine/widgets/registry", () => ({
  WIDGET_REGISTRY: WIDGET_REGISTRY_MOCK,
}));

vi.mock("@/db/repository", () => ({
  getCredentialRepo: () => ({ getCredential: vi.fn().mockResolvedValue(null) }),
}));

vi.mock("@/lib/extensions/capability-governance", () => ({
  formatCapabilityLabel: (id: string) => id.replace(/\./g, " "),
  getCapabilityProvidingWidgets: () => [],
  getCanonicalWidgetMap: () => new Map(),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { handleGetExtensionRecommendations as GET } from "@/modules/extensions-shell/routes/recommendations";

beforeEach(() => {
  vi.clearAllMocks();
  WIDGET_REGISTRY_MOCK.clear();
});

describe("GET /api/extensions/recommendations", () => {
  it("returns empty recommendations when no integrations configured", async () => {
    getAllIntegrationsMock.mockReturnValue([]);
    checkDependenciesWithCredentialsMock.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.recommendations).toEqual([]);
  });

  it("recommends widgets when all required integrations are configured", async () => {
    getAllIntegrationsMock.mockReturnValue([{ id: "github", name: "GitHub", capabilities: [] }]);
    checkDependenciesWithCredentialsMock.mockResolvedValue([
      { integrationId: "github", configured: true },
    ]);
    WIDGET_REGISTRY_MOCK.set("commits", {
      id: "commits",
      name: "Commits",
      description: "Show recent commits",
      requiredIntegrations: ["github"],
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    const rec = body.recommendations.find(
      (r: { extensionId: string }) => r.extensionId === "commits"
    );
    expect(rec).toBeDefined();
    expect(rec.priority).toBe("high");
    expect(rec.extensionType).toBe("widget");
  });

  it("recommends widgets with medium priority when partially configured", async () => {
    getAllIntegrationsMock.mockReturnValue([
      { id: "github", name: "GitHub", capabilities: [] },
      { id: "sentry", name: "Sentry", capabilities: [] },
    ]);
    checkDependenciesWithCredentialsMock.mockResolvedValue([
      { integrationId: "github", configured: true },
      { integrationId: "sentry", configured: false },
    ]);
    WIDGET_REGISTRY_MOCK.set("observability", {
      id: "observability",
      name: "Observability",
      description: "Errors and deploys",
      requiredIntegrations: ["github", "sentry"],
    });

    const res = await GET();
    const body = await res.json();

    const rec = body.recommendations.find(
      (r: { extensionId: string }) => r.extensionId === "observability"
    );
    expect(rec).toBeDefined();
    expect(rec.priority).toBe("medium");
    expect(rec.reason).toContain("sentry");
  });

  it("recommends unconfigured integrations that unlock widgets", async () => {
    getAllIntegrationsMock.mockReturnValue([
      { id: "vercel", name: "Vercel", description: "Deploy platform", capabilities: [] },
    ]);
    checkDependenciesWithCredentialsMock.mockResolvedValue([
      { integrationId: "vercel", configured: false },
    ]);
    WIDGET_REGISTRY_MOCK.set("deploys", {
      id: "deploys",
      name: "Deploys",
      description: "Deployment history",
      requiredIntegrations: ["vercel"],
    });

    const res = await GET();
    const body = await res.json();

    const rec = body.recommendations.find(
      (r: { extensionId: string }) => r.extensionId === "vercel"
    );
    expect(rec).toBeDefined();
    expect(rec.extensionType).toBe("integration");
    expect(rec.reason).toMatch(/unlock/i);
  });

  it("sorts recommendations by priority then name", async () => {
    getAllIntegrationsMock.mockReturnValue([{ id: "github", name: "GitHub", capabilities: [] }]);
    checkDependenciesWithCredentialsMock.mockResolvedValue([
      { integrationId: "github", configured: true },
    ]);
    WIDGET_REGISTRY_MOCK.set("stars", {
      id: "stars",
      name: "Stars",
      description: "Star count",
      requiredIntegrations: ["github"],
    });
    WIDGET_REGISTRY_MOCK.set("commits", {
      id: "commits",
      name: "Commits",
      description: "Commit list",
      requiredIntegrations: ["github"],
    });

    const res = await GET();
    const body = await res.json();

    const names = body.recommendations.map((r: { name: string }) => r.name);
    // Both high priority, alphabetical: Commits before Stars
    expect(names.indexOf("Commits")).toBeLessThan(names.indexOf("Stars"));
  });

  it("returns 500 on error", async () => {
    getAllIntegrationsMock.mockImplementation(() => {
      throw new Error("Registry failed");
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Registry failed");
  });
});
