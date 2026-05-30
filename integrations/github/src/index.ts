/**
 * GitHub — Integration Descriptor
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { githubDataSources } from "./api/data-sources";
import { githubWebhookHandler } from "./events/webhook";
import { githubMcpTools } from "./mcp/mcp-tools";

export const githubDescriptor: IntegrationDescriptor = {
  id: "github",
  name: "GitHub",
  description: "Repository activity, pull requests, issues, and releases via GitHub REST API v3.",
  icon: Globe,
  category: "deployment",
  defaultStatusPageUrl: "https://www.githubstatus.com",
  defaultRssFeedUrl: "https://github.blog/feed/",
  apiDocsUrl: "https://docs.github.com/en/rest",
  auth: {
    id: "github",
    name: "GitHub",
    type: "oauth",
    fields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "" },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "" },
    ],
    docsUrl: "https://github.com/settings/developers",
    oauth: {
      provider: "github",
      scopes: ["public_repo"],
      normalizeOrigin: false,
      setupInstructions:
        "Create an OAuth App at github.com/settings/developers.\nHomepage URL: {origin}\nAuthorization callback URL: {origin}/api/auth/github/callback",
    },
  },
  capabilities: [{ id: "stars", action: "stars" }],
  dataSources: githubDataSources,
  mcpTools: githubMcpTools,
  webhookHandler: githubWebhookHandler,
};
