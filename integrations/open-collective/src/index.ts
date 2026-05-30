/**
 * Open Collective — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { openCollectiveDataSources } from "./api/data-sources";

export const openCollectiveDescriptor: IntegrationDescriptor = {
  id: "open-collective",
  name: "Open Collective",
  description:
    "Collective financial stats, transactions, and backer/member data via Open Collective GraphQL API v2.",
  icon: Globe,
  category: "revenue",
  apiDocsUrl: "https://docs.opencollective.com/help/contributing/development/api",
  auth: {
    id: "opencollective",
    name: "Open Collective",
    type: "api_key",
    fields: [
      {
        key: "apiToken",
        label: "Personal Token",
        type: "password",
        placeholder: "Enter your Open Collective personal token",
      },
    ],
    docsUrl: "https://documentation.opencollective.com/development/personel-tokens",
    testEndpoint: "/api/credentials/test",
  },
  capabilities: [{ id: "sponsorship", action: "data" }],
  dataSources: openCollectiveDataSources,
};

export { openCollectiveDataSources } from "./api/data-sources";
