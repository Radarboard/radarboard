import type { Project } from "@radarboard/types/project";
import { describe, expect, it } from "vitest";
import { resolveRevenueProviderIntegrationId } from "./capabilities";

const PROJECTS: Project[] = [
  {
    id: "1",
    name: "Stripe Project",
    slug: "stripe-project",
    color: "#000",
    platforms: [{ id: "web", name: "Web", type: "web_app", integrations: { stripe: {} } }],
  },
  {
    id: "2",
    name: "Dual Revenue",
    slug: "dual-revenue",
    color: "#111",
    platforms: [
      {
        id: "web",
        name: "Web",
        type: "web_app",
        integrations: { stripe: {}, revenuecat: {} },
      },
    ],
  },
];

describe("resolveRevenueProviderIntegrationId", () => {
  it("selects the only connected provider for a project", () => {
    expect(resolveRevenueProviderIntegrationId(PROJECTS, "stripe-project")).toBe("stripe");
  });

  it("honors an explicit provider override when multiple providers are connected", () => {
    expect(resolveRevenueProviderIntegrationId(PROJECTS, "dual-revenue", "revenuecat")).toBe(
      "revenuecat"
    );
  });

  it("falls back to the first declared provider in all-project view", () => {
    expect(resolveRevenueProviderIntegrationId(PROJECTS, null)).toBe("revenuecat");
  });
});
