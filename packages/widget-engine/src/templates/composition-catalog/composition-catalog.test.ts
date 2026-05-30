import { describe, expect, it } from "vitest";
import { synchronizeTemplateConfig, TEMPLATE_CONFIG_VERSION } from "../recipe-model";
import {
  COMPOSITION_ANTI_PATTERNS,
  COMPOSITION_EXAMPLES,
  LAYOUT_NODE_CATALOG,
  PRIMITIVE_EXAMPLES,
  RECIPE_CATALOG,
  SECTION_PRIMITIVE_CATALOG,
} from "./";

describe("composition catalog", () => {
  it("documents every canonical recipe", () => {
    expect(RECIPE_CATALOG.map((recipe) => recipe.kind)).toEqual([
      "summary_only",
      "content_only",
      "summary_content",
      "summary_list",
      "summary_chart_list",
      "rail_content",
      "rail_list",
    ]);
  });

  it("covers all supported layout nodes", () => {
    expect(LAYOUT_NODE_CATALOG.map((node) => node.kind)).toEqual([
      "stack",
      "grid",
      "tabs",
      "split",
    ]);
  });

  it("contains example configs that normalize to the current template version", () => {
    for (const example of COMPOSITION_EXAMPLES) {
      const normalized = synchronizeTemplateConfig(example.config);
      expect(normalized.version).toBe(TEMPLATE_CONFIG_VERSION);
      expect(normalized.recipe?.kind).toBe(example.recipeKind);
    }
  });

  it("documents shipped primitives and example primitives", () => {
    expect(SECTION_PRIMITIVE_CATALOG.some((primitive) => primitive.kind === "overview-panel")).toBe(
      true
    );
    expect(SECTION_PRIMITIVE_CATALOG.some((primitive) => primitive.kind === "card-list")).toBe(
      true
    );
    expect(PRIMITIVE_EXAMPLES["card-list"].type).toBe("card-list");
    expect(COMPOSITION_ANTI_PATTERNS.length).toBeGreaterThan(0);
  });
});
