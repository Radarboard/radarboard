/**
 * RevenueCat — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { revenuecatDataSources } from "./api/data-sources";
import { revenuecatMcpTools } from "./mcp/mcp-tools";

export const revenuecatDescriptor: IntegrationDescriptor = {
  id: "revenuecat",
  name: "RevenueCat",
  description:
    "Subscription analytics, MRR, revenue charts, and overview metrics via RevenueCat API v2.",
  icon: Globe,
  category: "revenue",
  defaultRssFeedUrl: "https://www.revenuecat.com/blog/rss.xml",
  apiDocsUrl: "https://www.revenuecat.com/docs/api-v2",
  auth: {
    id: "revenuecat",
    name: "RevenueCat",
    type: "api_key",
    fields: [
      { key: "apiKey", label: "API Secret Key", type: "password", placeholder: "appl_..." },
      { key: "projectId", label: "Project ID", type: "text", placeholder: "proj_..." },
    ],
    testEndpoint: "/api/credentials/test",
    docsUrl: "https://www.revenuecat.com/docs/authentication",
  },
  capabilities: [{ id: "revenue", action: "data" }],
  dataSources: revenuecatDataSources,
  mcpTools: revenuecatMcpTools,
};

export { revenuecatDataSources } from "./api/data-sources";
