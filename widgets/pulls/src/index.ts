/**
 * Pull Requests — Widget Descriptor
 */

import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";

import {
  GITHUB_ACTIVITY_TEMPLATE_CONFIG,
  GitHubActivityCompact,
  isTemplateConfig,
} from "./components/pulls-compact";
import { GitHubActivityExpanded } from "./components/pulls-expanded";

export const GitHubActivityModule = GitHubActivityCompact;
export const GitHubActivityModuleExpanded = GitHubActivityExpanded;

export const pullsDescriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "pulls",
  name: "Pull Requests",
  description: "Open pull requests and issues across connected GitHub repositories",
  catalogCategory: "development",
  requiredIntegrations: ["github"],
  defaultSlot: "slot7",
  defaultPollInterval: 120_000,
  polling: { sourceIds: ["github-activity"] },
  component: GitHubActivityCompact,
  expandedComponent: GitHubActivityExpanded,
  defaultConfig: GITHUB_ACTIVITY_TEMPLATE_CONFIG,
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) =>
      isTemplateConfig(config) ? config : GITHUB_ACTIVITY_TEMPLATE_CONFIG,
    setConfig: ({ editorConfig }) => editorConfig as WidgetTemplateConfig,
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
