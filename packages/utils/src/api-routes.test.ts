import { describe, expect, it } from "vitest";
import { integrationRoute, pluginRoute } from "./api-routes";

describe("api routes", () => {
  it("builds integration and plugin endpoints from identifiers", () => {
    expect(integrationRoute("revenuecat", "data")).toBe("/api/integrations/revenuecat/data");
    expect(pluginRoute("changelog", "state")).toBe("/api/plugins/changelog/state");
  });
});
