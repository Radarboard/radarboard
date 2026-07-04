import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const registerPlacedRestWidgets = vi.fn();
vi.mock("@/lib/integrations/rest-widget-registry", () => ({
  registerPlacedRestWidgets: (c: unknown) => registerPlacedRestWidgets(c),
}));

import { loadSettings, resetSettingsStoreForTesting } from "../settings-store-actions";

beforeEach(() => {
  resetSettingsStoreForTesting();
  vi.clearAllMocks();
});

afterEach(() => vi.unstubAllGlobals());

describe("loadSettings → registerPlacedRestWidgets wiring", () => {
  it("registers placed rest-* widgets from the loaded layout so the dashboard can render them", async () => {
    const payload = {
      projectOrder: [],
      widgetLayout: {
        configs: { "rest-acme": { name: "Acme" }, revenue: {} },
      },
      projectIntegrations: {},
      featurePreferences: {},
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => payload }) as unknown as Response)
    );

    await loadSettings();

    expect(registerPlacedRestWidgets).toHaveBeenCalledTimes(1);
    const configs = registerPlacedRestWidgets.mock.calls[0][0] as Record<string, unknown>;
    expect(configs["rest-acme"]).toBeDefined();
  });
});
