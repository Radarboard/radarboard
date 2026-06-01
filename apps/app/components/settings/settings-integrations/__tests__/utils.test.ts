import { describe, expect, it } from "vitest";
import type { ServiceEntry, WidgetRegistryDescriptor } from "../types";
import { mergeWidgetAuthServices } from "../utils";

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
  it("skips widget-only auth cards when no integration route backs the provider", () => {
    const serviceMap = new Map<string, ServiceEntry>();

    mergeWidgetAuthServices(serviceMap, widgetDescriptor("sentry"));

    expect(serviceMap.has("sentry")).toBe(false);
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
