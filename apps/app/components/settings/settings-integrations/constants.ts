import type { IntegrationCategory } from "@radarboard/integration-sdk/types";
import type { NotificationPreset } from "@radarboard/types/notifications";
import type { IntegrationModalTab } from "./types";

export const INTEGRATION_CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  revenue: "Revenue & Monetization",
  deployment: "Development & Deployment",
  analytics: "Analytics & SEO",
  monitoring: "Monitoring",
  communication: "Communication",
};

/** Default display order for categories in the settings UI. */
export const CATEGORY_ORDER: IntegrationCategory[] = [
  "revenue",
  "deployment",
  "analytics",
  "monitoring",
  "communication",
];

export const SYSTEM_KEY = "@@system";
export const RELAY_PLATFORM = "relay";

export const WEBHOOK_SERVICE_CONFIG = {
  github: {
    label: "GitHub",
    docsUrl: "https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks",
    setupHint: "Repository Settings -> Webhooks",
    secretEnvVar: "WEBHOOK_SECRET_GITHUB",
  },
  vercel: {
    label: "Vercel",
    docsUrl: "https://vercel.com/docs/webhooks",
    setupHint: "Project Settings -> Webhooks",
    secretEnvVar: "WEBHOOK_SECRET_VERCEL",
  },
  sentry: {
    label: "Sentry",
    docsUrl: "https://docs.sentry.io/organization/integrations/integration-platform/webhooks/",
    setupHint: "Developer Settings -> Internal Integrations",
    secretEnvVar: "WEBHOOK_SECRET_SENTRY",
  },
  linear: {
    label: "Linear",
    docsUrl: "https://linear.app/developers/webhooks",
    setupHint: "Workspace Settings -> API -> Webhooks",
    secretEnvVar: "WEBHOOK_SECRET_LINEAR",
  },
  betterstack: {
    label: "BetterStack",
    docsUrl: "https://betterstack.com/docs/uptime/webhooks/",
    setupHint: "Integrations -> Webhooks",
    secretEnvVar: "WEBHOOK_SECRET_BETTERSTACK",
  },
} as const;

export type WebhookServiceId = keyof typeof WEBHOOK_SERVICE_CONFIG;
export const WEBHOOK_SERVICE_IDS = Object.keys(WEBHOOK_SERVICE_CONFIG) as WebhookServiceId[];

export const NOTIFICATION_PRESET_OPTIONS: Array<{ value: NotificationPreset; label: string }> = [
  { value: "all", label: "Everything" },
  { value: "critical_only", label: "Critical only" },
  { value: "deploys_and_errors", label: "Deploys & errors" },
  { value: "custom", label: "Custom" },
];

export const INTEGRATION_MODAL_TAB_META: Array<{ id: IntegrationModalTab; label: string }> = [
  { id: "access", label: "Access" },
  { id: "data", label: "Data" },
  { id: "events", label: "Events" },
];

export const GITHUB_STAR_TRACKING_COLLAPSE_THRESHOLD = 6;
export const GITHUB_STAR_TRACKING_VISIBLE_COUNT = 5;
