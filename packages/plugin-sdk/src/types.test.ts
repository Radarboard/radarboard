import { describe, expect, it } from "vitest";
import {
  isPluginNotificationIntegrationEnabled,
  isPluginTickerIntegrationEnabled,
  type PluginDescriptor,
  type PluginUserConfig,
  pluginSupportsNotifications,
  pluginSupportsTicker,
} from "./types";

const BASE_PLUGIN: PluginDescriptor = {
  id: "status-page",
  name: "Status Page",
  description: "desc",
  icon: () => null,
  category: "monitoring",
  version: "0.1.0",
  launchSurfaces: ["palette"],
  presentation: "side-panel",
  component: () => null,
};

describe("plugin radarboard integration helpers", () => {
  it("returns false when a plugin does not declare radarboard integrations", () => {
    expect(pluginSupportsNotifications(BASE_PLUGIN)).toBe(false);
    expect(pluginSupportsTicker(BASE_PLUGIN)).toBe(false);
    expect(isPluginNotificationIntegrationEnabled(BASE_PLUGIN)).toBe(false);
    expect(isPluginTickerIntegrationEnabled(BASE_PLUGIN)).toBe(false);
  });

  it("uses descriptor defaults when no user override exists", () => {
    const plugin: PluginDescriptor = {
      ...BASE_PLUGIN,
      radarboardIntegrations: {
        notifications: { enabledByDefault: true },
        ticker: { enabledByDefault: false },
      },
    };

    expect(pluginSupportsNotifications(plugin)).toBe(true);
    expect(pluginSupportsTicker(plugin)).toBe(true);
    expect(isPluginNotificationIntegrationEnabled(plugin)).toBe(true);
    expect(isPluginTickerIntegrationEnabled(plugin)).toBe(false);
  });

  it("prefers user overrides over descriptor defaults", () => {
    const plugin: PluginDescriptor = {
      ...BASE_PLUGIN,
      radarboardIntegrations: {
        notifications: { enabledByDefault: true },
        ticker: { enabledByDefault: true },
      },
    };
    const config: PluginUserConfig = {
      notificationIntegrationEnabled: false,
      tickerIntegrationEnabled: false,
    };

    expect(isPluginNotificationIntegrationEnabled(plugin, config)).toBe(false);
    expect(isPluginTickerIntegrationEnabled(plugin, config)).toBe(false);
  });
});
