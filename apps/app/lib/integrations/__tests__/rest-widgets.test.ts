import type { SettingsRepository } from "@radarboard/types/database";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerUserIntegrationWidgets } from "../rest-widgets";

const TEST_IDS = ["rest-acme", "rest-beta"];
const clean = () => {
  for (const id of TEST_IDS) WIDGET_REGISTRY.delete(id);
};

beforeEach(clean);
afterEach(clean);

function repoWith(configs: unknown[]): SettingsRepository {
  return { getUserIntegrations: vi.fn(async () => configs) } as unknown as SettingsRepository;
}

describe("registerUserIntegrationWidgets", () => {
  it("registers a dedicated widget for every persisted user integration", async () => {
    const count = await registerUserIntegrationWidgets(
      repoWith([{ id: "acme", name: "Acme" }, { id: "beta" }])
    );
    expect(count).toBe(2);
    expect(WIDGET_REGISTRY.get("rest-acme")?.name).toBe("Acme");
    // Missing name falls back to the id.
    expect(WIDGET_REGISTRY.get("rest-beta")?.name).toBe("beta");
  });

  it("returns 0 and registers nothing when there are no integrations", async () => {
    const count = await registerUserIntegrationWidgets(repoWith([]));
    expect(count).toBe(0);
    expect(WIDGET_REGISTRY.has("rest-acme")).toBe(false);
  });
});
