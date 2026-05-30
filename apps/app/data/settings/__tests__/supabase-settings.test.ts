import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { SupabaseSettingsRepository } from "../supabase-settings";

const BASE_URL = "https://test.supabase.co";
const ANON_KEY = "test-key";

let repo: SupabaseSettingsRepository;

beforeEach(() => {
  mockFetch.mockReset();
  repo = new SupabaseSettingsRepository({ url: BASE_URL, anonKey: ANON_KEY });
});

describe("SupabaseSettingsRepository", () => {
  describe("getProjectOrder", () => {
    it("returns empty array when no row", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await repo.getProjectOrder();

      expect(result).toEqual([]);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/rest/v1/user_settings?id=eq.default&select=project_order`);
    });

    it("returns empty array when project_order is null", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ project_order: null }]),
      });

      const result = await repo.getProjectOrder();

      expect(result).toEqual([]);
    });

    it("returns empty array when fetch is not ok", async () => {
      mockFetch.mockResolvedValue({ ok: false });

      const result = await repo.getProjectOrder();

      expect(result).toEqual([]);
    });

    it("returns parsed order when row exists", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ project_order: JSON.stringify(["proj-a", "proj-b"]) }]),
      });

      const result = await repo.getProjectOrder();

      expect(result).toEqual(["proj-a", "proj-b"]);
      const headers = (mockFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
      expect(headers.apikey).toBe(ANON_KEY);
      expect(headers.Authorization).toBe(`Bearer ${ANON_KEY}`);
    });
  });

  describe("setProjectOrder", () => {
    it("calls fetch with POST and correct body", async () => {
      vi.spyOn(Date, "now").mockReturnValue(5000 * 1000);
      mockFetch.mockResolvedValue({ ok: true });

      await repo.setProjectOrder(["proj-x", "proj-y"]);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/rest/v1/user_settings`);
      expect(opts.method).toBe("POST");

      const headers = opts.headers as Record<string, string>;
      expect(headers.Prefer).toBe("resolution=merge-duplicates,return=minimal");
      expect(headers.apikey).toBe(ANON_KEY);
      expect(headers.Authorization).toBe(`Bearer ${ANON_KEY}`);

      expect(JSON.parse(opts.body as string)).toEqual({
        id: "default",
        project_order: JSON.stringify(["proj-x", "proj-y"]),
        updated_at: 5000,
      });
    });
  });

  describe("getRoutingConfig", () => {
    it("returns empty rules when routing config is missing", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await repo.getRoutingConfig();

      expect(result).toEqual({ rules: [] });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/rest/v1/user_settings?id=eq.default&select=routing_config`);
    });
  });

  describe("setRoutingConfig", () => {
    it("stores routing config via POST", async () => {
      vi.spyOn(Date, "now").mockReturnValue(7000 * 1000);
      mockFetch.mockResolvedValue({ ok: true });

      await repo.setRoutingConfig({ rules: [] });

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/rest/v1/user_settings`);
      expect(JSON.parse(opts.body as string)).toEqual({
        id: "default",
        routing_config: JSON.stringify({ rules: [] }),
        updated_at: 7000,
      });
    });
  });
});
