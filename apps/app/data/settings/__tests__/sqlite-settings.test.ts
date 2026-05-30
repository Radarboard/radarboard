import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../client", () => ({
  getDb: vi.fn(),
  ensureDbReady: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../schema", () => ({
  userSettings: { id: "id" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  sql: { raw: vi.fn((s: string) => s) },
}));

import { getDb } from "@/data/core/client";
import { SqliteSettingsRepository } from "../sqlite-settings";

function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  // select().from().where().get()
  chain.get = vi.fn();
  chain.where = vi.fn().mockReturnValue({ get: chain.get });
  chain.from = vi.fn().mockReturnValue({ where: chain.where });
  chain.select = vi.fn().mockReturnValue({ from: chain.from });

  // insert().values().onConflictDoUpdate()
  chain.onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  chain.values = vi.fn().mockReturnValue({ onConflictDoUpdate: chain.onConflictDoUpdate });
  chain.insert = vi.fn().mockReturnValue({ values: chain.values });

  // run() for raw SQL (migrations)
  chain.run = vi.fn().mockResolvedValue(undefined);

  // all() for PRAGMA queries -- returns empty by default (no existing columns)
  chain.all = vi
    .fn()
    .mockResolvedValue([{ name: "id" }, { name: "project_order" }, { name: "updated_at" }]);

  return chain;
}

let mockDb: ReturnType<typeof createMockDb>;
let repo: SqliteSettingsRepository;

beforeEach(() => {
  mockDb = createMockDb();

  const dbProxy = {
    select: mockDb.select,
    insert: mockDb.insert,
    run: mockDb.run,
    all: mockDb.all,
  };

  vi.mocked(getDb).mockReturnValue(dbProxy as unknown as ReturnType<typeof getDb>);
  repo = new SqliteSettingsRepository();
});

describe("SqliteSettingsRepository", () => {
  describe("getProjectOrder", () => {
    it("returns empty array when no row", async () => {
      mockDb.get.mockResolvedValue(undefined);

      const result = await repo.getProjectOrder();

      expect(result).toEqual([]);
    });

    it("returns empty array when projectOrder is null", async () => {
      mockDb.get.mockResolvedValue({ id: "default", projectOrder: null, updatedAt: 100 });

      const result = await repo.getProjectOrder();

      expect(result).toEqual([]);
    });

    it("parses JSON from row", async () => {
      mockDb.get.mockResolvedValue({
        id: "default",
        projectOrder: JSON.stringify(["proj-a", "proj-b"]),
        updatedAt: 100,
      });

      const result = await repo.getProjectOrder();

      expect(result).toEqual(["proj-a", "proj-b"]);
    });
  });

  describe("setProjectOrder", () => {
    it("upserts with JSON stringified order", async () => {
      vi.spyOn(Date, "now").mockReturnValue(5000 * 1000);

      await repo.setProjectOrder(["proj-x", "proj-y"]);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        id: "default",
        projectOrder: JSON.stringify(["proj-x", "proj-y"]),
        updatedAt: 5000,
      });
      expect(mockDb.onConflictDoUpdate).toHaveBeenCalledWith({
        target: "id", // userSettings.id from mocked schema
        set: {
          projectOrder: JSON.stringify(["proj-x", "proj-y"]),
          updatedAt: 5000,
        },
      });
    });
  });

  describe("ensureColumns", () => {
    it("adds missing columns via ALTER TABLE", async () => {
      // PRAGMA returns only base columns; the JSON settings columns are missing.
      mockDb.all.mockResolvedValue([
        { name: "id" },
        { name: "project_order" },
        { name: "updated_at" },
      ]);
      mockDb.get.mockResolvedValue(undefined);

      await repo.getProjectIntegrations();

      // Should have called PRAGMA, then eleven ALTER TABLE statements
      expect(mockDb.all).toHaveBeenCalled();
      expect(mockDb.run).toHaveBeenCalledTimes(11);
    });

    it("skips ALTER TABLE when columns already exist", async () => {
      mockDb.all.mockResolvedValue([
        { name: "id" },
        { name: "project_order" },
        { name: "updated_at" },
        { name: "widget_layout" },
        { name: "project_integrations" },
        { name: "integration_connections" },
        { name: "project_context_map" },
        { name: "llm_config" },
        { name: "debug_config" },
        { name: "routing_config" },
        { name: "workflows" },
        { name: "feature_preferences" },
        { name: "user_plan" },
        { name: "license_key" },
      ]);
      mockDb.get.mockResolvedValue(undefined);

      await repo.getProjectIntegrations();

      expect(mockDb.all).toHaveBeenCalled();
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    it("only runs migration once across multiple calls", async () => {
      mockDb.get.mockResolvedValue(undefined);

      await repo.getProjectIntegrations();

      mockDb.all.mockClear();
      mockDb.run.mockClear();

      await repo.getProjectIntegrations();

      // PRAGMA should not be called again
      expect(mockDb.all).not.toHaveBeenCalled();
      expect(mockDb.run).not.toHaveBeenCalled();
    });
  });

  describe("getProjectIntegrations", () => {
    it("returns empty object when no row", async () => {
      mockDb.get.mockResolvedValue(undefined);

      const result = await repo.getProjectIntegrations();

      expect(result).toEqual({});
    });

    it("returns empty object when projectIntegrations is null", async () => {
      mockDb.get.mockResolvedValue({ id: "default", projectIntegrations: null });

      const result = await repo.getProjectIntegrations();

      expect(result).toEqual({});
    });

    it("parses JSON from row", async () => {
      const data = { "my-project": { _project: { github: { owner: "foo", repo: "bar" } } } };
      mockDb.get.mockResolvedValue({
        id: "default",
        projectIntegrations: JSON.stringify(data),
      });

      const result = await repo.getProjectIntegrations();

      expect(result).toEqual(data);
    });
  });

  describe("setProjectIntegrations", () => {
    it("upserts with JSON stringified integrations", async () => {
      vi.spyOn(Date, "now").mockReturnValue(8000 * 1000);
      const data = { "my-project": { _project: { github: { owner: "a", repo: "b" } } } };

      await repo.setProjectIntegrations(data);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        id: "default",
        projectIntegrations: JSON.stringify(data),
        updatedAt: 8000,
      });
      expect(mockDb.onConflictDoUpdate).toHaveBeenCalledWith({
        target: "id",
        set: {
          projectIntegrations: JSON.stringify(data),
          updatedAt: 8000,
        },
      });
    });
  });

  describe("getIntegrationConnections", () => {
    it("returns empty array when no row", async () => {
      mockDb.get.mockResolvedValue(undefined);

      const result = await repo.getIntegrationConnections();

      expect(result).toEqual([]);
    });

    it("parses JSON from row", async () => {
      const data = [
        {
          id: "github::default",
          provider: "github",
          name: "GitHub",
          credentialKey: "github",
          enabled: true,
          isDefault: true,
          source: "explicit",
          capabilities: [{ id: "github", enabled: true }],
          createdAt: 1,
          updatedAt: 1,
        },
      ];
      mockDb.get.mockResolvedValue({
        id: "default",
        integrationConnections: JSON.stringify(data),
      });

      const result = await repo.getIntegrationConnections();

      expect(result).toEqual(data);
    });
  });

  describe("setIntegrationConnections", () => {
    it("upserts with JSON stringified connections", async () => {
      vi.spyOn(Date, "now").mockReturnValue(8500 * 1000);
      const data = [
        {
          id: "github::default",
          provider: "github",
          name: "GitHub",
          credentialKey: "github",
          enabled: true,
          isDefault: true,
          source: "explicit",
          capabilities: [{ id: "github", enabled: true }],
          createdAt: 1,
          updatedAt: 1,
        },
      ];

      await repo.setIntegrationConnections(data);

      expect(mockDb.values).toHaveBeenCalledWith({
        id: "default",
        integrationConnections: JSON.stringify(data),
        updatedAt: 8500,
      });
    });
  });

  describe("getWidgetLayout", () => {
    it("returns null when no row", async () => {
      mockDb.get.mockResolvedValue(undefined);

      const result = await repo.getWidgetLayout();

      expect(result).toBeNull();
    });

    it("parses JSON from row", async () => {
      const layout = { layout: { slot1: "stars" }, configs: {} };
      mockDb.get.mockResolvedValue({
        id: "default",
        widgetLayout: JSON.stringify(layout),
      });

      const result = await repo.getWidgetLayout();

      expect(result).toEqual(layout);
    });
  });

  describe("setWidgetLayout", () => {
    it("upserts with JSON stringified layout", async () => {
      vi.spyOn(Date, "now").mockReturnValue(9000 * 1000);
      const layout = { layout: { slot1: "revenue" }, configs: {} };

      await repo.setWidgetLayout(layout);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        id: "default",
        widgetLayout: JSON.stringify(layout),
        updatedAt: 9000,
      });
    });
  });

  describe("getRoutingConfig", () => {
    it("returns empty rules when no row exists", async () => {
      mockDb.get.mockResolvedValue(undefined);

      const result = await repo.getRoutingConfig();

      expect(result).toEqual({ rules: [] });
    });

    it("parses routing config JSON from row", async () => {
      const config = {
        rules: [
          {
            id: "deny-github",
            name: "Deny GitHub",
            enabled: true,
            source: "github",
            eventType: "pr.merged",
            severity: null,
            projectSlug: null,
            condition: null,
            notifications: "deny",
            ticker: "inherit",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      };
      mockDb.get.mockResolvedValue({
        id: "default",
        routingConfig: JSON.stringify(config),
      });

      const result = await repo.getRoutingConfig();

      expect(result).toEqual(config);
    });
  });

  describe("setRoutingConfig", () => {
    it("upserts routing config as JSON", async () => {
      vi.spyOn(Date, "now").mockReturnValue(10000 * 1000);
      const config = {
        rules: [
          {
            id: "allow-vercel",
            name: "Allow Vercel",
            enabled: true,
            source: "vercel",
            eventType: "deploy.succeeded",
            severity: null,
            projectSlug: null,
            condition: null,
            notifications: "inherit",
            ticker: "allow",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      };

      await repo.setRoutingConfig(config);

      expect(mockDb.values).toHaveBeenCalledWith({
        id: "default",
        routingConfig: JSON.stringify(config),
        updatedAt: 10000,
      });
    });
  });
});
