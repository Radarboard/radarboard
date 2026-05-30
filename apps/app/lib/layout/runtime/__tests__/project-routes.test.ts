import { describe, expect, it } from "vitest";
import { getDashboardHref, getDashboardPath, updateDashboardSearch } from "../project-routes";

describe("project routes", () => {
  it("maps the all-projects view to the root path", () => {
    expect(getDashboardPath(null)).toBe("/");
  });

  it("maps a project slug to a dedicated dashboard route", () => {
    expect(getDashboardPath("goshuin-atlas")).toBe("/projects/goshuin-atlas");
  });

  it("preserves existing query params when building a route href", () => {
    const searchParams = new URLSearchParams("chat=open&detail=seo:keyword");

    expect(getDashboardHref("goshuin-atlas", searchParams)).toBe(
      "/projects/goshuin-atlas?chat=open&detail=seo%3Akeyword"
    );
  });

  it("can replace the active page while clearing widget-specific query state", () => {
    expect(
      updateDashboardSearch("range=30d&detail=seo:keyword&expanded=analytics", { page: "ops" }, [
        "detail",
        "expanded",
        "widget-config",
      ])
    ).toBe("range=30d&page=ops");
  });

  it("can clear page state during project navigation while preserving general filters", () => {
    expect(
      updateDashboardSearch("range=7d&page=executive&detail=seo:keyword", {}, [
        "page",
        "detail",
        "expanded",
        "widget-config",
      ])
    ).toBe("range=7d");
  });
});
