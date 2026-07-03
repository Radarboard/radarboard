import { describe, expect, it } from "vitest";
import { DEMO_CONFIG } from "../registry";

describe("DEMO_CONFIG", () => {
  it("matches snapshot", () => {
    expect(DEMO_CONFIG).toMatchInlineSnapshot(`
      {
        "blueprintId": "indie-revenue-dashboard",
        "integrations": [
          "shipping",
        ],
        "plugins": [
          "tasks",
          "notes",
          "bookmarks",
        ],
        "profile": "indie",
        "showcaseLayout": {
          "cell-1": {
            "fallbackWidgetId": "seo",
            "widgetId": "seo",
          },
          "cell-2": {
            "fallbackWidgetId": "analytics",
            "widgetId": "analytics",
          },
          "cell-3": {
            "fallbackWidgetId": "revenue",
            "widgetId": "npm-downloads",
          },
          "cell-4": {
            "fallbackWidgetId": "observability",
            "widgetId": "app-reviews",
          },
          "cell-5": {
            "fallbackWidgetId": "bookmarks",
            "widgetId": "bookmarks",
          },
          "cell-6": {
            "fallbackWidgetId": "shipping",
            "widgetId": "shipping",
          },
          "cell-7": {
            "fallbackWidgetId": "sponsorship",
            "widgetId": "github-stars",
          },
          "cell-8": {
            "fallbackWidgetId": "roadmap",
            "widgetId": "vercel-domains",
          },
          "cell-9": {
            "fallbackWidgetId": "logs",
            "widgetId": "logs",
          },
        },
        "widgets": [
          "revenue",
          "analytics",
          "seo",
          "npm-downloads",
          "app-reviews",
          "bookmarks",
          "shipping",
          "github-stars",
          "vercel-domains",
          "observability",
          "roadmap",
          "sponsorship",
          "logs",
        ],
      }
    `);
  });

  it("has non-empty integration list", () => {
    expect(DEMO_CONFIG.integrations.length).toBeGreaterThan(0);
  });

  it("has non-empty widget list", () => {
    expect(DEMO_CONFIG.widgets.length).toBeGreaterThan(0);
  });

  it("has non-empty plugin list", () => {
    expect(DEMO_CONFIG.plugins.length).toBeGreaterThan(0);
  });

  it("blueprintId references a valid blueprint", async () => {
    const { LAYOUT_BLUEPRINTS } = await import("../../blueprints/registry");
    const match = LAYOUT_BLUEPRINTS.find((b) => b.id === DEMO_CONFIG.blueprintId);
    expect(match).toBeDefined();
  });

  it("demo index exports mock data for all key domains", async () => {
    const demo = await import("../index");
    const keys = Object.keys(demo);

    // Core mock data exports must be present
    const requiredExports = [
      "MOCK_REVENUE",
      "MOCK_SHIPPING",
      "MOCK_ROADMAP_PROJECTS",
      "MOCK_ANALYTICS",
      "MOCK_SEO",
      "MOCK_GITHUB_STARS",
      "MOCK_GITHUB_PULLS",
      "MOCK_GITHUB_COMMITS",
      "MOCK_VERCEL_DEPLOYMENTS",
      "MOCK_VERCEL_DOMAINS",
      "MOCK_HEALTH_CHECKS",
    ];

    for (const key of requiredExports) {
      expect(keys).toContain(key);
    }
  });
});
