import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureRestWidgetRegistered, registerPlacedRestWidgets } from "../rest-widget-registry";

const TEST_WIDGET_IDS = ["rest-acme", "rest-beta"];

function cleanup() {
  for (const id of TEST_WIDGET_IDS) WIDGET_REGISTRY.delete(id);
}

beforeEach(cleanup);
afterEach(cleanup);

describe("ensureRestWidgetRegistered", () => {
  it("registers a per-integration widget once (idempotent)", () => {
    const id = ensureRestWidgetRegistered("acme", "Acme");
    expect(id).toBe("rest-acme");
    expect(WIDGET_REGISTRY.has("rest-acme")).toBe(true);
    expect(WIDGET_REGISTRY.get("rest-acme")?.name).toBe("Acme");
    // Second call is a no-op and doesn't throw.
    expect(() => ensureRestWidgetRegistered("acme", "Acme")).not.toThrow();
  });
});

describe("registerPlacedRestWidgets", () => {
  it("registers a widget for every placed rest-* config, ignoring others", () => {
    registerPlacedRestWidgets({
      "rest-acme": { integrationId: "acme", name: "Acme" },
      "rest-beta": { integrationId: "beta" },
      revenue: { dataSources: [] },
    });
    expect(WIDGET_REGISTRY.has("rest-acme")).toBe(true);
    expect(WIDGET_REGISTRY.has("rest-beta")).toBe(true);
    // Names come from the config when present, else default to the id.
    expect(WIDGET_REGISTRY.get("rest-acme")?.name).toBe("Acme");
    expect(WIDGET_REGISTRY.get("rest-beta")?.name).toBe("beta");
  });

  it("tolerates undefined configs", () => {
    expect(() => registerPlacedRestWidgets(undefined)).not.toThrow();
  });
});
