import type { PluginDescriptor } from "@radarboard/plugin-sdk/types";
import { Webhook } from "lucide-react";
import { WebhookRelayOverlay } from "./components/webhook-relay-overlay";
import { webhookRelayMcpTools } from "./mcp-tools";

export const webhookRelayDescriptor: PluginDescriptor = {
  id: "webhook-relay",
  name: "Webhook Relay",
  description: "Monitor and analyze inbound webhooks from connected services",
  icon: Webhook,
  category: "monitoring",
  version: "0.1.0",

  launchSurfaces: ["palette", "topbar", "dock"],
  presentation: { default: "side-panel", alternates: ["fullscreen"], size: "md" },
  shortcut: "Mod+Shift+W",

  component: WebhookRelayOverlay,

  mcpTools: webhookRelayMcpTools,

  radarboardIntegrations: {
    notifications: {
      enabledByDefault: true,
    },
    ticker: {
      enabledByDefault: true,
    },
  },

  settings: [
    {
      key: "max-events",
      label: "Max Stored Events",
      description: "Maximum number of webhook events to keep in the plugin buffer",
      type: "number",
      defaultValue: 200,
    },
    {
      key: "show-info-events",
      label: "Show Info Events",
      description:
        "Include info-level events in the widget (disable to show only warnings and critical)",
      type: "boolean",
      defaultValue: true,
    },
  ],
};
