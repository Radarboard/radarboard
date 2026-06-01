import { describe, expect, it } from "vitest";
import {
  getBlueprintById,
  getBlueprintsForPersonas,
  LAYOUT_BLUEPRINTS,
  scoreBlueprintFit,
} from "./registry";

// ---------------------------------------------------------------------------
// LAYOUT_BLUEPRINTS catalog integrity
// ---------------------------------------------------------------------------

describe("LAYOUT_BLUEPRINTS catalog", () => {
  it("has at least 8 blueprints", () => {
    expect(LAYOUT_BLUEPRINTS.length).toBeGreaterThanOrEqual(8);
  });

  it("has unique IDs", () => {
    const ids = LAYOUT_BLUEPRINTS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every blueprint has a non-empty name and description", () => {
    for (const bp of LAYOUT_BLUEPRINTS) {
      expect(bp.name.length).toBeGreaterThan(0);
      expect(bp.description.length).toBeGreaterThan(0);
    }
  });

  it("every blueprint has at least one slot", () => {
    for (const bp of LAYOUT_BLUEPRINTS) {
      expect(bp.slots.length).toBeGreaterThan(0);
    }
  });

  it("every blueprint has at least one persona affinity", () => {
    for (const bp of LAYOUT_BLUEPRINTS) {
      expect(bp.personaAffinities.length).toBeGreaterThan(0);
    }
  });

  it("every slot references a cell that exists in the layout", () => {
    for (const bp of LAYOUT_BLUEPRINTS) {
      const cellIds = new Set(bp.layout.cells.map((c) => c.id));
      for (const slot of bp.slots) {
        expect(cellIds.has(slot.cellId)).toBe(true);
      }
    }
  });

  it("every slot has a non-empty widgetId and purpose", () => {
    for (const bp of LAYOUT_BLUEPRINTS) {
      for (const slot of bp.slots) {
        expect(slot.widgetId.length).toBeGreaterThan(0);
        expect(slot.purpose.length).toBeGreaterThan(0);
      }
    }
  });

  it("every blueprint layout has cells with valid positions", () => {
    for (const bp of LAYOUT_BLUEPRINTS) {
      for (const cell of bp.layout.cells) {
        expect(cell.rowStart).toBeGreaterThanOrEqual(0);
        expect(cell.colStart).toBeGreaterThanOrEqual(0);
        expect(cell.rowSpan).toBeGreaterThan(0);
        expect(cell.colSpan).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// getBlueprintById
// ---------------------------------------------------------------------------

describe("getBlueprintById", () => {
  it("finds a known blueprint", () => {
    const bp = getBlueprintById("oss-command-center");
    expect(bp).toBeDefined();
    expect(bp?.name).toBe("Open Source Command Center");
  });

  it("returns undefined for unknown ID", () => {
    expect(getBlueprintById("nonexistent")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(getBlueprintById("")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getBlueprintsForPersonas
// ---------------------------------------------------------------------------

describe("getBlueprintsForPersonas", () => {
  it("returns all blueprints when no personas given", () => {
    const result = getBlueprintsForPersonas([]);
    expect(result.length).toBe(LAYOUT_BLUEPRINTS.length);
  });

  it("filters to blueprints matching the persona", () => {
    const result = getBlueprintsForPersonas(["opensource"]);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((b) => b.personaAffinities.includes("opensource"))).toBe(true);
  });

  it("returns blueprints for multiple personas", () => {
    const result = getBlueprintsForPersonas(["seo", "marketing"]);
    expect(result.length).toBeGreaterThan(0);
    // Each result should match at least one of the given personas
    for (const bp of result) {
      const matches = bp.personaAffinities.some((p) => ["seo", "marketing"].includes(p));
      expect(matches).toBe(true);
    }
  });

  it("sorts by number of matching personas (descending)", () => {
    const result = getBlueprintsForPersonas(["seo", "marketing"]);
    // Blueprints matching both personas should come before those matching one
    for (let i = 1; i < result.length; i++) {
      const prevMatches = result[i - 1].personaAffinities.filter((p) =>
        ["seo", "marketing"].includes(p)
      ).length;
      const currMatches = result[i].personaAffinities.filter((p) =>
        ["seo", "marketing"].includes(p)
      ).length;
      expect(prevMatches).toBeGreaterThanOrEqual(currMatches);
    }
  });

  it("returns empty array for persona with no blueprints", () => {
    // "frontend" persona has no blueprint (none of the 8 target it)
    const result = getBlueprintsForPersonas(["frontend"]);
    expect(result.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// scoreBlueprintFit
// ---------------------------------------------------------------------------

describe("scoreBlueprintFit", () => {
  it("returns 0 when no personas match and integrations are missing", () => {
    const bp = getBlueprintById("oss-command-center")!;
    const score = scoreBlueprintFit(bp, {
      personas: ["frontend"],
      connectedIntegrations: [],
    });
    expect(score).toBe(0);
  });

  it("returns 1.0 when all personas match for a provider-neutral blueprint", () => {
    const bp = getBlueprintById("oss-command-center")!;
    const score = scoreBlueprintFit(bp, {
      personas: ["opensource"],
      connectedIntegrations: ["github", "npm"],
    });
    expect(score).toBe(1.0);
  });

  it("ignores connected integrations for provider-neutral blueprints", () => {
    const bp = getBlueprintById("oss-command-center")!;

    const personaOnly = scoreBlueprintFit(bp, {
      personas: ["opensource"],
      connectedIntegrations: [],
    });
    expect(personaOnly).toBe(1);

    const integrationOnly = scoreBlueprintFit(bp, {
      personas: ["frontend"],
      connectedIntegrations: ["github", "npm"],
    });
    expect(integrationOnly).toBe(0);
  });

  it("scores provider-neutral blueprints by persona coverage only", () => {
    const bp = getBlueprintById("oss-command-center")!;
    const score = scoreBlueprintFit(bp, {
      personas: ["opensource"],
      connectedIntegrations: ["github"],
    });
    expect(score).toBe(1);
  });

  it("scores blueprints with no requirements from persona fit", () => {
    const bp = getBlueprintById("seo-analytics-hub")!;
    expect(bp.requiredIntegrations).toEqual([]);

    const score = scoreBlueprintFit(bp, {
      personas: ["seo"],
      connectedIntegrations: [],
    });
    expect(score).toBeCloseTo(1 / 3, 5);
  });

  it("returns 0 for empty context", () => {
    const bp = getBlueprintById("oss-command-center")!;
    const score = scoreBlueprintFit(bp, {
      personas: [],
      connectedIntegrations: [],
    });
    expect(score).toBe(0);
  });
});
