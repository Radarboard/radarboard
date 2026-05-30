import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { PlanetscaleSettingsRepository } from "../planetscale-settings";

const CONFIG = {
  host: "test.connect.psdb.cloud",
  username: "test-user",
  password: "test-pass",
};
const EXPECTED_AUTH = `Basic ${Buffer.from(`${CONFIG.username}:${CONFIG.password}`).toString("base64")}`;

let repo: PlanetscaleSettingsRepository;

beforeEach(() => {
  mockFetch.mockReset();
  repo = new PlanetscaleSettingsRepository(CONFIG);
});

function mockOkResponse(rows: Record<string, unknown>[]) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ rows }),
  });
}

function expectQueryCall(expectedQuery: string, expectedArgs: unknown[]) {
  expect(mockFetch).toHaveBeenCalledOnce();
  const [url, opts] = mockFetch.mock.calls[0];
  expect(url).toBe(`https://${CONFIG.host}/v1/query`);
  expect(opts.method).toBe("POST");

  const headers = opts.headers as Record<string, string>;
  expect(headers.Authorization).toBe(EXPECTED_AUTH);
  expect(headers["Content-Type"]).toBe("application/json");

  const body = JSON.parse(opts.body as string);
  expect(body.query).toBe(expectedQuery);
  expect(body.args).toEqual(expectedArgs);
}

describe("PlanetscaleSettingsRepository", () => {
  describe("getProjectOrder", () => {
    it("returns empty array when no row", async () => {
      mockOkResponse([]);

      const result = await repo.getProjectOrder();

      expect(result).toEqual([]);
      expectQueryCall("SELECT project_order FROM user_settings WHERE id = ?", ["default"]);
    });

    it("returns empty array when project_order is null", async () => {
      mockOkResponse([{ project_order: null }]);

      const result = await repo.getProjectOrder();

      expect(result).toEqual([]);
    });

    it("returns parsed order when row exists", async () => {
      mockOkResponse([{ project_order: JSON.stringify(["proj-a", "proj-b"]) }]);

      const result = await repo.getProjectOrder();

      expect(result).toEqual(["proj-a", "proj-b"]);
    });
  });

  describe("setProjectOrder", () => {
    it("sends INSERT...ON DUPLICATE KEY UPDATE", async () => {
      vi.spyOn(Date, "now").mockReturnValue(5000 * 1000);
      mockOkResponse([]);

      await repo.setProjectOrder(["proj-x", "proj-y"]);

      expect(mockFetch).toHaveBeenCalledOnce();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.query).toContain("INSERT INTO user_settings");
      expect(body.query).toContain("ON DUPLICATE KEY UPDATE");
      expect(body.args).toEqual(["default", JSON.stringify(["proj-x", "proj-y"]), 5000]);

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers.Authorization).toBe(EXPECTED_AUTH);
    });
  });

  describe("getRoutingConfig", () => {
    it("returns empty rules when routing config is missing", async () => {
      mockOkResponse([]);

      const result = await repo.getRoutingConfig();

      expect(result).toEqual({ rules: [] });
      expectQueryCall("SELECT routing_config FROM user_settings WHERE id = ?", ["default"]);
    });
  });

  describe("setRoutingConfig", () => {
    it("stores routing config with ON DUPLICATE KEY UPDATE", async () => {
      vi.spyOn(Date, "now").mockReturnValue(7000 * 1000);
      mockOkResponse([]);

      await repo.setRoutingConfig({ rules: [] });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.query).toContain("routing_config");
      expect(body.args).toEqual(["default", JSON.stringify({ rules: [] }), 7000]);
    });
  });

  describe("query error", () => {
    it("throws when fetch returns non-ok", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      });

      await expect(repo.getProjectOrder()).rejects.toThrow(
        "PlanetScale query failed: 403 Forbidden"
      );
    });
  });
});
