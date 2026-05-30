import { describe, expect, it } from "vitest";
import { integrationRoute, pluginRoute } from "./route-helpers";

describe("route helpers", () => {
  it("builds integration and plugin API routes", () => {
    expect(integrationRoute("github", "open-prs")).toBe("/api/integrations/github/open-prs");
    expect(pluginRoute("changelog", "state")).toBe("/api/plugins/changelog/state");
  });
});
