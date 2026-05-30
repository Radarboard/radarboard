/**
 * GitHub Sponsors — Integration Descriptor
 *
 * Uses the same GitHub OAuth credentials as the `github` integration.
 * The token needs `read:user` scope for full sponsorship data;
 * the client falls back gracefully with just `repo` scope.
 */

import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { githubSponsorsDataSources } from "./api/data-sources";

export const githubSponsorsDescriptor: IntegrationDescriptor = {
  id: "github-sponsors",
  name: "GitHub Sponsors",
  description:
    "Sponsorship tiers, sponsor lists, monthly income, and goals via GitHub GraphQL API v4.",
  icon: Globe,
  category: "revenue",
  defaultStatusPageUrl: "https://www.githubstatus.com",
  apiDocsUrl: "https://docs.github.com/en/graphql",
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
      scopes: ["public_repo", "read:user"],
      normalizeOrigin: false,
      setupInstructions:
        "Create an OAuth App at github.com/settings/developers. Set the callback URL to: {origin}/api/auth/github/callback",
    },
  },
  capabilities: [{ id: "sponsorship", action: "data" }],
  dataSources: githubSponsorsDataSources,
};

export { githubSponsorsDataSources } from "./api/data-sources";
