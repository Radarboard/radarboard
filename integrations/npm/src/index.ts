/**
 * npm — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Package } from "lucide-react";
import { npmDataSources } from "./api/data-sources";
import { npmMcpTools } from "./mcp/mcp-tools";

export const npmDescriptor: IntegrationDescriptor = {
  id: "npm",
  name: "npm",
  description: "Use an explicit npm package list for download-based widgets.",
  icon: Package,
  category: "analytics",
  defaultStatusPageUrl: "https://status.npmjs.org/",
  apiDocsUrl: "https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md",
  auth: {
    id: "npm",
    name: "npm",
    type: "api_key",
    fields: [
      {
        key: "extraPackages",
        label: "Packages",
        type: "textarea",
        placeholder: "package-one\npackage-two",
        helpText: "Required. Add packages explicitly, one per line or comma-separated.",
      },
    ],
    docsUrl: "https://docs.npmjs.com/cli/v11/using-npm/package-spec",
    testEndpoint: "/api/credentials/test",
  },
  capabilities: [{ id: "downloads", action: "data" }],
  dataSources: npmDataSources,
  mcpTools: npmMcpTools,
};

export { npmDataSources } from "./api/data-sources";
