import type { CredentialRepository, SettingsRepository } from "@radarboard/types/database";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/repository", () => ({
  getCredentialRepo: vi.fn(),
  getSettingsRepo: vi.fn(),
}));

import { getCredentialRepo, getSettingsRepo } from "@/db/repository";
import {
  handleDeleteIntegrationConnection as DELETE,
  handleGetIntegrationConnections as GET,
  handleUpsertIntegrationConnection as POST,
} from "@/modules/settings-shell/integration-connections";

const mockSettingsRepo: Record<keyof SettingsRepository, ReturnType<typeof vi.fn>> = {
  getProjectOrder: vi.fn(),
  setProjectOrder: vi.fn(),
  getWidgetLayout: vi.fn(),
  setWidgetLayout: vi.fn(),
  getProjectIntegrations: vi.fn(),
  setProjectIntegrations: vi.fn(),
  getIntegrationConnections: vi.fn(),
  setIntegrationConnections: vi.fn(),
  getProjectContextMap: vi.fn(),
  setProjectContextMap: vi.fn(),
  getLlmConfig: vi.fn(),
  setLlmConfig: vi.fn(),
  getDebugConfig: vi.fn(),
  setDebugConfig: vi.fn(),
  getRoutingConfig: vi.fn(),
  setRoutingConfig: vi.fn(),
};

const mockCredentialRepo: Record<keyof CredentialRepository, ReturnType<typeof vi.fn>> = {
  getCredential: vi.fn(),
  setCredential: vi.fn(),
  deleteCredential: vi.fn(),
  listCredentialKeys: vi.fn(),
};

beforeEach(() => {
  for (const fn of Object.values(mockSettingsRepo)) fn.mockReset();
  for (const fn of Object.values(mockCredentialRepo)) fn.mockReset();
  vi.mocked(getSettingsRepo).mockReturnValue(mockSettingsRepo as unknown as SettingsRepository);
  vi.mocked(getCredentialRepo).mockReturnValue(
    mockCredentialRepo as unknown as CredentialRepository
  );
});

describe("GET /api/integration-connections", () => {
  it("returns explicit connections plus legacy defaults synthesized from credentials", async () => {
    mockSettingsRepo.getIntegrationConnections.mockResolvedValue([
      {
        id: "linear::workspace-a",
        provider: "linear",
        name: "Linear Workspace A",
        credentialKey: "linear::workspace-a",
        enabled: true,
        isDefault: true,
        source: "explicit",
        capabilities: [{ id: "linear", enabled: true }],
        createdAt: 1,
        updatedAt: 2,
      },
    ]);
    mockCredentialRepo.listCredentialKeys.mockResolvedValue(["github", "linear::workspace-a"]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.connections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "github::default",
          provider: "github",
          credentialKey: "github",
          source: "legacy",
          isDefault: true,
        }),
        expect.objectContaining({
          id: "linear::workspace-a",
          provider: "linear",
          source: "explicit",
        }),
      ])
    );
    expect(body.providers).toEqual(expect.any(Array));
  });

  it("returns empty connections when nothing is configured", async () => {
    mockSettingsRepo.getIntegrationConnections.mockResolvedValue([]);
    mockCredentialRepo.listCredentialKeys.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body.connections).toEqual([]);
  });
});

describe("POST /api/integration-connections", () => {
  it("creates a new explicit connection", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5000 * 1000);
    mockSettingsRepo.getIntegrationConnections.mockResolvedValue([]);
    mockSettingsRepo.setIntegrationConnections.mockResolvedValue(undefined);

    const req = new Request("http://localhost/api/integration-connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "github::personal",
        provider: "github",
        name: "Personal GitHub",
        credentialKey: "provider::github::personal",
        enabled: true,
        isDefault: true,
        capabilities: [{ id: "github", enabled: true }],
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.connection).toMatchObject({
      id: "github::personal",
      provider: "github",
      source: "explicit",
      createdAt: 5000,
      updatedAt: 5000,
    });
    expect(mockSettingsRepo.setIntegrationConnections).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "github::personal",
        provider: "github",
        isDefault: true,
      }),
    ]);
  });

  it("demotes the previous default when a new default is saved", async () => {
    vi.spyOn(Date, "now").mockReturnValue(6000 * 1000);
    mockSettingsRepo.getIntegrationConnections.mockResolvedValue([
      {
        id: "github::old",
        provider: "github",
        name: "Old",
        credentialKey: "provider::github::old",
        enabled: true,
        isDefault: true,
        source: "explicit",
        capabilities: [{ id: "github", enabled: true }],
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    mockSettingsRepo.setIntegrationConnections.mockResolvedValue(undefined);

    const req = new Request("http://localhost/api/integration-connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "github::new",
        provider: "github",
        name: "New",
        credentialKey: "provider::github::new",
        enabled: true,
        isDefault: true,
        capabilities: [{ id: "github", enabled: true }],
      }),
    });

    await POST(req);

    expect(mockSettingsRepo.setIntegrationConnections).toHaveBeenCalledWith([
      expect.objectContaining({ id: "github::old", isDefault: false }),
      expect.objectContaining({ id: "github::new", isDefault: true }),
    ]);
  });
});

describe("DELETE /api/integration-connections", () => {
  it("deletes an explicit connection", async () => {
    mockSettingsRepo.getIntegrationConnections.mockResolvedValue([
      {
        id: "github::personal",
        provider: "github",
        name: "Personal",
        credentialKey: "provider::github::personal",
        enabled: true,
        isDefault: true,
        source: "explicit",
        capabilities: [{ id: "github", enabled: true }],
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    mockSettingsRepo.setIntegrationConnections.mockResolvedValue(undefined);

    const req = new Request("http://localhost/api/integration-connections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "github::personal" }),
    });

    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockSettingsRepo.setIntegrationConnections).toHaveBeenCalledWith([]);
  });

  it("returns 404 when the connection does not exist", async () => {
    mockSettingsRepo.getIntegrationConnections.mockResolvedValue([]);

    const req = new Request("http://localhost/api/integration-connections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "missing" }),
    });

    const res = await DELETE(req);

    expect(res.status).toBe(404);
  });
});
