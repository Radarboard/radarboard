import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";
import { describe, expect, it, vi } from "vitest";
import {
  auditCapabilityGovernance,
  formatCapabilityLabel,
  getCanonicalWidgetMap,
  getCapabilityProvidingWidgets,
} from "../capability-governance";

const Icon = () => null;
const Component = () => null;

function makeIntegration(overrides: Partial<IntegrationDescriptor>): IntegrationDescriptor {
  return {
    id: "test-integration",
    name: "Test Integration",
    description: "Test integration",
    icon: Icon,
    category: "analytics",
    auth: { id: "test", name: "Test", type: "none" },
    dataSources: [
      {
        action: "data",
        description: "Test data source",
        cacheTtlSeconds: 60,
        fetch: vi.fn(async () => ({})),
      },
    ],
    ...overrides,
  };
}

function makeWidget(overrides: Partial<WidgetDescriptor>): WidgetDescriptor {
  return {
    id: "test-widget",
    name: "Test Widget",
    description: "Test widget",
    requiredIntegrations: [],
    defaultSlot: "slot1",
    component: Component,
    defaultConfig: {},
    ...overrides,
  };
}

describe("capability governance", () => {
  it("maps canonical widgets by capability", () => {
    const widget = makeWidget({
      id: "revenue",
      capabilities: [
        {
          id: "revenue",
          role: "canonical",
          providers: [{ integration: "revenuecat", action: "data" }],
        },
      ],
    });

    const canonical = getCanonicalWidgetMap([widget]);
    expect(canonical.get("revenue")?.widget.id).toBe("revenue");
  });

  it("flags missing canonical widget coverage", () => {
    const integration = makeIntegration({
      id: "stripe",
      capabilities: [{ id: "revenue", action: "data" }],
    });

    const audits = auditCapabilityGovernance([integration], []);
    expect(audits.some((audit) => audit.code === "missing-canonical-widget")).toBe(true);
  });

  it("finds configured providers for canonical widgets", () => {
    const widget = makeWidget({
      id: "revenue",
      capabilities: [
        {
          id: "revenue",
          role: "canonical",
          providers: [
            { integration: "revenuecat", action: "data" },
            { integration: "stripe", action: "data" },
          ],
        },
      ],
    });

    const matches = getCapabilityProvidingWidgets(widget, new Set(["stripe"]));
    expect(matches).toHaveLength(1);
    expect(matches[0]?.providers).toEqual([{ integration: "stripe", action: "data" }]);
  });

  it("formats capability labels for route copy", () => {
    expect(formatCapabilityLabel("app-reviews")).toBe("App Reviews");
  });
});
