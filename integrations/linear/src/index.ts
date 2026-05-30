/**
 * Linear — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { linearDataSources } from "./api/data-sources";
import { linearWebhookHandler } from "./events/webhook";

export const linearDescriptor: IntegrationDescriptor = {
  id: "linear",
  name: "Linear",
  description: "Issue tracking, project management, and sprint planning via Linear GraphQL API.",
  icon: Globe,
  category: "deployment",
  defaultStatusPageUrl: "https://linearstatus.com/",
  apiDocsUrl: "https://developers.linear.app/docs/graphql/working-with-the-graphql-api",
  auth: {
    id: "linear",
    name: "Linear",
    type: "api_key",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        placeholder: "lin_api_...",
      },
    ],
    docsUrl: "https://linear.app/settings/api",
    testEndpoint: "/api/credentials/test",
  },
  dataSources: linearDataSources,
  webhookHandler: linearWebhookHandler,
};
