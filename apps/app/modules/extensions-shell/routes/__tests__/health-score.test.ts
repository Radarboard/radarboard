import { beforeEach, describe, expect, it, vi } from "vitest";

const getAllIntegrationsMock = vi.fn();
const getAllFeaturesMock = vi.fn();
const getAllPluginsMock = vi.fn();
const getAllWidgetsMock = vi.fn();
const checkDependenciesWithCredentialsMock = vi.fn();
const getCredentialRepoMock = vi.fn();

const { DATA_SOURCE_REGISTRY_MOCK, WIDGET_DATA_SOURCE_REGISTRY_MOCK } = vi.hoisted(() => ({
  DATA_SOURCE_REGISTRY_MOCK: new Map<string, unknown>(),
  WIDGET_DATA_SOURCE_REGISTRY_MOCK: new Map<string, unknown>(),
}));

vi.mock("@/lib/features", () => ({}));
vi.mock("@/lib/integrations-init", () => ({}));
vi.mock("@/lib/plugins-init", () => ({}));
vi.mock("@/lib/widgets-init", () => ({
  initializeWidgetDescriptors: vi.fn(),
}));

vi.mock("@/lib/features-init", () => ({
  featureDescriptors: [],
}));

vi.mock("@radarboard/feature-sdk/registry", () => ({
  getAllFeatures: (...args: unknown[]) => getAllFeaturesMock(...args),
}));

vi.mock("@radarboard/integration-sdk/registry", () => ({
  DATA_SOURCE_REGISTRY: DATA_SOURCE_REGISTRY_MOCK,
  getAllIntegrations: (...args: unknown[]) => getAllIntegrationsMock(...args),
}));

vi.mock("@radarboard/integration-sdk/resolver", () => ({
  checkDependenciesWithCredentials: (...args: unknown[]) =>
    checkDependenciesWithCredentialsMock(...args),
}));

vi.mock("@radarboard/plugin-sdk/registry", () => ({
  getAllPlugins: (...args: unknown[]) => getAllPluginsMock(...args),
}));

vi.mock("@radarboard/widget-engine/widgets/registry", () => ({
  getAllWidgets: (...args: unknown[]) => getAllWidgetsMock(...args),
}));

vi.mock("@radarboard/widget-sdk/data-source-registry", () => ({
  DATA_SOURCE_ID_REGISTRY: WIDGET_DATA_SOURCE_REGISTRY_MOCK,
}));

vi.mock("@/db/repository", () => ({
  getCredentialRepo: () => getCredentialRepoMock(),
}));

vi.mock("@/lib/extensions/capability-governance", () => ({
  auditCapabilityGovernance: vi.fn().mockReturnValue([]),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { handleGetExtensionHealthScore as GET } from "@/modules/extensions-shell/routes/health-score";

const mockCredRepo = {
  getCredential: vi.fn(),
};

beforeEach(() => {
  getAllIntegrationsMock.mockReset();
  getAllFeaturesMock.mockReset();
  getAllPluginsMock.mockReset();
  getAllWidgetsMock.mockReset();
  checkDependenciesWithCredentialsMock.mockReset();
  getCredentialRepoMock.mockReset();
  mockCredRepo.getCredential.mockReset();
  DATA_SOURCE_REGISTRY_MOCK.clear();
  WIDGET_DATA_SOURCE_REGISTRY_MOCK.clear();
  getAllFeaturesMock.mockReturnValue([]);
  getAllPluginsMock.mockReturnValue([]);
  getAllWidgetsMock.mockReturnValue([]);
  getCredentialRepoMock.mockReturnValue(mockCredRepo);
});

describe("GET /api/extensions/health-score", () => {
  it("returns 100 when all integrations are configured", async () => {
    getAllIntegrationsMock.mockReturnValue([
      { id: "github", name: "GitHub" },
      { id: "sentry", name: "Sentry" },
    ]);

    checkDependenciesWithCredentialsMock.mockResolvedValue([
      { integrationId: "github", configured: true },
      { integrationId: "sentry", configured: true },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.overall).toBe(100);
    expect(body.coverage.configured).toBe(2);
    expect(body.coverage.total).toBe(2);
    expect(
      body.details.filter((detail: { type: string }) => detail.type === "integration")
    ).toHaveLength(2);
    expect(body.details[0].metrics.configured).toBe(true);
  });

  it("returns 0 when no integrations are configured", async () => {
    getAllIntegrationsMock.mockReturnValue([
      { id: "github", name: "GitHub" },
      { id: "sentry", name: "Sentry" },
    ]);

    checkDependenciesWithCredentialsMock.mockResolvedValue([
      { integrationId: "github", configured: false },
      { integrationId: "sentry", configured: false },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.overall).toBe(0);
    expect(body.coverage.configured).toBe(0);
  });

  it("returns partial score with mixed configuration", async () => {
    getAllIntegrationsMock.mockReturnValue([
      { id: "github", name: "GitHub" },
      { id: "sentry", name: "Sentry" },
      { id: "vercel", name: "Vercel" },
    ]);

    checkDependenciesWithCredentialsMock.mockResolvedValue([
      { integrationId: "github", configured: true },
      { integrationId: "sentry", configured: false },
      { integrationId: "vercel", configured: false },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.overall).toBe(33); // Math.round(1/3 * 100) = 33
    expect(body.coverage.configured).toBe(1);
    expect(body.coverage.total).toBe(3);
  });

  it("returns 0 score with empty integrations list", async () => {
    getAllIntegrationsMock.mockReturnValue([]);
    checkDependenciesWithCredentialsMock.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.overall).toBe(0);
    expect(
      body.details.filter((detail: { type: string }) => detail.type === "integration")
    ).toEqual([]);
  });

  it("returns details for each integration", async () => {
    getAllIntegrationsMock.mockReturnValue([
      { id: "github", name: "GitHub" },
      { id: "sentry", name: "Sentry" },
    ]);

    checkDependenciesWithCredentialsMock.mockResolvedValue([
      { integrationId: "github", configured: true },
      { integrationId: "sentry", configured: false },
    ]);

    const res = await GET();
    const body = await res.json();

    const github = body.details.find((d: { id: string }) => d.id === "github");
    const sentry = body.details.find((d: { id: string }) => d.id === "sentry");

    expect(github).toMatchObject({
      id: "github",
      name: "GitHub",
      metrics: expect.objectContaining({ configured: true }),
    });
    expect(sentry).toMatchObject({
      id: "sentry",
      name: "Sentry",
      metrics: expect.objectContaining({ configured: false }),
    });
  });

  it("returns 500 on unexpected error", async () => {
    getAllIntegrationsMock.mockImplementation(() => {
      throw new Error("Registry broken");
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Registry broken");
  });
});
