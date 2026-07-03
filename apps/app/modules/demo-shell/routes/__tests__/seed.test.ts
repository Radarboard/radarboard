import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCacheRepo = { set: vi.fn() };
const mockSettingsRepo = {
  getWidgetLayout: vi.fn(),
  setWidgetLayout: vi.fn(),
};
const initializeWidgetDescriptors = vi.fn();

vi.mock("@/db/repository", () => ({
  getCacheRepo: () => mockCacheRepo,
  getSettingsRepo: () => mockSettingsRepo,
}));

vi.mock("@/lib/widgets-init", () => ({
  initializeWidgetDescriptors: () => initializeWidgetDescriptors(),
}));

vi.mock("@radarboard/logger/logger", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

vi.mock("@radarboard/widget-engine/widgets/registry", () => ({
  WIDGET_REGISTRY: new Map([
    ["analytics", {}],
    ["bookmarks", {}],
    ["logs", {}],
    ["observability", {}],
    ["revenue", {}],
    ["roadmap", {}],
    ["seo", {}],
    ["shipping", {}],
    ["sponsorship", { supportedDashboardScopes: ["all-projects", "project"] }],
  ]),
}));

import { handleDemoSeed as POST } from "@/modules/demo-shell/routes/seed";

beforeEach(() => {
  vi.clearAllMocks();
  mockCacheRepo.set.mockResolvedValue(undefined);
  mockSettingsRepo.setWidgetLayout.mockResolvedValue(undefined);
});

describe("POST /api/dev/demo/seed", () => {
  it("seeds cache entries and applies a filled Basic 3x3 demo layout", async () => {
    mockSettingsRepo.getWidgetLayout.mockResolvedValue({
      configs: { revenue: { variant: "kpi" } },
      modalPrefs: { revenue: { all: { size: "lg" } } },
      projectLayouts: {
        custom: { pages: [] },
      },
      preferences: {
        locale: "en-US",
        theme: "dark",
      },
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.seeded).toBeGreaterThan(0);
    expect(mockCacheRepo.set).toHaveBeenCalled();
    expect(initializeWidgetDescriptors).toHaveBeenCalled();

    const saved = mockSettingsRepo.setWidgetLayout.mock.calls[0][0];
    expect(saved.configs).toEqual({ revenue: { variant: "kpi" } });
    expect(saved.modalPrefs).toEqual({ revenue: { all: { size: "lg" } } });
    expect(saved.layouts).toHaveLength(1);
    expect(saved.layouts[0].id).toBe("basic-3x3");
    expect(saved.projectLayouts.custom).toEqual({ pages: [] });

    const page = saved.projectLayouts.__all__.pages[0];
    expect(page).toEqual(
      expect.objectContaining({
        name: "Overview",
        slug: "overview",
        layoutId: "basic-3x3",
      })
    );
    expect(page.widgetLayouts["basic-3x3"]).toEqual({
      "cell-1": "seo",
      "cell-2": "analytics",
      "cell-3": "revenue",
      "cell-4": "observability",
      "cell-5": "bookmarks",
      "cell-6": "shipping",
      "cell-7": "sponsorship",
      "cell-8": "roadmap",
      "cell-9": "logs",
    });
    expect(saved.preferences).toEqual(
      expect.objectContaining({
        locale: "en-US",
        theme: "dark",
        demoMode: true,
        onboardingCompleted: true,
        blueprintWidgetMap: {
          "cell-1": "seo",
          "cell-2": "analytics",
          "cell-3": "revenue",
          "cell-4": "observability",
          "cell-5": "bookmarks",
          "cell-6": "shipping",
          "cell-7": "sponsorship",
          "cell-8": "roadmap",
          "cell-9": "logs",
        },
      })
    );
  });

  it("creates demo layout settings when no layout exists yet", async () => {
    mockSettingsRepo.getWidgetLayout.mockResolvedValue(null);

    await POST();

    const saved = mockSettingsRepo.setWidgetLayout.mock.calls[0][0];
    expect(saved.configs).toEqual({});
    expect(saved.modalPrefs).toEqual({});
    expect(saved.projectLayouts.__all__.pages[0].widgetLayouts["basic-3x3"]).toHaveProperty(
      "cell-9",
      "logs"
    );
    expect(saved.preferences.demoMode).toBe(true);
  });

  it("returns 500 on error", async () => {
    mockCacheRepo.set.mockRejectedValue(new Error("DB locked"));
    mockSettingsRepo.getWidgetLayout.mockResolvedValue(null);

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("DB locked");
  });
});
