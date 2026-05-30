import type {
  IntegrationConfigFlow,
  IntegrationMcpConnectionConfig,
} from "@radarboard/integration-sdk/types";
import type { McpSecretValue } from "@radarboard/types/mcp-server";
import type { PlatformIntegrations } from "@radarboard/types/project";
import type { WIDGET_REGISTRY, WidgetAuth } from "@radarboard/widget-engine/widgets/registry";

export interface ServiceEntry {
  credKey: string;
  auth: WidgetAuth;
  usedByWidgets: string[];
  pollingSourceIds: string[];
  /** Category from IntegrationDescriptor (if available). */
  category?: string;
  defaultRssFeedUrl?: string;
  defaultStatusPageUrl?: string;
  integrationKey?: keyof PlatformIntegrations;
  /** The descriptor id used as the INTEGRATION_REGISTRY key. */
  descriptorId?: string;
  /** Human-readable description shown on onboarding cards. */
  description?: string;
  mcpConfig?: IntegrationMcpConnectionConfig;
  /** Guided setup flow from the integration descriptor. */
  configFlow?: IntegrationConfigFlow;
}

export interface ServiceCategory {
  id: string;
  label: string;
  serviceIds: string[];
}

export type WidgetRegistryDescriptor =
  typeof WIDGET_REGISTRY extends Map<string, infer V> ? V : never;

export type McpConnectionTestPayload =
  | { type?: "streamable-http"; url: string; authHeader?: McpSecretValue }
  | {
      type: "stdio";
      command: string;
      args?: string[];
      env?: Record<string, McpSecretValue>;
      cwd?: string;
    };

export interface McpConnectionTestResult {
  ok: boolean;
  error?: string;
  serverName?: string;
  serverVersion?: string;
  protocolVersion?: string;
}

export type IntegrationModalTab = "access" | "data" | "events";

export type LinkedMcpDraft =
  | {
      type: "stdio";
      enabled: boolean;
      command: string;
      argsText: string;
      cwd: string;
      envText: string;
      docsUrl: string;
    }
  | {
      type: "streamable-http";
      enabled: boolean;
      url: string;
      authHeader: string;
      docsUrl: string;
    };

export type { WebhookServiceId } from "./constants";

export interface GitHubStarTrackingRepoState {
  repoKey: string;
  fullName: string;
  trackingStartedAt: number | null;
  baselineStars: number | null;
  lastWebhookAt: number | null;
  tracked: boolean;
}
