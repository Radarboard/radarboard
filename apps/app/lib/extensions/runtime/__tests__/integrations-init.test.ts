import { findDataSource, getIntegration } from "@radarboard/integration-sdk/registry";
import { describe, expect, it } from "vitest";
import "@/lib/integrations-init";

describe("integrations init", () => {
  it("registers RevenueCat as a dashboard data provider", () => {
    expect(getIntegration("revenuecat")?.name).toBe("RevenueCat");
    expect(findDataSource("revenuecat", "data")).toBeDefined();
  });

  it("registers OpenPanel analytics data sources", () => {
    expect(findDataSource("openpanel", "data")).toBeDefined();
    expect(findDataSource("openpanel", "projects")).toBeDefined();
  });

  it("registers Google Search Console SEO data sources", () => {
    expect(findDataSource("google-search-console", "data")).toBeDefined();
    expect(findDataSource("google-search-console", "sites")).toBeDefined();
    expect(findDataSource("google-search-console", "query")).toBeDefined();
  });

  it("registers Linear roadmap data sources", () => {
    expect(findDataSource("linear", "roadmap")).toBeDefined();
  });
});
