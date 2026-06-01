import { describe, expect, it } from "vitest";
import {
  canPlaceWidgetInScope,
  filterWidgetsForDashboardScope,
  getWidgetSupportedScopes,
} from "./dashboard-scope";
import type { WidgetDescriptor } from "./widget-types";

function makeDescriptor(
  supportedDashboardScopes?: WidgetDescriptor["supportedDashboardScopes"]
): Pick<WidgetDescriptor, "id" | "supportedDashboardScopes"> {
  return { id: supportedDashboardScopes?.join("-") ?? "default", supportedDashboardScopes };
}

describe("dashboard scope helpers", () => {
  it("defaults widgets to both dashboard scopes", () => {
    expect(getWidgetSupportedScopes(makeDescriptor())).toEqual(["all-projects", "project"]);
  });

  it("allows project-only widgets on projects and blocks them on All Projects", () => {
    const descriptor = makeDescriptor(["project"]);

    expect(canPlaceWidgetInScope(descriptor, "project")).toBe(true);
    expect(canPlaceWidgetInScope(descriptor, "all-projects")).toBe(false);
  });

  it("allows aggregate-only widgets on All Projects and blocks them on projects", () => {
    const descriptor = makeDescriptor(["all-projects"]);

    expect(canPlaceWidgetInScope(descriptor, "all-projects")).toBe(true);
    expect(canPlaceWidgetInScope(descriptor, "project")).toBe(false);
  });

  it("filters widgets for the target dashboard scope", () => {
    const both = makeDescriptor();
    const projectOnly = makeDescriptor(["project"]);
    const aggregateOnly = makeDescriptor(["all-projects"]);

    expect(
      filterWidgetsForDashboardScope([both, projectOnly, aggregateOnly], "all-projects")
    ).toEqual([both, aggregateOnly]);
    expect(filterWidgetsForDashboardScope([both, projectOnly, aggregateOnly], "project")).toEqual([
      both,
      projectOnly,
    ]);
  });
});
