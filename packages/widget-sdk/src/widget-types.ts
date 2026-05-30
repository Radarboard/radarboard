import type { TimeRange } from "@radarboard/types/dashboard";
import type { ExtensionMeta, WidgetCapability } from "@radarboard/types/extension";
import type { PollingSourceId } from "@radarboard/types/polling";
import type { PlatformIntegrations, Project } from "@radarboard/types/project";
import type { ComponentType } from "react";

/** Size of the expanded widget overlay: "sm", "md", or "lg". */
export type WidgetModalSize = import("@radarboard/types/database").WidgetModalSize;

/** The 9 content grid slots (3x3). Chrome widgets (TopBar, Tabs, KPIs, Ticker) are not slotted. */
export type GridSlot =
  | "slot1"
  | "slot2"
  | "slot3"
  | "slot4"
  | "slot5"
  | "slot6"
  | "slot7"
  | "slot8"
  | "slot9";

/** Controls which header utility actions are available in the compact widget cell. */
export type WidgetChromeStatus = "default" | "disconnected";

/** Props every widget module component receives. */
export interface WidgetRenderProps<TConfig = Record<string, unknown>> {
  /** Widget registry identifier for observability and debug events. */
  widgetId?: string;
  /** Active project filter. null = "All" projects. */
  projectSlug: string | null;
  /** Active dashboard time range. */
  timeRange?: TimeRange;
  /** Per-instance configuration. */
  config: TConfig;
  /** Externally controlled selected detail item ID (for URL state). */
  selectedDetailId?: string | null;
  /** Called when the selected detail changes (for URL state sync). */
  onSelectedDetailIdChange?: (id: string | null) => void;
  /**
   * Called by the widget to report its current data-fetch timestamp (unix seconds).
   * WidgetSlot forwards this to WidgetCard for display in the header.
   */
  onFetchedAt?: (fetchedAt: number | null) => void;
  /**
   * Called by the widget to register its refetch function.
   * WidgetSlot forwards this to WidgetCard as the refresh button handler.
   */
  onRefetch?: (refetch: (() => Promise<void>) | null) => void;
  /**
   * Called by the widget to control compact-cell utility actions.
   * Use "disconnected" when the widget is showing an explicit not-connected state.
   */
  onChromeStateChange?: (status: WidgetChromeStatus) => void;
  /** The currently active variant id, resolved from instance config. */
  activeVariantId?: string;
  /** Open Settings → Integrations for a specific service. */
  onConnectService?: (serviceId: string) => void;
}

/** OAuth-specific config for providers that need the redirect flow. */
export interface WidgetOAuthConfig {
  /** Provider key used in route paths (e.g., "github", "google"). */
  provider: string;
  /** Scopes to request during authorization. */
  scopes: string[];
  /** Instructions for creating the OAuth app, shown above client credential fields. Use {origin} as placeholder. */
  setupInstructions?: string;
  /**
   * Whether to normalize *.localhost subdomains to plain localhost when building the callback URL
   * shown in setup instructions. Set true for Google (rejects custom subdomains), false/omit for
   * GitHub (accepts *.localhost as-is).
   */
  normalizeOrigin?: boolean;
}

/** How a widget authenticates with its external API. */
export interface WidgetAuth {
  /** Unique service identifier (required when a widget connects to multiple services). */
  id?: string;
  /** Display name for this service (e.g., "Vercel", "Linear"). */
  name?: string;
  /** Short description of this service shown on onboarding cards. */
  description?: string;
  /** Auth method: "api_key" = manual token entry, "oauth" = OAuth redirect flow, "none" = no auth. */
  type: "api_key" | "oauth" | "none";
  /** For api_key and oauth: fields to show in the credential input UI (client ID/secret for OAuth). */
  fields?: WidgetAuthField[];
  /** API route path to test credentials (POST with { key, values }). */
  testEndpoint?: string;
  /** URL to the service's docs for obtaining credentials. */
  docsUrl?: string;
  /** OAuth-specific config. Required when type === "oauth". */
  oauth?: WidgetOAuthConfig;
}

/** A single credential input field in the widget card's Connection section. */
export interface WidgetAuthField {
  /** Storage key within the credential record (e.g., "authToken"). */
  key: string;
  /** Display label (e.g., "Auth Token"). */
  label: string;
  /** Whether the field is optional in the generic save/test UI. */
  optional?: boolean;
  /** "password" = masked, "text" = visible, "textarea" = multi-line, "file" = file upload. */
  type: "text" | "password" | "textarea" | "file";
  /** Placeholder text. */
  placeholder?: string;
  /** Help text below the input. */
  helpText?: string;
  /** Accepted file extensions for type "file" (e.g., ".p8,.pem"). */
  accept?: string;
}

/** Context passed to dynamic widget functions like getDisplayName and getSourceIds. */
export interface WidgetDisplayContext<TConfig = Record<string, unknown>> {
  projectSlug: string | null;
  projects: Project[];
  config: TConfig;
}

export interface WidgetPollingConfig<TConfig = Record<string, unknown>> {
  sourceIds?: PollingSourceId[];
  getSourceIds?: (context: WidgetDisplayContext<TConfig>) => PollingSourceId[];
}

export interface WidgetTemplateVisualEditorBinding<TConfig = Record<string, unknown>> {
  kind: "template";
  getConfig: (context: WidgetDisplayContext<TConfig>) => unknown | null;
  setConfig: (args: {
    config: TConfig;
    editorConfig: unknown;
    context: WidgetDisplayContext<TConfig>;
  }) => TConfig;
}

export type WidgetVisualEditorBinding<TConfig = Record<string, unknown>> =
  WidgetTemplateVisualEditorBinding<TConfig>;

/** A named layout variant preset defined by the widget author. */
export interface WidgetVariant<TConfig = Record<string, unknown>> {
  /** Stable identifier (e.g., "queries", "overview"). */
  id: string;
  /** Display name shown in the variant picker (e.g., "Queries", "Overview"). */
  name: string;
  /** The full template config for this variant. */
  config: TConfig;
  /** Mark one variant as the default when no activeVariant is set. First variant is used if omitted. */
  isDefault?: boolean;
}

/** A user-created variant stored in the per-instance widget config. */
export interface CustomVariant {
  id: string;
  name: string;
  config: Record<string, unknown>;
}

/** Controls what happens when the user clicks the expand button on a widget. */
export type WidgetExpandAction =
  | { type: "expanded-view" }
  | { type: "open-plugin"; pluginId: string };

/** Describes a widget template in the registry. */
export interface WidgetDescriptor<TConfig = Record<string, unknown>> extends ExtensionMeta {
  /** Unique identifier. Used as registry key and WidgetCard widgetId. */
  id: string;
  /** Display name shown in WidgetCard header and settings UI. */
  name: string;
  /** Short description for settings UI (Phase 2). */
  description: string;
  /** Semver version string. */
  version?: string;
  /** Catalog grouping used by settings/widget library surfaces. */
  catalogCategory?: string;
  /** Canonical or specialized capability ownership for this widget. */
  capabilities?: WidgetCapability[];
  /** Integration keys that must be present on the active project for this widget to be relevant.
   *  Empty array = always available. When "All" projects is selected, all integrations are assumed present. */
  requiredIntegrations: (keyof PlatformIntegrations)[];
  /** Default grid slot assignment. */
  defaultSlot: GridSlot;
  /** Compact view component. Rendered inside WidgetCard in the grid. */
  component: ComponentType<WidgetRenderProps<TConfig>>;
  /** Expanded view component. Rendered inside ExpandedPortal when the widget is expanded. Optional. */
  expandedComponent?: ComponentType<WidgetRenderProps<TConfig>>;
  /** Default config for new instances. */
  defaultConfig: TConfig;
  /**
   * Named layout variant presets. When defined, the config panel shows a variant picker.
   * The variant with `isDefault: true` (or the first) is used when no activeVariant is set.
   * Users can also duplicate variants for customization via the visual editor.
   */
  variants?: WidgetVariant<TConfig>[];
  /** Optional dynamic display name used in runtime surfaces like headers and config dialogs. */
  getDisplayName?: (context: WidgetDisplayContext<TConfig>) => string;
  /** Optional dynamic description used in config dialogs. */
  getDisplayDescription?: (context: WidgetDisplayContext<TConfig>) => string;
  /** Optional visual editor binding for structured config editing. */
  visualEditor?: WidgetVisualEditorBinding<TConfig>;
  /** Auth requirements. Omit for widgets that don't need external API access. */
  auth?: WidgetAuth | WidgetAuth[];
  /**
   * Default polling interval in milliseconds. Shown in the widget header next to the refresh button.
   * Individual widgets can override this via their SWR refreshInterval.
   * Omit for widgets that don't poll (e.g. static data, logs with SSE).
   */
  defaultPollInterval?: number;
  /** Optional refresh-interval settings metadata for standard polling widgets. */
  polling?: WidgetPollingConfig<TConfig>;
  /**
   * Optional size override for the expanded overlay.
   * Omit this to use the centralized widget default size ("md").
   * - "lg": full viewport − 16px margin
   * - "md": centered, 90vw max-w-7xl × 80vh
   * - "sm": centered, 75vw max-w-3xl × 65vh
   */
  expandedSize?: WidgetModalSize;
  /**
   * Controls what happens when the user clicks the expand button.
   * - `{ type: "expanded-view" }` (default): opens the in-place ExpandedPortal
   * - `{ type: "open-plugin", pluginId }`: navigates to the plugin overlay instead
   */
  expandAction?: WidgetExpandAction;
}

export type { WidgetCapability } from "@radarboard/types/extension";
