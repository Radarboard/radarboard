/**
 * Vercel — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { vercelDataSources } from "./api/data-sources";
import { vercelWebhookHandler } from "./events/webhook";
import { vercelMcpTools } from "./mcp/mcp-tools";

export const vercelDescriptor: IntegrationDescriptor = {
  id: "vercel",
  name: "Vercel",
  description:
    "Deployment activity, project status, domain health, and build performance via Vercel REST API.",
  icon: Globe,
  category: "deployment",
  defaultStatusPageUrl: "https://www.vercel-status.com",
  defaultRssFeedUrl: "https://nextjs.org/feed.xml",
  apiDocsUrl: "https://vercel.com/docs/rest-api",
  auth: {
    id: "vercel",
    name: "Vercel",
    type: "api_key",
    fields: [
      { key: "token", label: "Access Token", type: "password" },
      {
        key: "teamId",
        label: "Team ID",
        type: "text",
        helpText: "Optional. Found in team settings.",
      },
    ],
    testEndpoint: "/api/credentials/test",
    docsUrl: "https://vercel.com/account/tokens",
  },
  capabilities: [{ id: "domains", action: "domains" }],
  dataSources: vercelDataSources,
  mcpTools: vercelMcpTools,
  webhookHandler: vercelWebhookHandler,
};
