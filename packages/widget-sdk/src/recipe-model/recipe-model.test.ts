import { describe, expect, it } from "vitest";
import type { WidgetTemplateConfig } from "../types";
import { inferTemplateRecipe, synchronizeTemplateConfig, TEMPLATE_CONFIG_VERSION } from "./";

describe("recipe model migration", () => {
  it("upgrades legacy template configs to the current version", () => {
    const legacy: WidgetTemplateConfig = {
      dataSources: [{ id: "analytics" }],
      sections: [
        {
          type: "headline-stat",
          source: { sourceId: "analytics", field: "liveVisitors", format: "number" },
          label: "live visitors",
        },
        {
          type: "list",
          source: { sourceId: "analytics", field: "topPages" },
          itemTemplate: {
            title: { sourceId: "analytics", field: "path" },
          },
        },
      ],
    };

    const normalized = synchronizeTemplateConfig(legacy);

    expect(normalized.version).toBe(TEMPLATE_CONFIG_VERSION);
    expect(normalized.recipe?.kind).toBe("summary_list");
    expect(inferTemplateRecipe(normalized.sections)?.kind).toBe("summary_list");
  });
});
