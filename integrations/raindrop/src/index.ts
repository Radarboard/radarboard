/**
 * Raindrop — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { raindropDataSources } from "./api/data-sources";

export const raindropDescriptor: IntegrationDescriptor = {
  id: "raindrop",
  name: "Raindrop",
  description: "Recent bookmarks, collections, and tag summaries from your Raindrop account.",
  icon: Globe,
  category: "analytics",
  apiDocsUrl: "https://developer.raindrop.io",
  mcp: {
    serverName: "raindrop",
    docsUrl: "https://www.npmjs.com/package/@adeze/raindrop-mcp",
    transport: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@adeze/raindrop-mcp@latest"],
    },
    credentialBindings: [
      {
        sourceField: "accessToken",
        target: { type: "env", key: "RAINDROP_ACCESS_TOKEN" },
      },
    ],
  },
  auth: {
    id: "raindrop",
    name: "Raindrop",
    type: "api_key",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        type: "password",
        placeholder: "Enter your Raindrop access token",
        helpText: "Use a Test token or an OAuth access token from the Raindrop app console.",
      },
    ],
    docsUrl: "https://developer.raindrop.io/v1/authentication/token",
    testEndpoint: "/api/credentials/test",
  },
  capabilities: [{ id: "bookmarks", action: "data" }],
  dataSources: raindropDataSources,
};

export { raindropDataSources } from "./api/data-sources";
