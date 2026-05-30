import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@libsql/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@libsql/client";
import { TursoSettingsRepository } from "../turso-settings";

const mockExecute = vi.fn();

let repo: TursoSettingsRepository;

beforeEach(() => {
  mockExecute.mockReset();
  vi.mocked(createClient).mockReturnValue({ execute: mockExecute } as unknown as ReturnType<
    typeof createClient
  >);
  repo = new TursoSettingsRepository({ url: "libsql://test.turso.io", authToken: "test-token" });
});

describe("TursoSettingsRepository", () => {
  describe("getProjectOrder", () => {
    it("returns empty array when no row", async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const result = await repo.getProjectOrder();

      expect(result).toEqual([]);
      expect(mockExecute).toHaveBeenCalledWith({
        sql: "SELECT project_order FROM user_settings WHERE id = ?",
        args: ["default"],
      });
    });

    it("returns empty array when project_order is null", async () => {
      mockExecute.mockResolvedValue({ rows: [{ project_order: null }] });

      const result = await repo.getProjectOrder();

      expect(result).toEqual([]);
    });

    it("returns parsed order when row exists", async () => {
      mockExecute.mockResolvedValue({
        rows: [{ project_order: JSON.stringify(["proj-a", "proj-b"]) }],
      });

      const result = await repo.getProjectOrder();

      expect(result).toEqual(["proj-a", "proj-b"]);
    });
  });

  describe("setProjectOrder", () => {
    it("executes INSERT...ON CONFLICT with JSON stringified order", async () => {
      vi.spyOn(Date, "now").mockReturnValue(5000 * 1000);
      mockExecute.mockResolvedValue({ rows: [] });

      await repo.setProjectOrder(["proj-x", "proj-y"]);

      expect(mockExecute).toHaveBeenCalledOnce();
      const call = mockExecute.mock.calls[0][0];
      expect(call.sql).toContain("INSERT INTO user_settings");
      expect(call.sql).toContain("ON CONFLICT(id) DO UPDATE");
      expect(call.args).toEqual([
        "default",
        JSON.stringify(["proj-x", "proj-y"]),
        5000,
        JSON.stringify(["proj-x", "proj-y"]),
        5000,
      ]);
    });
  });

  describe("getRoutingConfig", () => {
    it("returns empty rules when routing_config is missing", async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const result = await repo.getRoutingConfig();

      expect(result).toEqual({ rules: [] });
      expect(mockExecute).toHaveBeenCalledWith({
        sql: "SELECT routing_config FROM user_settings WHERE id = ?",
        args: ["default"],
      });
    });
  });

  describe("setRoutingConfig", () => {
    it("stores routing config with INSERT...ON CONFLICT", async () => {
      vi.spyOn(Date, "now").mockReturnValue(9000 * 1000);
      mockExecute.mockResolvedValue({ rows: [] });

      await repo.setRoutingConfig({ rules: [] });

      const call = mockExecute.mock.calls[0][0];
      expect(call.sql).toContain("routing_config");
      expect(call.args).toEqual([
        "default",
        JSON.stringify({ rules: [] }),
        9000,
        JSON.stringify({ rules: [] }),
        9000,
      ]);
    });
  });
});
