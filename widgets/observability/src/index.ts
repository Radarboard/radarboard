/**
 * Observability / Service Monitor — Widget Descriptor
 */

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";
import { OBSERVABILITY_CAPABILITIES, resolveObservabilityMode } from "./capabilities";

import {
  APP_STORE_DETAIL_TEMPLATE_CONFIG,
  APP_STORE_SUMMARY_CONFIG,
  DetailCompact,
  getDetailDescription,
  getDetailTitle,
  getResolvedAppStoreTemplateConfig,
  getResolvedHealthTemplateConfig,
  getResolvedSentryTemplateConfig,
  HEALTH_DETAIL_TEMPLATE_CONFIG,
  HEALTH_SUMMARY_CONFIG,
  SENTRY_DETAIL_TEMPLATE_CONFIG,
  SENTRY_SUMMARY_CONFIG,
} from "./components/observability-compact";
import { DetailExpanded } from "./components/observability-expanded";
import { useAppStore } from "./hooks/use-app-store";
import { useHealth } from "./hooks/use-health";
import { useSentry } from "./hooks/use-sentry";

export const observabilityDescriptor: WidgetDescriptor = {
  id: "observability",
  name: "Service Monitor",
  description: "Error tracking, uptime monitoring, app reviews, and service health",
  catalogCategory: "product",
  capabilities: OBSERVABILITY_CAPABILITIES,
  requiredIntegrations: [],
  defaultSlot: "slot6",
  component: DetailCompact,
  expandedComponent: DetailExpanded,
  defaultConfig: {
    sentryTemplateConfig: SENTRY_DETAIL_TEMPLATE_CONFIG,
    appStoreTemplateConfig: APP_STORE_DETAIL_TEMPLATE_CONFIG,
    healthTemplateConfig: HEALTH_DETAIL_TEMPLATE_CONFIG,
  },
  variants: [
    {
      id: "detail",
      name: "Detail",
      config: {
        sentryTemplateConfig: SENTRY_DETAIL_TEMPLATE_CONFIG,
        appStoreTemplateConfig: APP_STORE_DETAIL_TEMPLATE_CONFIG,
        healthTemplateConfig: HEALTH_DETAIL_TEMPLATE_CONFIG,
      },
      isDefault: true,
    },
    {
      id: "summary",
      name: "Summary",
      config: {
        sentryTemplateConfig: SENTRY_SUMMARY_CONFIG,
        appStoreTemplateConfig: APP_STORE_SUMMARY_CONFIG,
        healthTemplateConfig: HEALTH_SUMMARY_CONFIG,
      },
    },
  ],
  polling: {
    getSourceIds: ({ projectSlug, projects }) => {
      const mode = resolveObservabilityMode(projects, projectSlug);
      if (mode === "sentry") return ["sentry"];
      if (mode === "appstore") return ["app-store"];
      return ["health"];
    },
  },
  getDisplayName: ({ projectSlug, projects }) => getDetailTitle(projects, projectSlug),
  getDisplayDescription: ({ projectSlug, projects }) => getDetailDescription(projects, projectSlug),
  chrome: {
    hooks: {
      "app-store": useAppStore,
      health: useHealth,
      sentry: useSentry,
    },
  },
  visualEditor: {
    kind: "template",
    getConfig: ({ projectSlug, projects, config }) => {
      const mode = resolveObservabilityMode(projects, projectSlug);
      if (mode === "sentry") return getResolvedSentryTemplateConfig(config);
      if (mode === "appstore") return getResolvedAppStoreTemplateConfig(config);
      return getResolvedHealthTemplateConfig(config);
    },
    setConfig: ({ config, editorConfig, context }) => {
      const mode = resolveObservabilityMode(context.projects, context.projectSlug);
      const nextConfig = { ...config };
      if (mode === "sentry") {
        nextConfig.sentryTemplateConfig = editorConfig;
        return nextConfig;
      }
      if (mode === "appstore") {
        nextConfig.appStoreTemplateConfig = editorConfig;
        return nextConfig;
      }
      nextConfig.healthTemplateConfig = editorConfig;
      return nextConfig;
    },
  },
  auth: [
    {
      id: "sentry",
      name: "Sentry",
      type: "api_key",
      fields: [
        { key: "authToken", label: "Auth Token", type: "password", placeholder: "sntrys_..." },
        { key: "orgSlug", label: "Organization Slug", type: "text", placeholder: "my-org" },
      ],
      testEndpoint: API_ROUTES.credentialsTest,
      docsUrl: "https://docs.sentry.io/api/auth/",
    },
    {
      id: "app-store-connect",
      name: "App Store Connect",
      type: "api_key",
      fields: [
        { key: "keyId", label: "Key ID", type: "text", placeholder: "" },
        { key: "issuerId", label: "Issuer ID", type: "text", placeholder: "" },
        { key: "privateKey", label: "Private Key (.p8)", type: "file", accept: ".p8,.pem" },
      ],
      testEndpoint: API_ROUTES.credentialsTest,
      docsUrl:
        "https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api",
    },
    {
      id: "betterstack",
      name: "BetterStack",
      type: "api_key",
      fields: [{ key: "apiToken", label: "API Token", type: "password", placeholder: "" }],
      testEndpoint: API_ROUTES.credentialsTest,
      docsUrl: "https://betterstack.com/docs/uptime/api/getting-started-with-uptime-api/",
    },
  ],
};
export { useAppStore, useHealth, useSentry };
