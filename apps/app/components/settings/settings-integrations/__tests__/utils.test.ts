import { describe, expect, it } from "vitest";
import type { ServiceEntry, WidgetRegistryDescriptor } from "../types";
import { collectServices, mergeWidgetAuthServices } from "../utils";

function widgetDescriptor(authId: string, widgetName = "Example Widget"): WidgetRegistryDescriptor {
  return {
    id: "example",
    name: widgetName,
    catalogCategory: "analytics",
    auth: {
      id: authId,
      name: authId,
      type: "api_key",
      fields: [{ key: "token", label: "Token", type: "password" }],
    },
  } as WidgetRegistryDescriptor;
}

function serviceEntry(credKey: string): ServiceEntry {
  return {
    credKey,
    auth: { id: credKey, name: credKey, type: "api_key", fields: [] },
    usedByWidgets: [],
    pollingSourceIds: [],
  };
}

describe("settings integrations service collection", () => {
  it("initializes widget descriptors before collecting the settings catalog", () => {
    const serviceIds = collectServices().map((service) => service.credKey);

    expect(serviceIds).toEqual(
      expect.arrayContaining(["github", "sentry", "revenuecat", "openpanel"])
    );
  });

  it("includes widget-only auth cards so settings shows every configurable provider", () => {
    const serviceMap = new Map<string, ServiceEntry>();

    mergeWidgetAuthServices(serviceMap, widgetDescriptor("sentry"));

    expect(serviceMap.get("sentry")?.usedByWidgets).toEqual(["Example Widget"]);
  });

  it("keeps app-shell virtual auth cards for providers with core data sources", () => {
    const serviceMap = new Map<string, ServiceEntry>();

    mergeWidgetAuthServices(serviceMap, widgetDescriptor("openpanel", "Analytics"));

    expect(serviceMap.get("openpanel")?.usedByWidgets).toEqual(["Analytics"]);
  });

  it("marks installed integration services as used by widgets", () => {
    const serviceMap = new Map<string, ServiceEntry>([["sentry", serviceEntry("sentry")]]);

    mergeWidgetAuthServices(serviceMap, widgetDescriptor("sentry", "Observability"));

    expect(serviceMap.get("sentry")?.usedByWidgets).toEqual(["Observability"]);
  });
});
