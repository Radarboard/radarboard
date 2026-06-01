import { findDataSource, getIntegration } from "@radarboard/integration-sdk/registry";
import { describe, expect, it } from "vitest";
import "@/lib/integrations-init";

describe("integrations init", () => {
  it("registers RevenueCat as a dashboard data provider", () => {
    expect(getIntegration("revenuecat")?.name).toBe("RevenueCat");
    expect(findDataSource("revenuecat", "data")).toBeDefined();
  });
});
