import { describe, expect, it } from "vitest";
import { resolveDebugShellState } from "../index";

describe("resolveDebugShellState", () => {
  it("uses the query tab for root debug sections", () => {
    expect(resolveDebugShellState("/debug", "extension-health")).toMatchObject({
      activeId: "extension-health",
      docsHref: "https://docs.radarboard.app/developer-guide/debug/extension-health",
      label: "Extension Health",
      title: "Extension Health",
    });
  });

  it("falls back to extension health for unknown root debug tabs", () => {
    expect(resolveDebugShellState("/debug", "missing")).toMatchObject({
      activeId: "extension-health",
      docsHref: "https://docs.radarboard.app/developer-guide/debug/extension-health",
      label: "Extension Health",
      title: "Extension Health",
    });
  });

  it("uses standalone sandbox routes as active sidebar items", () => {
    expect(resolveDebugShellState("/debug/widget-sandbox", null)).toMatchObject({
      activeId: "widget-sandbox",
      docsHref: "https://docs.radarboard.app/developer-guide/debug/widget-sandbox",
      label: "Widget Sandbox",
      title: "Widget Sandbox",
    });
  });

  it("uses canonical docs pages instead of grouped page anchors", () => {
    for (const path of [
      ["/debug", "extension-health"],
      ["/debug", "traces"],
      ["/debug", "webhook-relay"],
      ["/debug/plugin-sandbox", null],
    ] as const) {
      expect(resolveDebugShellState(...path).docsHref).toMatch(
        /^https:\/\/docs\.radarboard\.app\/developer-guide\/debug\/[^#]+$/
      );
    }
  });
});
