/**
 * Slack — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";

export const slackDescriptor: IntegrationDescriptor = {
  id: "slack",
  name: "Slack",
  description: "Send notifications and messages to Slack channels via incoming webhooks.",
  icon: Globe,
  category: "communication",
  apiDocsUrl: "https://api.slack.com/methods",
  auth: {
    id: "slack",
    name: "Slack",
    type: "api_key",
    fields: [
      {
        key: "webhookUrl",
        label: "Incoming Webhook URL",
        type: "password",
        placeholder: "https://hooks.slack.com/services/...",
      },
    ],
    docsUrl: "https://api.slack.com/messaging/webhooks",
    testEndpoint: "/api/credentials/test",
  },
  dataSources: [],
};
