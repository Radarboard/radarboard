import { runWidgetConformance } from "@radarboard/widget-engine/conformance";
import { describe, expect, it } from "vitest";
import { createRestWidgetDescriptor, genericRestDescriptor, restWidgetId } from ".";

runWidgetConformance([genericRestDescriptor, createRestWidgetDescriptor("acme", "Acme")]);

describe("createRestWidgetDescriptor", () => {
  it("builds a per-integration widget id + bakes in the integration binding", () => {
    const d = createRestWidgetDescriptor("acme", "Acme Analytics");
    expect(d.id).toBe(restWidgetId("acme"));
    expect(d.id).toBe("rest-acme");
    expect(d.name).toBe("Acme Analytics");
    expect((d.defaultConfig as { integrationId?: string }).integrationId).toBe("acme");
  });
});
