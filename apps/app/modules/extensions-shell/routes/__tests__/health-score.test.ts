import { beforeEach, describe, expect, it, vi } from "vitest";

const getAllIntegrationsMock = vi.fn();
const checkDependenciesWithCredentialsMock = vi.fn();
const getCredentialRepoMock = vi.fn();

vi.mock("@radarboard/integration-sdk/registry", () => ({
  getAllIntegrations: (...args: unknown[]) => getAllIntegrationsMock(...args),
}));

vi.mock("@radarboard/integration-sdk/resolver", () => ({
  checkDependenciesWithCredentials: (...args: unknown[]) =>
    checkDependenciesWithCredentialsMock(...args),
}));

vi.mock("@/db/repository", () => ({
  getCredentialRepo: () => getCredentialRepoMock(),
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
  checkDependenciesWithCredentialsMock.mockReset();
  getCredentialRepoMock.mockReset();
  mockCredRepo.getCredential.mockReset();
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
    expect(body.details).toHaveLength(2);
    expect(body.details[0].configured).toBe(true);
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
    expect(body.details).toEqual([]);
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

    const github = body.details.find(
      (d: { integrationId: string }) => d.integrationId === "github"
    );
    const sentry = body.details.find(
      (d: { integrationId: string }) => d.integrationId === "sentry"
    );

    expect(github).toEqual({
      integrationId: "github",
      name: "GitHub",
      configured: true,
    });
    expect(sentry).toEqual({
      integrationId: "sentry",
      name: "Sentry",
      configured: false,
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
