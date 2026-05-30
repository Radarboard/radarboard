/**
 * __INTEGRATION_NAME__ — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { __INTEGRATION_CAMEL__DataSources } from "./api/data-sources";

export const __INTEGRATION_CAMEL__Descriptor: IntegrationDescriptor = {
  id: "__INTEGRATION_KEBAB__",
  name: "__INTEGRATION_NAME__",
  description: "__INTEGRATION_NAME__ integration — configure after scaffolding.",
  icon: Globe,
  category: "deployment",
  apiDocsUrl: "https://example.com/api-reference",
  auth: {
    id: "__INTEGRATION_KEBAB__",
    name: "__INTEGRATION_NAME__",
    type: "api_key",
    fields: [{ key: "apiKey", label: "API Key", type: "password", placeholder: "" }],
    docsUrl: "https://example.com/docs",
    testEndpoint: "/api/credentials/test",
  },
  dataSources: __INTEGRATION_CAMEL__DataSources,
  screenshots: [],
  tier: "community",
  requiredCapabilities: ["network", "credentials"],
  configFlow: {
    steps: [
      {
        id: "credentials",
        title: "Enter API credentials",
        description: "Provide your __INTEGRATION_NAME__ API key to get started.",
        fields: [{ key: "apiKey", label: "API Key", type: "password", placeholder: "" }],
      },
    ],
  },
};
