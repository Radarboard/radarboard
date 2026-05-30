/**
 * Google Search Console — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { gscDataSources } from "./api/data-sources";

export const googleSearchConsoleDescriptor: IntegrationDescriptor = {
  id: "google-search-console",
  name: "Google Search Console",
  description:
    "Search queries, click trends, impressions, and ranking positions via the Search Console API v1.",
  icon: Globe,
  category: "analytics",
  apiDocsUrl: "https://developers.google.com/webmaster-tools/v1/api_reference_index",
  auth: {
    id: "google-search-console",
    name: "Google Search Console",
    type: "oauth",
    fields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "" },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "" },
    ],
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    oauth: {
      provider: "google",
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
      setupInstructions:
        "Create OAuth credentials in Google Cloud Console. Enable the Search Console API. Set the callback URL to: {origin}/api/auth/google/callback",
    },
  },
  capabilities: [{ id: "seo", action: "data" }],
  dataSources: gscDataSources,
};

export { gscDataSources } from "./api/data-sources";
