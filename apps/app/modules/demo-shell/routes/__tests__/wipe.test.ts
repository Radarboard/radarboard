import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCacheRepo = { clear: vi.fn() };
const mockSettingsRepo = {
  getWidgetLayout: vi.fn(),
  setWidgetLayout: vi.fn(),
};

vi.mock("@/db/repository", () => ({
  getCacheRepo: () => mockCacheRepo,
  getSettingsRepo: () => mockSettingsRepo,
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { handleDemoWipe as POST } from "@/modules/demo-shell/routes/wipe";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/dev/demo/wipe", () => {
  it("clears cache and disables demo mode", async () => {
    mockSettingsRepo.getWidgetLayout.mockResolvedValue({
      widgets: [],
      preferences: { demoMode: true, theme: "dark" },
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockCacheRepo.clear).toHaveBeenCalled();
    expect(mockSettingsRepo.setWidgetLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({ demoMode: false, theme: "dark" }),
      })
    );
  });

  it("preserves other preferences when disabling demo mode", async () => {
    mockSettingsRepo.getWidgetLayout.mockResolvedValue({
      widgets: ["a", "b"],
      preferences: { demoMode: true, columns: 3 },
    });

    await POST();

    const saved = mockSettingsRepo.setWidgetLayout.mock.calls[0][0];
    expect(saved.widgets).toEqual(["a", "b"]);
    expect(saved.preferences.columns).toBe(3);
    expect(saved.preferences.demoMode).toBe(false);
  });

  it("skips layout update when no layout exists", async () => {
    mockSettingsRepo.getWidgetLayout.mockResolvedValue(null);

    const res = await POST();
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(mockSettingsRepo.setWidgetLayout).not.toHaveBeenCalled();
  });

  it("returns 500 on error", async () => {
    mockCacheRepo.clear.mockRejectedValue(new Error("DB locked"));

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("DB locked");
  });
});
