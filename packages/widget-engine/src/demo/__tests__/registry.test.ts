import { describe, expect, it } from "vitest";
import { DEMO_CONFIG } from "../registry";

describe("DEMO_CONFIG", () => {
  it("matches snapshot", () => {
    expect(DEMO_CONFIG).toMatchInlineSnapshot(`
      {
        "blueprintId": "indie-revenue-dashboard",
        "integrations": [
          "github",
          "vercel",
          "stripe",
          "openpanel",
          "sentry",
        ],
        "plugins": [
          "tasks",
          "notes",
          "bookmarks",
          "rss-reader",
          "changelog",
          "status-page",
        ],
        "profile": "indie",
        "widgets": [
          "revenue",
          "shipping",
          "roadmap",
          "analytics",
          "seo",
          "github-stars",
          "pulls",
          "github-commits",
          "deployments",
          "vercel-domains",
          "observability",
          "npm-downloads",
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
