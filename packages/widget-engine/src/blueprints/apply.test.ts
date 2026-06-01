import type { LayoutDefinition } from "@radarboard/types/database";
import { describe, expect, it } from "vitest";
import { applyBlueprint, smartMergeBlueprint } from "./apply";
import type { LayoutBlueprintDescriptor } from "./types";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const MOCK_LAYOUT: LayoutDefinition = {
  id: "test-layout",
  name: "Test Layout",
  cells: [
    { id: "cell-a", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-b", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-c", rowStart: 1, colStart: 0, rowSpan: 1, colSpan: 2 },
  ],
  colSizes: [50, 50],
  rowSizes: [50, 50],
};

function makeBlueprint(overrides?: Partial<LayoutBlueprintDescriptor>): LayoutBlueprintDescriptor {
  return {
    id: "test-blueprint",
    name: "Test Blueprint",
    description: "A test blueprint",
    recipeId: "test-recipe",
    layout: MOCK_LAYOUT,
    slots: [
      { cellId: "cell-a", widgetId: "analytics", purpose: "Traffic" },
      { cellId: "cell-b", widgetId: "revenue", purpose: "Revenue" },
      { cellId: "cell-c", widgetId: "seo", purpose: "SEO" },
    ],
    requiredIntegrations: ["github", "vercel"],
    personaAffinities: ["indie"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// applyBlueprint
// ---------------------------------------------------------------------------

describe("applyBlueprint", () => {
  it("assigns all slot widgets to their cells", () => {
    const result = applyBlueprint(makeBlueprint(), []);

    expect(result.widgetAssignments).toEqual({
      "cell-a": "analytics",
      "cell-b": "revenue",
      "cell-c": "seo",
    });
  });

  it("reports all cells as filled", () => {
    const result = applyBlueprint(makeBlueprint(), []);

    expect(result.filledCells).toEqual(["cell-a", "cell-b", "cell-c"]);
  });

  it("returns the blueprint layout as-is", () => {
    const blueprint = makeBlueprint();
    const result = applyBlueprint(blueprint, []);

    expect(result.layout).toBe(blueprint.layout);
  });

  it("has empty keptWidgets and skippedDuplicates", () => {
    const result = applyBlueprint(makeBlueprint(), []);

    expect(result.keptWidgets).toEqual([]);
    expect(result.skippedDuplicates).toEqual([]);
  });

  it("reports missing integrations when none are connected", () => {
    const result = applyBlueprint(makeBlueprint(), []);

    expect(result.missingIntegrations).toEqual(["github", "vercel"]);
  });

  it("reports only truly missing integrations", () => {
    const result = applyBlueprint(makeBlueprint(), ["github"]);

    expect(result.missingIntegrations).toEqual(["vercel"]);
  });

  it("reports no missing integrations when all are connected", () => {
    const result = applyBlueprint(makeBlueprint(), ["github", "vercel"]);

    expect(result.missingIntegrations).toEqual([]);
  });

  it("reports no missing integrations when blueprint requires none", () => {
    const result = applyBlueprint(makeBlueprint({ requiredIntegrations: [] }), []);

    expect(result.missingIntegrations).toEqual([]);
  });

  it("initializes cells without slots as null", () => {
    const layoutWithExtraCell: LayoutDefinition = {
      ...MOCK_LAYOUT,
      cells: [
        ...MOCK_LAYOUT.cells,
        { id: "cell-d", rowStart: 2, colStart: 0, rowSpan: 1, colSpan: 1 },
      ],
    };
    const result = applyBlueprint(makeBlueprint({ layout: layoutWithExtraCell }), []);

    expect(result.widgetAssignments["cell-d"]).toBeNull();
    expect(result.filledCells).not.toContain("cell-d");
  });

  it("handles blueprint with no slots (empty layout)", () => {
    const result = applyBlueprint(makeBlueprint({ slots: [] }), []);

    expect(result.widgetAssignments).toEqual({
      "cell-a": null,
      "cell-b": null,
      "cell-c": null,
    });
    expect(result.filledCells).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// smartMergeBlueprint
// ---------------------------------------------------------------------------

describe("smartMergeBlueprint", () => {
  it("fills empty cells with blueprint widgets", () => {
    const existing = { "cell-a": null, "cell-b": null, "cell-c": null };
    const result = smartMergeBlueprint(makeBlueprint(), existing, []);

    expect(result.widgetAssignments).toEqual({
      "cell-a": "analytics",
      "cell-b": "revenue",
      "cell-c": "seo",
    });
    expect(result.filledCells).toEqual(["cell-a", "cell-b", "cell-c"]);
  });

  it("preserves existing widgets in occupied cells", () => {
    const existing = {
      "cell-a": "custom-widget",
      "cell-b": null,
      "cell-c": null,
    };
    const result = smartMergeBlueprint(makeBlueprint(), existing, []);

    expect(result.widgetAssignments["cell-a"]).toBe("custom-widget");
    expect(result.keptWidgets).toContain("custom-widget");
  });

  it("fills only empty cells when some are occupied", () => {
    const existing = {
      "cell-a": "custom-widget",
      "cell-b": null,
      "cell-c": null,
    };
    const result = smartMergeBlueprint(makeBlueprint(), existing, []);

    expect(result.widgetAssignments["cell-b"]).toBe("revenue");
    expect(result.widgetAssignments["cell-c"]).toBe("seo");
    expect(result.filledCells).toEqual(["cell-b", "cell-c"]);
  });

  it("skips duplicate widgets already placed elsewhere", () => {
    // "analytics" is already in cell-a, so the blueprint's slot for cell-a
    // won't re-add it, but also if "revenue" were already placed somewhere,
    // it should be skipped
    const existing = {
      "cell-a": "analytics",
      "cell-b": "revenue",
      "cell-c": null,
    };
    const result = smartMergeBlueprint(makeBlueprint(), existing, []);

    // cell-a kept analytics, cell-b kept revenue
    expect(result.keptWidgets).toEqual(["analytics", "revenue"]);
    // cell-c should get seo (not a duplicate)
    expect(result.widgetAssignments["cell-c"]).toBe("seo");
    expect(result.filledCells).toEqual(["cell-c"]);
  });

  it("skips widget if already placed in a different cell", () => {
    // analytics is in cell-c (not its blueprint slot), and the blueprint
    // wants analytics in cell-a — should skip since it's already placed
    const existing = {
      "cell-a": null,
      "cell-b": null,
      "cell-c": "analytics",
    };
    const result = smartMergeBlueprint(makeBlueprint(), existing, []);

    // cell-a should NOT get analytics (it's already in cell-c)
    expect(result.widgetAssignments["cell-a"]).toBeNull();
    expect(result.skippedDuplicates).toContain("analytics");
    // cell-b should get revenue (not a duplicate)
    expect(result.widgetAssignments["cell-b"]).toBe("revenue");
  });

  it("reports missing integrations", () => {
    const existing = { "cell-a": null, "cell-b": null, "cell-c": null };
    const result = smartMergeBlueprint(makeBlueprint(), existing, ["github"]);

    expect(result.missingIntegrations).toEqual(["vercel"]);
  });

  it("handles all cells already occupied", () => {
    const existing = {
      "cell-a": "w1",
      "cell-b": "w2",
      "cell-c": "w3",
    };
    const result = smartMergeBlueprint(makeBlueprint(), existing, []);

    expect(result.keptWidgets).toEqual(["w1", "w2", "w3"]);
    expect(result.filledCells).toEqual([]);
    expect(result.widgetAssignments).toEqual(existing);
  });

  it("handles empty existing assignments object", () => {
    const result = smartMergeBlueprint(makeBlueprint(), {}, []);

    // All cells filled since no existing assignments
    expect(result.widgetAssignments).toEqual({
      "cell-a": "analytics",
      "cell-b": "revenue",
      "cell-c": "seo",
    });
    expect(result.filledCells).toEqual(["cell-a", "cell-b", "cell-c"]);
    expect(result.keptWidgets).toEqual([]);
  });

  it("preserves extra cells not in the blueprint slots", () => {
    const existing = {
      "cell-a": null,
      "cell-b": null,
      "cell-c": null,
      "cell-extra": "extra-widget",
    };
    const result = smartMergeBlueprint(makeBlueprint(), existing, []);

    expect(result.widgetAssignments["cell-extra"]).toBe("extra-widget");
  });

  it("does not assign a widget that was just filled to another cell", () => {
    // Blueprint: cell-a → analytics, cell-b → analytics (hypothetical duplicate slots)
    const blueprint = makeBlueprint({
      slots: [
        { cellId: "cell-a", widgetId: "analytics", purpose: "Traffic" },
        { cellId: "cell-b", widgetId: "analytics", purpose: "Traffic copy" },
        { cellId: "cell-c", widgetId: "seo", purpose: "SEO" },
      ],
    });
    const existing = { "cell-a": null, "cell-b": null, "cell-c": null };
    const result = smartMergeBlueprint(blueprint, existing, []);

    // analytics should only be placed once
    expect(result.widgetAssignments["cell-a"]).toBe("analytics");
    expect(result.widgetAssignments["cell-b"]).toBeNull();
    expect(result.skippedDuplicates).toContain("analytics");
  });
});

// ---------------------------------------------------------------------------
// Blueprint registry — uniform grid blueprints
// ---------------------------------------------------------------------------

describe("blueprint registry", () => {
  it("all blueprints have matching slot count to layout cells", async () => {
    const { LAYOUT_BLUEPRINTS } = await import("./registry");

    for (const blueprint of LAYOUT_BLUEPRINTS) {
      const cellIds = new Set(blueprint.layout.cells.map((c) => c.id));
      for (const slot of blueprint.slots) {
        expect(cellIds.has(slot.cellId)).toBe(true);
      }
      expect(blueprint.slots.length).toBe(blueprint.layout.cells.length);
    }
  });

  it("all blueprint slots reference a widget ID", async () => {
    const { LAYOUT_BLUEPRINTS } = await import("./registry");

    for (const blueprint of LAYOUT_BLUEPRINTS) {
      for (const slot of blueprint.slots) {
        expect(slot.widgetId.length).toBeGreaterThan(0);
      }
    }
  });

  it("all blueprints have at least one persona affinity", async () => {
    const { LAYOUT_BLUEPRINTS } = await import("./registry");

    for (const blueprint of LAYOUT_BLUEPRINTS) {
      expect(blueprint.personaAffinities.length).toBeGreaterThan(0);
    }
  });
});
