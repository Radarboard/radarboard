import type { LayoutDefinition, WidgetLayoutConfig } from "@radarboard/types/database";
import { describe, expect, it } from "vitest";
import { moveWidget, placeWidget } from "../add-widget";
import { setWidgetConfig } from "../configure-widget";
import { clearWidget } from "../remove-widget";
import { collectPlacedWidgetIds, computeSetupSuggestions } from "../suggest-setup";

const LAYOUT: LayoutDefinition = {
  id: "test-layout",
  name: "Test",
  cells: [
    { id: "cell-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-2", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-3", rowStart: 1, colStart: 0, rowSpan: 1, colSpan: 1 },
  ],
};

function config(assignments: Record<string, string | null>): WidgetLayoutConfig {
  return {
    configs: {},
    layouts: [LAYOUT],
    projectLayouts: {
      __all__: {
        pages: [
          {
            name: "Overview",
            slug: "overview",
            layoutId: "test-layout",
            widgetLayouts: { "test-layout": assignments },
          },
        ],
      },
    },
  };
}

function assignmentsOf(c: WidgetLayoutConfig): Record<string, string | null> {
  return c.projectLayouts?.__all__?.pages?.[0]?.widgetLayouts?.["test-layout"] ?? {};
}

describe("placeWidget", () => {
  it("places in the first empty cell when no cellId is given", () => {
    const res = placeWidget(config({ "cell-1": "revenue", "cell-2": null, "cell-3": null }), {
      widgetId: "analytics",
      projectSlug: null,
    });
    expect(res.ok).toBe(true);
    expect(res.cellId).toBe("cell-2");
    expect(res.replaced).toBeNull();
    expect(assignmentsOf(res.config!)["cell-2"]).toBe("analytics");
  });

  it("places into a specific cell and reports what it replaced", () => {
    const res = placeWidget(config({ "cell-1": "revenue", "cell-2": null, "cell-3": null }), {
      widgetId: "analytics",
      projectSlug: null,
      cellId: "cell-1",
    });
    expect(res.ok).toBe(true);
    expect(res.replaced).toBe("revenue");
    expect(assignmentsOf(res.config!)["cell-1"]).toBe("analytics");
  });

  it("rejects an unknown cell", () => {
    const res = placeWidget(config({ "cell-1": null }), {
      widgetId: "analytics",
      projectSlug: null,
      cellId: "cell-99",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not part of/);
  });

  it("rejects when the layout is full", () => {
    const res = placeWidget(config({ "cell-1": "a", "cell-2": "b", "cell-3": "c" }), {
      widgetId: "analytics",
      projectSlug: null,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/full/);
  });

  it("bootstraps a default page/layout on a fresh dashboard", () => {
    const res = placeWidget({ configs: {} }, { widgetId: "revenue", projectSlug: null });
    expect(res.ok).toBe(true);
    expect(res.cellId).toBeTruthy();
    // A layout and an overview page were created for the __all__ owner.
    expect(res.config?.layouts?.length).toBeGreaterThan(0);
    const page = res.config?.projectLayouts?.__all__?.pages?.[0];
    expect(page?.slug).toBe("overview");
  });
});

describe("clearWidget", () => {
  it("clears a cell by cellId", () => {
    const res = clearWidget(config({ "cell-1": "revenue", "cell-2": null }), {
      projectSlug: null,
      cellId: "cell-1",
    });
    expect(res.removed).toBe(true);
    expect(res.widgetId).toBe("revenue");
    expect(assignmentsOf(res.config!)["cell-1"]).toBeNull();
  });

  it("clears the first cell holding a widget by widgetId", () => {
    const res = clearWidget(config({ "cell-1": "revenue", "cell-2": "analytics" }), {
      projectSlug: null,
      widgetId: "analytics",
    });
    expect(res.removed).toBe(true);
    expect(res.cellId).toBe("cell-2");
  });

  it("errors when the target cell is already empty", () => {
    const res = clearWidget(config({ "cell-1": null }), { projectSlug: null, cellId: "cell-1" });
    expect(res.removed).toBe(false);
    expect(res.error).toMatch(/already empty/);
  });

  it("errors when the widget is not on the page", () => {
    const res = clearWidget(config({ "cell-1": "revenue" }), {
      projectSlug: null,
      widgetId: "ghost",
    });
    expect(res.removed).toBe(false);
    expect(res.error).toMatch(/not on/);
  });
});

describe("moveWidget", () => {
  it("moves a widget to an empty cell", () => {
    const res = moveWidget(config({ "cell-1": "revenue", "cell-2": null, "cell-3": null }), {
      widgetId: "revenue",
      toCellId: "cell-3",
      projectSlug: null,
    });
    expect(res.moved).toBe(true);
    expect(res.fromCellId).toBe("cell-1");
    const a = assignmentsOf(res.config!);
    expect(a["cell-1"]).toBeNull();
    expect(a["cell-3"]).toBe("revenue");
  });

  it("swaps with the occupant of the destination cell", () => {
    const res = moveWidget(config({ "cell-1": "revenue", "cell-2": "analytics" }), {
      widgetId: "revenue",
      toCellId: "cell-2",
      projectSlug: null,
    });
    expect(res.moved).toBe(true);
    expect(res.swapped).toBe("analytics");
    const a = assignmentsOf(res.config!);
    expect(a["cell-1"]).toBe("analytics");
    expect(a["cell-2"]).toBe("revenue");
  });

  it("errors when the widget is not on the page", () => {
    const res = moveWidget(config({ "cell-1": "revenue" }), {
      widgetId: "ghost",
      toCellId: "cell-2",
      projectSlug: null,
    });
    expect(res.moved).toBe(false);
  });
});

describe("setWidgetConfig", () => {
  it("merges into existing config by default", () => {
    const next = setWidgetConfig(
      { configs: { revenue: { currency: "USD", period: "month" } } },
      { widgetId: "revenue", config: { currency: "EUR" } }
    );
    expect(next.configs.revenue).toEqual({ currency: "EUR", period: "month" });
  });

  it("replaces config when mode is replace", () => {
    const next = setWidgetConfig(
      { configs: { revenue: { currency: "USD", period: "month" } } },
      { widgetId: "revenue", config: { currency: "EUR" }, mode: "replace" }
    );
    expect(next.configs.revenue).toEqual({ currency: "EUR" });
  });
});

describe("collectPlacedWidgetIds", () => {
  it("collects placed widget ids for the owner, ignoring empties", () => {
    const ids = collectPlacedWidgetIds(config({ "cell-1": "revenue", "cell-2": null }), null);
    expect([...ids]).toEqual(["revenue"]);
  });
});

describe("computeSetupSuggestions", () => {
  const widgets = [
    { id: "logs", name: "Logs", requiredIntegrations: [], scopes: ["all-projects" as const] },
    {
      id: "revenue",
      name: "Revenue",
      requiredIntegrations: ["revenuecat"],
      scopes: ["all-projects" as const],
    },
    {
      id: "roadmap",
      name: "Roadmap",
      requiredIntegrations: ["linear"],
      scopes: ["all-projects" as const],
    },
    {
      id: "stars",
      name: "Stars",
      requiredIntegrations: ["github"],
      scopes: ["all-projects" as const],
    },
    {
      id: "pulls",
      name: "Pulls",
      requiredIntegrations: ["github"],
      scopes: ["all-projects" as const],
    },
  ];
  const integrations = [
    { id: "revenuecat", name: "RevenueCat", provider: "revenuecat" },
    { id: "linear", name: "Linear", provider: "linear" },
    { id: "github-stars", name: "GitHub", provider: "github" },
  ];

  it("recommends ready widgets and ranks integrations by how much they unlock", () => {
    const result = computeSetupSuggestions({
      widgets,
      integrations,
      connectedProviders: new Set(["revenuecat"]),
      placedWidgetIds: new Set(["logs"]),
      scope: "all-projects",
    });

    // 'logs' is placed → skipped. 'revenue' is ready (revenuecat connected).
    const ready = result.filter((s) => s.type === "add_widget");
    expect(ready.map((s) => s.id)).toEqual(["revenue"]);

    // github unlocks 2 widgets (stars+pulls) so it ranks above linear (1).
    const connect = result.filter((s) => s.type === "connect_integration");
    expect(connect[0]?.id).toBe("github");
    expect(connect[0]?.name).toBe("GitHub");
    expect(connect.map((s) => s.id)).toEqual(["github", "linear"]);
  });

  it("respects dashboard scope", () => {
    const result = computeSetupSuggestions({
      widgets: [{ id: "x", name: "X", requiredIntegrations: [], scopes: ["project"] }],
      integrations: [],
      connectedProviders: new Set(),
      placedWidgetIds: new Set(),
      scope: "all-projects",
    });
    expect(result).toHaveLength(0);
  });
});
