/**
 * SEO Performance — Widget Descriptor
 */

import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";

import { isSeoTemplateConfig, SEO_TEMPLATE_CONFIG, SeoCompact } from "./components/seo-compact";
import { SeoExpanded } from "./components/seo-expanded";
import { SEO_OVERVIEW_CONFIG } from "./components/seo-overview-variant";

export const seoDescriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "seo",
  name: "SEO Performance",
  description: "Search queries, click trends, impressions, and ranking positions",
  catalogCategory: "analytics",
  capabilities: [
    {
      id: "seo",
      role: "canonical",
      providers: [{ integration: "google-search-console", action: "data" }],
    },
  ],
  requiredIntegrations: [],
  defaultSlot: "slot5",
  component: SeoCompact,
  expandedComponent: SeoExpanded,
  defaultConfig: SEO_TEMPLATE_CONFIG,
  variants: [
    { id: "queries", name: "Queries", config: SEO_TEMPLATE_CONFIG, isDefault: true },
    { id: "overview", name: "Overview", config: SEO_OVERVIEW_CONFIG },
  ],
  polling: { sourceIds: ["seo"] },
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) => (isSeoTemplateConfig(config) ? config : SEO_TEMPLATE_CONFIG),
    setConfig: ({ editorConfig }) => editorConfig as WidgetTemplateConfig,
  },
  auth: {
    id: "google-search-console",
    name: "Google Search Console",
    type: "oauth",
    fields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "" },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "" },
    ],
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    oauth: {
      provider: "google",
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
      setupInstructions:
        "Create OAuth credentials in Google Cloud Console. Enable the Search Console API. Set the callback URL to: {origin}/api/auth/google/callback",
    },
  },
};
export * from "./components/seo-query-diagnosis";
