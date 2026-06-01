import { describe, expect, it } from "vitest";
import { resolveDebugShellState } from "../index";

describe("resolveDebugShellState", () => {
  it("uses the query tab for root debug sections", () => {
    expect(resolveDebugShellState("/debug", "extension-health")).toMatchObject({
      activeId: "extension-health",
      label: "Extension Health",
      title: "Extension Health",
    });
  });

  it("falls back to extension health for unknown root debug tabs", () => {
    expect(resolveDebugShellState("/debug", "missing")).toMatchObject({
      activeId: "extension-health",
      label: "Extension Health",
      title: "Extension Health",
    });
  });

  it("uses standalone sandbox routes as active sidebar items", () => {
    expect(resolveDebugShellState("/debug/widget-sandbox", null)).toMatchObject({
      activeId: "widget-sandbox",
      label: "Widget Sandbox",
      title: "Widget Sandbox",
    });
  });
});
