/**
 * Stars — Widget Descriptor
 */

import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";

import {
  GITHUB_STARS_TEMPLATE_CONFIG,
  GitHubStarsCompact,
  isTemplateConfig,
} from "./components/stars-compact";
import { GitHubStarsExpanded } from "./components/stars-expanded";
import type { GitHubStarsConfig } from "./types";

export const starsDescriptor: WidgetDescriptor<GitHubStarsConfig> = {
  id: "github-stars",
  name: "GitHub Stars",
  description: "Star counts, forks, and repository activity from GitHub",
  catalogCategory: "development",
  capabilities: [
    {
      id: "stars",
      role: "canonical",
      providers: [{ integration: "github", action: "stars" }],
    },
  ],
  requiredIntegrations: [],
  defaultSlot: "slot7",
  defaultPollInterval: 600_000,
  polling: { sourceIds: ["github-stars"] },
  component: GitHubStarsCompact,
  expandedComponent: GitHubStarsExpanded,
  defaultConfig: GITHUB_STARS_TEMPLATE_CONFIG,
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) => (isTemplateConfig(config) ? config : GITHUB_STARS_TEMPLATE_CONFIG),
    setConfig: ({ config, editorConfig }) => ({
      ...(editorConfig as WidgetTemplateConfig),
      selectedRepos: Array.isArray((config as GitHubStarsConfig).selectedRepos)
        ? (config as GitHubStarsConfig).selectedRepos
        : undefined,
    }),
  },
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
        "Create an OAuth App at github.com/settings/developers. Set the callback URL to: {origin}/api/auth/github/callback",
    },
  },
};

export const githubStarsDescriptor = starsDescriptor;
