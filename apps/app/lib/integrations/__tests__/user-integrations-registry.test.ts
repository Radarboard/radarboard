import { INTEGRATION_REGISTRY } from "@radarboard/integration-sdk/registry";
import type { SettingsRepository } from "@radarboard/types/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureUserIntegrationsRegistered,
  loadUserIntegrationConfigs,
  registerUserIntegrations,
  resetUserIntegrationsRegistrationForTesting,
  saveUserIntegration,
} from "../user-integrations-registry";
import type { UserRestIntegrationConfig } from "../user-rest-integration";

function validConfig(
  overrides: Partial<UserRestIntegrationConfig> = {}
): UserRestIntegrationConfig {
  return {
    id: "acme",
    name: "Acme",
    description: "Acme metrics",
    category: "analytics",
    baseUrl: "https://api.acme.test",
    auth: { scheme: "bearer", fields: [{ key: "apiKey", label: "API Key", type: "password" }] },
    dataSources: [
      { action: "summary", description: "Summary", cacheTtlSeconds: 300, path: "/v1/summary" },
    ],
    ...overrides,
  };
}

/** Minimal repo double exposing only the user-integrations methods. */
function fakeRepo(configs: unknown[]): SettingsRepository {
  return {
    getUserIntegrations: vi.fn(async () => configs),
    setUserIntegrations: vi.fn(async () => undefined),
  } as unknown as SettingsRepository;
}

/** A repo whose stored list mutates when written, for upsert assertions. */
function statefulRepo(initial: unknown[] = []): SettingsRepository & { current: () => unknown[] } {
  let stored = [...initial];
  return {
    getUserIntegrations: vi.fn(async () => stored),
    setUserIntegrations: vi.fn(async (next: unknown[]) => {
      stored = next;
    }),
    current: () => stored,
  } as unknown as SettingsRepository & { current: () => unknown[] };
}

const TEST_IDS = ["acme", "beta"];

beforeEach(() => {
  resetUserIntegrationsRegistrationForTesting();
  for (const id of TEST_IDS) INTEGRATION_REGISTRY.delete(id);
});

afterEach(() => {
  for (const id of TEST_IDS) INTEGRATION_REGISTRY.delete(id);
  vi.restoreAllMocks();
});

describe("loadUserIntegrationConfigs", () => {
  it("returns the persisted configs", async () => {
    const configs = [validConfig()];
    const result = await loadUserIntegrationConfigs(fakeRepo(configs));
    expect(result).toEqual(configs);
  });

  it("returns [] and swallows errors", async () => {
    const repo = {
      getUserIntegrations: vi.fn(async () => {
        throw new Error("db down");
      }),
    } as unknown as SettingsRepository;
    expect(await loadUserIntegrationConfigs(repo)).toEqual([]);
  });
});

describe("registerUserIntegrations", () => {
  it("hydrates + registers valid configs and populates the registry", async () => {
    const count = await registerUserIntegrations(fakeRepo([validConfig()]));
    expect(count).toBe(1);
    expect(INTEGRATION_REGISTRY.has("acme")).toBe(true);
  });

  it("skips invalid configs without throwing", async () => {
    const configs = [validConfig(), validConfig({ id: "Bad_Id", name: "Bad" })];
    const count = await registerUserIntegrations(fakeRepo(configs));
    expect(count).toBe(1);
    expect(INTEGRATION_REGISTRY.has("acme")).toBe(true);
    expect(INTEGRATION_REGISTRY.has("Bad_Id")).toBe(false);
  });
});

describe("ensureUserIntegrationsRegistered", () => {
  it("reads settings only once across repeated calls", async () => {
    const repo = fakeRepo([validConfig()]);
    await ensureUserIntegrationsRegistered(repo);
    await ensureUserIntegrationsRegistered(repo);
    expect(repo.getUserIntegrations).toHaveBeenCalledTimes(1);
    expect(INTEGRATION_REGISTRY.has("acme")).toBe(true);
  });
});

describe("saveUserIntegration", () => {
  it("validates, persists, and live-registers a new integration", async () => {
    const repo = statefulRepo();
    const res = await saveUserIntegration(validConfig(), repo);
    expect(res).toMatchObject({ ok: true, id: "acme", updated: false });
    expect(res.dataSourceActions).toEqual(["summary"]);
    expect(INTEGRATION_REGISTRY.has("acme")).toBe(true);
    expect(repo.setUserIntegrations).toHaveBeenCalledTimes(1);
    expect(repo.current()).toHaveLength(1);
  });

  it("rejects an invalid config without persisting", async () => {
    const repo = statefulRepo();
    const res = await saveUserIntegration(
      validConfig({ baseUrl: "http://evil.example.com" }),
      repo
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/https/);
    expect(repo.setUserIntegrations).not.toHaveBeenCalled();
    expect(INTEGRATION_REGISTRY.has("acme")).toBe(false);
  });

  it("refuses an id already owned by a built-in integration", async () => {
    // 'beta' is registered but is NOT in the persisted user list → treated as built-in.
    INTEGRATION_REGISTRY.set("beta", { id: "beta" } as never);
    const repo = statefulRepo();
    const res = await saveUserIntegration(validConfig({ id: "beta" }), repo);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/already in use/);
    expect(repo.setUserIntegrations).not.toHaveBeenCalled();
  });

  it("upserts + re-registers when updating an existing user integration", async () => {
    const repo = statefulRepo();
    await saveUserIntegration(validConfig({ description: "v1" }), repo);
    const res = await saveUserIntegration(validConfig({ description: "v2" }), repo);
    expect(res).toMatchObject({ ok: true, updated: true });
    // Upsert by id — still exactly one stored entry, with the new description.
    const stored = repo.current() as Array<{ description: string }>;
    expect(stored).toHaveLength(1);
    expect(stored[0]?.description).toBe("v2");
    expect(INTEGRATION_REGISTRY.get("acme")?.description).toBe("v2");
  });
});
