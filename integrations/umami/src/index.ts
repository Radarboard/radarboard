/**
 * Umami — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { umamiDataSources } from "./api/data-sources";

export const umamiDescriptor: IntegrationDescriptor = {
  id: "umami",
  name: "Umami",
  description: "Web analytics: pageviews, visitors, top pages, audience breakdown from Umami.",
  icon: Globe,
  category: "analytics",
  apiDocsUrl: "https://umami.is/docs/api",
  auth: {
    id: "umami",
    name: "Umami",
    type: "api_key",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        placeholder: "umami_...",
      },
      {
        key: "baseUrl",
        label: "Base URL",
        type: "text",
        placeholder: "https://cloud.umami.is",
      },
      {
        key: "websiteId",
        label: "Website ID",
        type: "text",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      },
    ],
    docsUrl: "https://umami.is/docs/api",
    testEndpoint: "/api/credentials/test",
  },
  dataSources: umamiDataSources,
};
