import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";

import {
  COMMITS_TEMPLATE_CONFIG,
  CommitsCompact,
  isTemplateConfig,
} from "./components/commits-compact";
import { CommitsExpanded } from "./components/commits-expanded";

export const CommitsModule = CommitsCompact;

export const commitsDescriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "github-commits",
  name: "GitHub Commits",
  description: "Visualizes commit history over the past year like a GitHub profile calendar",
  catalogCategory: "development",
  requiredIntegrations: ["github"],
  defaultSlot: "slot7", // wide slot
  defaultPollInterval: 120_000,
  polling: { sourceIds: ["github-activity"] },
  component: CommitsCompact,
  expandedComponent: CommitsExpanded,
  defaultConfig: COMMITS_TEMPLATE_CONFIG,
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) => (isTemplateConfig(config) ? config : COMMITS_TEMPLATE_CONFIG),
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
      scopes: ["repo", "public_repo"],
      normalizeOrigin: false,
      setupInstructions:
        "Create an OAuth App at github.com/settings/developers. Set the callback URL to: {origin}/api/auth/github/callback",
    },
  },
};

export const githubCommitsDescriptor = commitsDescriptor;
