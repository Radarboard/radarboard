import { describe, expect, it } from "vitest";
import { mergeWithDefaults } from "../settings-store-layout";

describe("widget id rename migration", () => {
  it("migrates renamed widget ids in configs and layouts", () => {
    const merged = mergeWithDefaults(
      {
        configs: {
          raindrop: { filter: "recent" },
        },
        projectLayouts: {
          all: {
            pages: [
              {
                name: "Overview",
                slug: "overview",
                layoutId: "basic-3x3",
                widgetLayouts: {
                  "basic-3x3": {
                    // raindrop -> bookmarks (rename target still registered)
                    "cell-1": "raindrop",
                    // removed widget id — must be left untouched, not migrated
                    // onto another non-existent id (renders as an empty slot).
                    "cell-2": "stars",
                  },
                },
              },
            ],
          },
        },
      },
      {}
    );

    expect(merged.configs.bookmarks).toBeDefined();

    const page = merged.projectLayouts?.all?.pages?.[0];
    const layout = page?.widgetLayouts?.["basic-3x3"];
    expect(layout?.["cell-1"]).toBe("bookmarks");
    expect(layout?.["cell-2"]).toBe("stars");
  });
});
