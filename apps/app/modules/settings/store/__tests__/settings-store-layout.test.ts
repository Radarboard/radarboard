import { DEFAULT_THEME_FAMILY_ID, DEFAULT_THEME_MODE } from "@radarboard/themes";
import { AUTO_LOCALE } from "@radarboard/types/dashboard";
import { LAYOUT_RECIPES } from "@radarboard/widget-engine/layout-recipe-gallery";
import { BASIC_3X3 } from "@radarboard/widget-engine/layouts";
import { describe, expect, it } from "vitest";
import { createDefaultWidgetLayoutConfig, mergeWithDefaults } from "../settings-store-layout";

describe("settings-store-layout theme defaults", () => {
  it("includes theme defaults in the default widget layout config", () => {
    const config = createDefaultWidgetLayoutConfig();

    expect(config.appearance).toEqual({
      fontScale: "md",
      themeFamilyId: DEFAULT_THEME_FAMILY_ID,
      themeMode: DEFAULT_THEME_MODE,
    });
    expect(config.preferences?.locale).toBe(AUTO_LOCALE);
  });

  it("fills in missing theme fields when merging legacy appearance config", () => {
    const merged = mergeWithDefaults(
      {
        configs: {},
        projectLayouts: {},
        appearance: {
          fontScale: "lg",
        },
      },
      {}
    );

    expect(merged.appearance).toEqual({
      fontScale: "lg",
      themeFamilyId: DEFAULT_THEME_FAMILY_ID,
      themeMode: DEFAULT_THEME_MODE,
    });
  });

  it("includes only the default saved layout in the default widget layout config", () => {
    const config = createDefaultWidgetLayoutConfig();

    expect(config.layouts?.map((layout) => layout.id)).toEqual([BASIC_3X3.id]);
  });

  it("keeps only the default and custom saved layouts when merging older configs", () => {
    const merged = mergeWithDefaults(
      {
        configs: {},
        projectLayouts: {},
        layouts: [{ id: "custom-layout", name: "Custom Layout", cells: [] }],
      },
      {}
    );

    expect(merged.layouts?.map((layout) => layout.id)).toEqual([BASIC_3X3.id, "custom-layout"]);
  });

  it("drops unused canonical recipe layouts from persisted saved layouts", () => {
    const merged = mergeWithDefaults(
      {
        configs: {},
        projectLayouts: {
          all: {
            pages: [
              {
                name: "Overview",
                slug: "overview",
                layoutId: BASIC_3X3.id,
                widgetLayouts: {
                  [BASIC_3X3.id]: {},
                },
              },
            ],
          },
        },
        layouts: LAYOUT_RECIPES.map((recipe) => recipe.layout),
      },
      {}
    );

    expect(merged.layouts?.map((layout) => layout.id)).toEqual([BASIC_3X3.id]);
  });

  it("preserves recipe layouts that are actively referenced by a page", () => {
    const merged = mergeWithDefaults(
      {
        configs: {},
        projectLayouts: {
          all: {
            pages: [
              {
                name: "Overview",
                slug: "overview",
                layoutId: "rail-workbench",
                widgetLayouts: {
                  "rail-workbench": {},
                },
              },
            ],
          },
        },
        layouts: [],
      },
      {}
    );

    expect(merged.layouts?.map((layout) => layout.id)).toEqual([BASIC_3X3.id, "rail-workbench"]);
  });

  it("fills in a default locale when merging older preferences", () => {
    const merged = mergeWithDefaults(
      {
        configs: {},
        projectLayouts: {},
        preferences: { timezone: "America/Toronto" },
      },
      {}
    );

    expect(merged.preferences?.timezone).toBe("America/Toronto");
    expect(merged.preferences?.locale).toBe(AUTO_LOCALE);
  });
});
