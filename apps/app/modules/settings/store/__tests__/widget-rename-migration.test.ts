import { describe, expect, it } from "vitest";
import { mergeWithDefaults } from "../settings-store-layout";

describe("widget id rename migration", () => {
  it("migrates renamed widget ids in configs and layouts", () => {
    const merged = mergeWithDefaults(
      {
        configs: {
          stars: { selectedRepos: ["openai/openai"] },
          raindrop: { filter: "recent" },
          "review-pulse": { tab: "recent" },
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
                    "cell-1": "stars",
                    "cell-2": "raindrop",
                    "cell-3": "review-pulse",
                    "cell-4": "commits",
                    "cell-5": "domains",
                  },
                },
              },
            ],
          },
        },
      },
      {}
    );

    expect(merged.configs["github-stars"]).toBeDefined();
    expect(merged.configs.bookmarks).toBeDefined();
    expect(merged.configs["app-reviews"]).toBeDefined();

    const page = merged.projectLayouts?.all?.pages?.[0];
    const layout = page?.widgetLayouts?.["basic-3x3"];
    expect(layout?.["cell-1"]).toBe("github-stars");
    expect(layout?.["cell-2"]).toBe("bookmarks");
    expect(layout?.["cell-3"]).toBe("app-reviews");
    expect(layout?.["cell-4"]).toBe("github-commits");
    expect(layout?.["cell-5"]).toBe("vercel-domains");
  });
});
