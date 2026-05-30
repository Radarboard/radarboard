/**
 * Sentry — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { sentryDataSources } from "./api/data-sources";
import { sentryWebhookHandler } from "./events/webhook";
import { sentryMcpTools } from "./mcp/mcp-tools";

export const sentryDescriptor: IntegrationDescriptor = {
  id: "sentry",
  name: "Sentry",
  description: "Error tracking, issue monitoring, and project stats via Sentry REST API.",
  icon: Globe,
  category: "monitoring",
  defaultStatusPageUrl: "https://status.sentry.io",
  defaultRssFeedUrl: "https://blog.sentry.io/feed.xml",
  apiDocsUrl: "https://docs.sentry.io/api/",
  auth: {
    id: "sentry",
    name: "Sentry",
    type: "api_key",
    fields: [
      {
        key: "authToken",
        label: "Auth Token",
        type: "password",
        placeholder: "sntrys_…",
        helpText: "Create an auth token at Settings → Developer Settings → Auth Tokens.",
      },
      {
        key: "orgSlug",
        label: "Organization Slug",
        type: "text",
        placeholder: "my-org",
        helpText: "The slug of your Sentry organization (visible in the URL).",
      },
    ],
    docsUrl: "https://docs.sentry.io/api/auth/",
    testEndpoint: "/api/credentials/test",
  },
  capabilities: [{ id: "errors", action: "data" }],
  dataSources: sentryDataSources,
  mcpTools: sentryMcpTools,
  webhookHandler: sentryWebhookHandler,
};
