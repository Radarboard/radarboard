/**
 * Tests for db/repository.ts -- the repository factory.
 *
 * The source module uses static imports for each provider implementation.
 * We mock every provider module and the config module, then verify that
 * the correct constructor is instantiated based on the configured provider.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/radarboard-config", () => ({
  getDatabaseConfig: vi.fn(),
}));

vi.mock("@/data/cache/sqlite-cache", () => ({
  SqliteCacheRepository: vi.fn(),
}));
vi.mock("@radarboard/integration-github/stars", () => ({
  createGitHubStarHistoryRepository: vi.fn(),
}));
vi.mock("@/data/settings/sqlite-settings", () => ({
  SqliteSettingsRepository: vi.fn(),
}));
vi.mock("@/data/cache/supabase-cache", () => ({
  SupabaseCacheRepository: vi.fn(),
}));
vi.mock("@/data/settings/supabase-settings", () => ({
  SupabaseSettingsRepository: vi.fn(),
}));
vi.mock("@/data/cache/turso-cache", () => ({
  TursoCacheRepository: vi.fn(),
}));
vi.mock("@/data/settings/turso-settings", () => ({
  TursoSettingsRepository: vi.fn(),
}));
vi.mock("@/data/cache/planetscale-cache", () => ({
  PlanetscaleCacheRepository: vi.fn(),
}));
vi.mock("@/data/settings/planetscale-settings", () => ({
  PlanetscaleSettingsRepository: vi.fn(),
}));

import { createGitHubStarHistoryRepository } from "@radarboard/integration-github/stars";
import { PlanetscaleCacheRepository } from "@/data/cache/planetscale-cache";
import { SqliteCacheRepository } from "@/data/cache/sqlite-cache";
import { SupabaseCacheRepository } from "@/data/cache/supabase-cache";
import { TursoCacheRepository } from "@/data/cache/turso-cache";
import {
  getCacheRepo,
  getDatabaseAdapter,
  getGitHubStarHistoryRepo,
  getSettingsRepo,
  resetRepositories,
} from "@/data/core/repository";
import { PlanetscaleSettingsRepository } from "@/data/settings/planetscale-settings";
import { SqliteSettingsRepository } from "@/data/settings/sqlite-settings";
import { SupabaseSettingsRepository } from "@/data/settings/supabase-settings";
import { TursoSettingsRepository } from "@/data/settings/turso-settings";
import { getDatabaseConfig } from "@/lib/radarboard-config";

beforeEach(() => {
  resetRepositories();
  vi.mocked(getDatabaseConfig).mockReset();
  vi.mocked(createGitHubStarHistoryRepository).mockReset();
  vi.mocked(SqliteCacheRepository).mockClear();
  vi.mocked(SqliteSettingsRepository).mockClear();
  vi.mocked(SupabaseCacheRepository).mockClear();
  vi.mocked(SupabaseSettingsRepository).mockClear();
  vi.mocked(TursoCacheRepository).mockClear();
  vi.mocked(TursoSettingsRepository).mockClear();
  vi.mocked(PlanetscaleCacheRepository).mockClear();
  vi.mocked(PlanetscaleSettingsRepository).mockClear();
  vi.mocked(getDatabaseConfig).mockReturnValue({ provider: "sqlite" });
  vi.mocked(createGitHubStarHistoryRepository).mockReturnValue(
    {} as ReturnType<typeof getGitHubStarHistoryRepo>
  );
});

describe("getCacheRepo", () => {
  it("returns SqliteCacheRepository by default", () => {
    vi.mocked(getDatabaseConfig).mockReturnValue({ provider: "sqlite" });

    getCacheRepo();

    expect(SqliteCacheRepository).toHaveBeenCalledOnce();
  });

  it("returns SupabaseCacheRepository when provider is supabase", () => {
    const supabaseConfig = { url: "https://x.supabase.co", anonKey: "key" };
    vi.mocked(getDatabaseConfig).mockReturnValue({
      provider: "supabase",
      supabase: supabaseConfig,
    });

    getCacheRepo();

    expect(SupabaseCacheRepository).toHaveBeenCalledWith(supabaseConfig);
  });

  it("returns TursoCacheRepository when provider is turso", () => {
    const tursoConfig = { url: "libsql://db.turso.io", authToken: "tok" };
    vi.mocked(getDatabaseConfig).mockReturnValue({
      provider: "turso",
      turso: tursoConfig,
    });

    getCacheRepo();

    expect(TursoCacheRepository).toHaveBeenCalledWith(tursoConfig);
  });

  it("returns PlanetscaleCacheRepository when provider is planetscale", () => {
    const psConfig = { host: "h", username: "u", password: "p" };
    vi.mocked(getDatabaseConfig).mockReturnValue({
      provider: "planetscale",
      planetscale: psConfig,
    });

    getCacheRepo();

    expect(PlanetscaleCacheRepository).toHaveBeenCalledWith(psConfig);
  });

  it("caches instance across calls (singleton)", () => {
    vi.mocked(getDatabaseConfig).mockReturnValue({ provider: "sqlite" });

    getCacheRepo();
    getCacheRepo();

    expect(SqliteCacheRepository).toHaveBeenCalledOnce();
  });

  it("throws when supabase config is missing", () => {
    vi.mocked(getDatabaseConfig).mockReturnValue({ provider: "supabase" });

    expect(() => getCacheRepo()).toThrow("Supabase config missing");
  });

  it("throws when turso config is missing", () => {
    vi.mocked(getDatabaseConfig).mockReturnValue({ provider: "turso" });

    expect(() => getCacheRepo()).toThrow("Turso config missing");
  });

  it("throws when planetscale config is missing", () => {
    vi.mocked(getDatabaseConfig).mockReturnValue({ provider: "planetscale" });

    expect(() => getCacheRepo()).toThrow("PlanetScale config missing");
  });

  it("defaults to sqlite when getDatabaseConfig throws", () => {
    vi.mocked(getDatabaseConfig)
      .mockImplementationOnce(() => {
        throw new Error("No config file");
      })
      .mockReturnValue({ provider: "sqlite" });

    getCacheRepo();

    expect(SqliteCacheRepository).toHaveBeenCalledOnce();
  });
});

describe("getSettingsRepo", () => {
  it("returns SqliteSettingsRepository by default", () => {
    vi.mocked(getDatabaseConfig).mockReturnValue({ provider: "sqlite" });

    getSettingsRepo();

    expect(SqliteSettingsRepository).toHaveBeenCalledOnce();
  });

  it("returns SupabaseSettingsRepository when provider is supabase", () => {
    const supabaseConfig = { url: "https://x.supabase.co", anonKey: "key" };
    vi.mocked(getDatabaseConfig).mockReturnValue({
      provider: "supabase",
      supabase: supabaseConfig,
    });

    getSettingsRepo();

    expect(SupabaseSettingsRepository).toHaveBeenCalledWith(supabaseConfig);
  });

  it("returns TursoSettingsRepository when provider is turso", () => {
    const tursoConfig = { url: "libsql://db.turso.io", authToken: "tok" };
    vi.mocked(getDatabaseConfig).mockReturnValue({
      provider: "turso",
      turso: tursoConfig,
    });

    getSettingsRepo();

    expect(TursoSettingsRepository).toHaveBeenCalledWith(tursoConfig);
  });

  it("returns PlanetscaleSettingsRepository when provider is planetscale", () => {
    const psConfig = { host: "h", username: "u", password: "p" };
    vi.mocked(getDatabaseConfig).mockReturnValue({
      provider: "planetscale",
      planetscale: psConfig,
    });

    getSettingsRepo();

    expect(PlanetscaleSettingsRepository).toHaveBeenCalledWith(psConfig);
  });

  it("throws when supabase config is missing", () => {
    vi.mocked(getDatabaseConfig).mockReturnValue({ provider: "supabase" });

    expect(() => getSettingsRepo()).toThrow("Supabase config missing");
  });

  it("throws when turso config is missing", () => {
    vi.mocked(getDatabaseConfig).mockReturnValue({ provider: "turso" });

    expect(() => getSettingsRepo()).toThrow("Turso config missing");
  });

  it("throws when planetscale config is missing", () => {
    vi.mocked(getDatabaseConfig).mockReturnValue({ provider: "planetscale" });

    expect(() => getSettingsRepo()).toThrow("PlanetScale config missing");
  });
});

describe("getGitHubStarHistoryRepo", () => {
  it("creates the repository through the integration-owned factory", () => {
    vi.mocked(getDatabaseConfig).mockReturnValue({ provider: "sqlite" });

    getGitHubStarHistoryRepo();

    expect(createGitHubStarHistoryRepository).toHaveBeenCalledWith(
      { provider: "sqlite" },
      expect.objectContaining({ getDb: expect.any(Function) })
    );
  });
});

describe("resetRepositories", () => {
  it("clears cached instances so next call creates new ones", () => {
    vi.mocked(getDatabaseConfig).mockReturnValue({ provider: "sqlite" });

    getCacheRepo();
    expect(SqliteCacheRepository).toHaveBeenCalledTimes(1);

    resetRepositories();

    getCacheRepo();
    expect(SqliteCacheRepository).toHaveBeenCalledTimes(2);
  });

  it("recreates singletons when provider changes", () => {
    vi.mocked(getDatabaseConfig).mockReturnValue({ provider: "sqlite" });
    getCacheRepo();
    expect(SqliteCacheRepository).toHaveBeenCalledOnce();

    // Change provider
    const supabaseConfig = { url: "https://x.supabase.co", anonKey: "key" };
    vi.mocked(getDatabaseConfig).mockReturnValue({
      provider: "supabase",
      supabase: supabaseConfig,
    });
    resetRepositories();
    getCacheRepo();

    expect(SupabaseCacheRepository).toHaveBeenCalledWith(supabaseConfig);
  });
});

describe("getDatabaseAdapter", () => {
  it("returns both repos with provider", () => {
    vi.mocked(getDatabaseConfig).mockReturnValue({ provider: "sqlite" });

    const adapter = getDatabaseAdapter();

    expect(adapter.provider).toBe("sqlite");
    expect(adapter.cache).toBeDefined();
    expect(adapter.settings).toBeDefined();
  });

  it("returns correct provider string for supabase", () => {
    vi.mocked(getDatabaseConfig).mockReturnValue({
      provider: "supabase",
      supabase: { url: "https://x.supabase.co", anonKey: "key" },
    });

    const adapter = getDatabaseAdapter();

    expect(adapter.provider).toBe("supabase");
  });
});
