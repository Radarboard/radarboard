/**
 * OpenPanel — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { openpanelDataSources } from "./api/data-sources";
import { openpanelMcpTools } from "./mcp/mcp-tools";

export const openpanelDescriptor: IntegrationDescriptor = {
  id: "openpanel",
  name: "OpenPanel",
  description: "Web analytics with real-time visitors, page views, referrers, and geo breakdown.",
  icon: Globe,
  category: "analytics",
  defaultStatusPageUrl: "https://status.openpanel.dev/",
  apiDocsUrl: "https://docs.openpanel.dev/docs/api",
  auth: {
    id: "openpanel",
    name: "OpenPanel",
    type: "api_key",
    fields: [
      {
        key: "clientId",
        label: "Client ID",
        type: "text",
        placeholder: "",
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        placeholder: "",
      },
    ],
    docsUrl: "https://docs.openpanel.dev/docs/api",
    testEndpoint: "/api/credentials/test",
  },
  capabilities: [{ id: "analytics", action: "data" }],
  dataSources: openpanelDataSources,
  mcpTools: openpanelMcpTools,
};

export { openpanelDataSources } from "./api/data-sources";
