/**
 * BetterStack — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { betterstackDataSources } from "./api/data-sources";
import { betterstackWebhookHandler } from "./events/webhook";
import { betterstackMcpTools } from "./mcp/mcp-tools";

export const betterstackDescriptor: IntegrationDescriptor = {
  id: "betterstack",
  name: "BetterStack",
  description: "Uptime monitoring, incident tracking, and heartbeat checks via BetterStack API.",
  icon: Globe,
  category: "monitoring",
  apiDocsUrl: "https://betterstack.com/docs/uptime/api/getting-started-with-uptime-api/",
  auth: {
    id: "betterstack",
    name: "BetterStack",
    type: "api_key",
    fields: [
      {
        key: "apiToken",
        label: "API Token",
        type: "password",
        placeholder: "Enter your BetterStack API token",
        helpText: "Create an API token at https://betterstack.com/docs/uptime/api/",
      },
    ],
    docsUrl: "https://betterstack.com/docs/uptime/api/",
    testEndpoint: "/api/credentials/test",
  },
  capabilities: [{ id: "uptime", action: "data" }],
  dataSources: betterstackDataSources,
  mcpTools: betterstackMcpTools,
  webhookHandler: betterstackWebhookHandler,
};

export { betterstackDataSources } from "./api/data-sources";
