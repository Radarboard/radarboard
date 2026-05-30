import type { ExtensionMeta } from "@radarboard/types/extension";
import type {
  IntentPayload,
  IntentPayloadInput,
  IntentPayloadKind,
  IntentResult,
} from "@radarboard/types/intent";
import type { NotificationEventRow, NotificationSeverity } from "@radarboard/types/notifications";
import type { PollingSourceId } from "@radarboard/types/polling";
import type { PlatformIntegrations } from "@radarboard/types/project";
import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { GridSlot, WidgetModalSize } from "@radarboard/widget-engine/widgets/registry";
import type { ComponentType } from "react";
import type { z } from "zod";

// ---------------------------------------------------------------------------
// Presentation types
// ---------------------------------------------------------------------------

/**
 * All possible presentation modes for a plugin overlay.
 *
 * - `"side-panel"` — slides in from the right (most common)
 * - `"fullscreen"` — takes over the viewport
 * - `"modal"` — centered dialog
 * - `"mini-hud"` — small floating widget
 *
 * @example
 * ```ts
 * const descriptor: PluginDescriptor = {
 *   presentation: "side-panel",
 *   // or use PluginPresentationConfig for alternates
 * };
 * ```
 */
export type PresentationMode = "fullscreen" | "side-panel" | "modal" | "mini-hud";

/**
 * Structured presentation config — declares a default mode and optional alternates.
 *
 * Use this instead of a plain `PresentationMode` string when you want users to
 * switch between modes (e.g. side-panel ↔ fullscreen).
 *
 * @example
 * ```ts
 * presentation: {
 *   default: "side-panel",
 *   alternates: ["fullscreen"],
 *   size: "md",
 * }
 * ```
 */
export interface PluginPresentationConfig {
  /** The default mode when launched. */
  default: PresentationMode;
  /** Additional modes the user can switch to. */
  alternates?: PresentationMode[];
  /** Size hint for modal / side-panel presentations. */
  size?: "sm" | "md" | "lg";
}

/** Resolved presentation config — always the full object form. */
export interface ResolvedPresentationConfig {
  default: PresentationMode;
  alternates: PresentationMode[];
  size: "sm" | "md" | "lg";
}

/** Normalise the descriptor's presentation field into the full object form. */
export function resolvePresentationConfig(
  descriptor: PluginDescriptor
): ResolvedPresentationConfig {
  if (typeof descriptor.presentation === "string") {
    return {
      default: descriptor.presentation,
      alternates: [],
      size: descriptor.presentationSize ?? "md",
    };
  }
  return {
    default: descriptor.presentation.default,
    alternates: descriptor.presentation.alternates ?? [],
    size: descriptor.presentation.size ?? descriptor.presentationSize ?? "md",
  };
}

/** Check whether a plugin supports more than one presentation mode. */
export function pluginHasAlternateMode(descriptor: PluginDescriptor): boolean {
  const config = resolvePresentationConfig(descriptor);
  return config.alternates.length > 0;
}

// ---------------------------------------------------------------------------
// Plugin Intent — cross-plugin communication handlers
// ---------------------------------------------------------------------------

/**
 * An action a plugin can receive from other plugins or the assistant.
 *
 * Register intent handlers in your descriptor to let other plugins or the AI
 * assistant send data into your plugin. The intent bus resolves matching
 * handlers by payload kind and presents them in the "Send to…" menu.
 *
 * @example
 * ```ts
 * intents: [
 *   {
 *     action: "create-task",
 *     label: "Add as Task",
 *     accepts: ["text", "url"],
 *     handle: async (payload, api) => {
 *       await api.db.set(`task:${Date.now()}`, { title: payload.text });
 *       return { ok: true };
 *     },
 *   },
 * ]
 * ```
 */
export interface PluginIntentHandler {
  /** Intent action name, e.g. "create-task", "create-bookmark". */
  action: string;
  /** Human-readable label shown in the "Send to…" menu, e.g. "Add as Task". */
  label: string;
  /** Optional description for the menu tooltip. */
  description?: string;
  /** Optional icon override (defaults to the plugin's icon). */
  icon?: ComponentType<{ className?: string }>;
  /** Which payload shapes this handler accepts. */
  accepts: IntentPayloadKind[];
  /** Execute the intent with the given payload. */
  handle: (payload: IntentPayload, api: PluginAPI) => Promise<IntentResult>;
}

/** A resolved target returned by the intent bus for UI rendering. */
export interface ResolvedIntentTarget {
  pluginId: string;
  pluginName: string;
  pluginIcon: ComponentType<{ className?: string }>;
  action: string;
  label: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
}

// ---------------------------------------------------------------------------
// Plugin Descriptor — the public contract every plugin must satisfy
// ---------------------------------------------------------------------------

/**
 * The public contract every plugin must export from its entry point.
 *
 * The descriptor declares everything Radarboard needs to register, render,
 * and manage a plugin — identity, UI, tools, settings, and lifecycle hooks.
 *
 * @example
 * ```ts
 * import { Puzzle } from "lucide-react";
 * import { MyPluginOverlay } from "./components/my-plugin-overlay";
 *
 * export const myPluginDescriptor: PluginDescriptor = {
 *   id: "my-plugin",
 *   name: "My Plugin",
 *   description: "A brief description of what this plugin does.",
 *   icon: Puzzle,
 *   category: "productivity",
 *   version: "0.1.0",
 *   launchSurfaces: ["palette", "topbar"],
 *   presentation: { default: "side-panel", alternates: ["fullscreen"], size: "md" },
 *   component: MyPluginOverlay,
 * };
 * ```
 */
export interface PluginDescriptor extends ExtensionMeta {
  /** Unique, kebab-case identifier, e.g. "tasks". */
  id: string;
  /** Display name shown in launcher, dock, and TopBar. */
  name: string;
  /** Shown in launcher search results and MCP tool descriptions. */
  description: string;
  /** Lucide icon component. */
  icon: ComponentType<{ className?: string }>;
  /** Category for grouping in settings and onboarding UI. */
  category: "productivity" | "monitoring" | "data";
  /** Optional thumbnail URL for richer card display in onboarding and settings. */
  thumbnail?: string;
  /** Semver version string. */
  version: string;

  /** UI surfaces where this plugin can be launched from. */
  launchSurfaces: Array<"palette" | "topbar" | "dock">;

  /** How the plugin's main UI is presented when launched. */
  presentation: PresentationMode | PluginPresentationConfig;
  /** Size hint for modal / side-panel presentations (legacy — prefer `PluginPresentationConfig.size`). */
  presentationSize?: "sm" | "md" | "lg";

  /** The plugin's main UI component, rendered inside the overlay. */
  component: ComponentType<PluginRenderProps>;

  /** Widget(s) this plugin contributes to the dashboard grid. */
  widgets?: PluginWidgetContribution[];

  /** MCP tools exposed to in-app chat and external LLMs. */
  mcpTools?: McpToolDefinition[];

  /** Keyboard shortcut to launch this plugin, e.g. "Mod+Shift+N". */
  shortcut?: string;

  /** Integration keys that must be configured for this plugin to work. */
  requiredIntegrations?: (keyof PlatformIntegrations)[];

  /**
   * External data sources this plugin can connect to.
   * Each source supports one or more connection types (MCP, OAuth, API key).
   * The plugin reads data through whichever connection the user configures.
   */
  dataSources?: PluginDataSource[];

  /**
   * Plugin-specific settings that users can customise.
   * Each entry renders as a form field in the plugin detail modal.
   */
  settings?: PluginSettingDefinition[];

  /**
   * Optional integrations into shared Radarboard surfaces like notifications and ticker.
   * Plugins opt in per-surface; users can then enable/disable each contribution.
   */
  radarboardIntegrations?: PluginRadarboardIntegrationConfig;

  /**
   * Intents this plugin can receive from other plugins or the assistant.
   * Each handler declares which payload kinds it accepts and how to process them.
   */
  intents?: PluginIntentHandler[];

  /**
   * Optional lifecycle hooks called at specific stages of the plugin's life.
   * All hooks receive a `PluginAPI` and may return a cleanup function.
   */
  lifecycle?: PluginLifecycleHooks;

  /**
   * Ordered list of data migrations. On plugin activation, the runner compares
   * the stored `_meta:version` against the descriptor's `version` and executes
   * any migrations whose `version` is newer than the stored one.
   *
   * Versions must be valid semver strings and listed in ascending order.
   */
  migrations?: PluginMigration[];

  /**
   * Declare which PluginAPI capabilities this plugin requires.
   * Omitting this field grants all capabilities (backward compatible).
   * When specified, undeclared capabilities become no-ops.
   */
  permissions?: PluginPermission[];

  /**
   * Plugin IDs that must be initialized before this plugin.
   * Used to topologically sort the init order in PluginLifecycleRunner.
   * Cycles are detected at init time and logged as errors.
   */
  dependencies?: string[];

  /**
   * Services this plugin exposes for cross-plugin RPC calls.
   * Other plugins can call these via `api.rpc.call(pluginId, action, params)`.
   * Params are validated with the declared Zod schema at call time.
   */
  services?: PluginServiceDefinition[];
}

// ---------------------------------------------------------------------------
// Plugin Service (RPC)
// ---------------------------------------------------------------------------

/**
 * A service a plugin exposes for cross-plugin RPC calls.
 *
 * Other plugins invoke services via `api.rpc.call(pluginId, action, params)`.
 * The params are validated at runtime against the declared Zod schema.
 *
 * @example
 * ```ts
 * services: [
 *   {
 *     action: "get-count",
 *     description: "Get total item count",
 *     parameters: z.object({}),
 *     handler: async (_params, api) => {
 *       const items = await api.db.list("item:");
 *       return { count: items.length };
 *     },
 *   },
 * ]
 * ```
 */
export interface PluginServiceDefinition {
  /** Action name, e.g. "list-tasks", "get-bookmark". */
  action: string;
  /** Human-readable description. */
  description?: string;
  /** Zod schema for input params validation. */
  parameters: z.ZodType;
  /** Execute the service. Receives validated params + the owning plugin's API. */
  handler: (params: unknown, api: PluginAPI) => Promise<unknown>;
}

/** Result of an RPC call. */
export type PluginRpcResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Plugin Permissions
// ---------------------------------------------------------------------------

/** Capabilities a plugin may request access to. */
export type PluginPermission =
  | "db"
  | "events"
  | "intents"
  | "hotkeys"
  | "notify"
  | "dataSources"
  | "projects"
  | "rpc";

/** Check if a plugin has a specific permission. */
export function pluginHasPermission(
  descriptor: PluginDescriptor,
  permission: PluginPermission
): boolean {
  // No permissions declared = full access (backward compatible)
  if (!descriptor.permissions) return true;
  return descriptor.permissions.includes(permission);
}

// ---------------------------------------------------------------------------
// Plugin Lifecycle Hooks
// ---------------------------------------------------------------------------

/** Cleanup function returned from a lifecycle hook. */
export type PluginLifecycleCleanup = () => void | Promise<void>;

/** Optional hooks called at specific stages of a plugin's lifecycle (init, activate, deactivate, destroy). */
export interface PluginLifecycleHooks {
  /**
   * Called once when the plugin is registered (at app startup).
   * Use for preloading data, warming caches, or setting up background tasks.
   */
  onInit?: (api: PluginAPI) => Promise<PluginLifecycleCleanup | undefined>;

  /**
   * Called each time the plugin becomes the active (visible) plugin.
   * Use for refreshing stale data or starting timers.
   */
  onActivate?: (api: PluginAPI) => Promise<PluginLifecycleCleanup | undefined>;

  /**
   * Called when the plugin is no longer active (user closed or switched away).
   * Use for pausing background work or saving draft state.
   */
  onDeactivate?: (api: PluginAPI) => Promise<void>;

  /**
   * Called once during app teardown (PluginHost unmount).
   * Use for releasing resources acquired in onInit.
   */
  onDestroy?: (api: PluginAPI) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Plugin Data Migration
// ---------------------------------------------------------------------------

/**
 * A data migration for upgrading plugin DB schema between versions.
 *
 * Migrations run automatically when the plugin's stored version is older
 * than the descriptor's `version`. List in ascending semver order.
 *
 * @example
 * ```ts
 * migrations: [
 *   {
 *     version: "1.1.0",
 *     description: "Add 'completed' field to tasks",
 *     up: async (db) => {
 *       const tasks = await db.list<Task>("task:");
 *       for (const task of tasks) {
 *         await db.set(`task:${task.id}`, { ...task, completed: false });
 *       }
 *     },
 *   },
 * ]
 * ```
 */
export interface PluginMigration {
  /** Semver version this migration upgrades TO (e.g. "1.1.0"). */
  version: string;
  /** Human-readable description of what this migration does. */
  description?: string;
  /** Execute the migration using the plugin's DB API. */
  up: (db: PluginAPI["db"]) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Plugin Setting Definition — describes one user-configurable option
// ---------------------------------------------------------------------------

/** The supported input types for plugin user-configurable settings. */
export type PluginSettingType = "text" | "number" | "boolean" | "select";

/**
 * Describes one user-configurable option for a plugin.
 *
 * Each setting renders as a form field in the plugin's settings panel.
 * Values are stored in the plugin DB under `_config:<key>`.
 *
 * @example
 * ```ts
 * settings: [
 *   {
 *     key: "maxItems",
 *     label: "Maximum Items",
 *     description: "How many items to display at once.",
 *     type: "number",
 *     defaultValue: 50,
 *   },
 *   {
 *     key: "sortOrder",
 *     label: "Sort Order",
 *     type: "select",
 *     defaultValue: "newest",
 *     options: [
 *       { label: "Newest first", value: "newest" },
 *       { label: "Oldest first", value: "oldest" },
 *     ],
 *   },
 * ]
 * ```
 */
export interface PluginSettingDefinition {
  /** Unique key for this setting, stored in plugin DB as `_config:<key>`. */
  key: string;
  /** Display label in the settings form. */
  label: string;
  /** Optional description shown below the label. */
  description?: string;
  /** Input type. */
  type: PluginSettingType;
  /** Default value. */
  defaultValue: string | number | boolean;
  /** For "select" type: flat options (use this OR optionGroups, not both). */
  options?: { label: string; value: string }[];
  /** For "select" type: grouped options with provider/category headers. */
  optionGroups?: {
    label: string;
    options: { label: string; value: string; description?: string }[];
  }[];
  /** Enable search/filter in select dropdowns. */
  searchable?: boolean;
}

// ---------------------------------------------------------------------------
// Plugin User Config — user overrides stored in the DB
// ---------------------------------------------------------------------------

/** User-level overrides for a plugin's behavior, stored in the plugin DB. */
export interface PluginUserConfig {
  /** Custom keyboard shortcut (overrides descriptor default). */
  shortcut?: string | null;
  /** Attempt desktop-global registration in Tauri when supported. */
  desktopGlobalShortcut?: boolean;
  /** Custom launch surfaces (overrides descriptor default). */
  launchSurfaces?: Array<"palette" | "topbar" | "dock">;
  /** Disabled MCP tool names (tool is skipped if listed here). */
  disabledTools?: string[];
  /** Disabled widget IDs (widget is hidden if listed here). */
  disabledWidgets?: string[];
  /** Whether this plugin may publish into Radarboard notifications. */
  notificationIntegrationEnabled?: boolean;
  /** Whether this plugin may surface items in the shared ticker. */
  tickerIntegrationEnabled?: boolean;
  /** Plugin-specific settings values. */
  settings?: Record<string, string | number | boolean>;
  /** User's preferred presentation mode (overrides descriptor default). */
  preferredPresentation?: PresentationMode;
}

/** Per-surface configuration for a plugin's integration into a shared Radarboard surface. */
export interface PluginRadarboardSurfaceConfig {
  /** Default user-facing enabled state when no override exists. */
  enabledByDefault?: boolean;
}

/** Declares which shared Radarboard surfaces (notifications, ticker) a plugin integrates with. */
export interface PluginRadarboardIntegrationConfig {
  notifications?: PluginRadarboardSurfaceConfig;
  ticker?: PluginRadarboardSurfaceConfig;
}

/** Returns true if the plugin declares a notifications integration in its descriptor. */
export function pluginSupportsNotifications(descriptor: PluginDescriptor): boolean {
  return Boolean(descriptor.radarboardIntegrations?.notifications);
}

/** Returns true if the plugin declares a ticker integration in its descriptor. */
export function pluginSupportsTicker(descriptor: PluginDescriptor): boolean {
  return Boolean(descriptor.radarboardIntegrations?.ticker);
}

/** Checks whether the plugin's notification integration is enabled, considering user config and descriptor defaults. */
export function isPluginNotificationIntegrationEnabled(
  descriptor: PluginDescriptor,
  config?: PluginUserConfig
): boolean {
  if (!pluginSupportsNotifications(descriptor)) return false;
  return (
    config?.notificationIntegrationEnabled ??
    descriptor.radarboardIntegrations?.notifications?.enabledByDefault ??
    true
  );
}

/** Checks whether the plugin's ticker integration is enabled, considering user config and descriptor defaults. */
export function isPluginTickerIntegrationEnabled(
  descriptor: PluginDescriptor,
  config?: PluginUserConfig
): boolean {
  if (!pluginSupportsTicker(descriptor)) return false;
  return (
    config?.tickerIntegrationEnabled ??
    descriptor.radarboardIntegrations?.ticker?.enabledByDefault ??
    true
  );
}

// ---------------------------------------------------------------------------
// Plugin Data Source — external service connections
// ---------------------------------------------------------------------------

/**
 * How a plugin can connect to an external data source.
 *
 * - `"mcp"` — via an MCP server (e.g. a locally running server)
 * - `"oauth"` — via OAuth redirect flow
 * - `"api_key"` — via a manually entered API token
 */
export type PluginConnectionType = "mcp" | "oauth" | "api_key";

/**
 * Declares an external service a plugin can pull data from.
 *
 * Plugins can connect to external APIs, MCP servers, or OAuth providers.
 * The user configures connections in the plugin settings UI.
 *
 * @example
 * ```ts
 * dataSources: [
 *   {
 *     id: "raindrop",
 *     name: "Raindrop.io",
 *     description: "Bookmark collections and highlights",
 *     connectionTypes: ["api_key", "oauth"],
 *     integrationKey: "raindrop",
 *     required: false,
 *   },
 * ]
 * ```
 */
export interface PluginDataSource {
  /** Unique ID for this data source within the plugin, e.g. "raindrop". */
  id: string;
  /** Display name, e.g. "Raindrop.io". */
  name: string;
  /** Short description of what data this source provides. */
  description: string;
  /** Supported connection methods — order indicates preference. */
  connectionTypes: PluginConnectionType[];
  /**
   * For MCP connections: the MCP server name(s) that provide this data.
   * The plugin can check if any of these are available.
   */
  mcpServerNames?: string[];
  /**
   * For OAuth/API key connections: the integration key used to look up
   * stored credentials (maps to PlatformIntegrations keys or custom ones).
   */
  integrationKey?: string;
  /** Whether this source is required or optional. Default: false (optional). */
  required?: boolean;
}

// ---------------------------------------------------------------------------
// Plugin Widget Contribution
// ---------------------------------------------------------------------------

/**
 * A dashboard widget contributed by a plugin.
 *
 * Plugins can embed widgets in the main grid. The widget is registered
 * as `"<pluginId>__<widgetId>"` and uses the shared template engine.
 *
 * @example
 * ```ts
 * widgets: [
 *   {
 *     widgetId: "summary",
 *     name: "My Plugin Summary",
 *     description: "Quick overview of plugin data",
 *     defaultSlot: "slot7",
 *     templateConfig: { version: 1, dataSources: [...], sections: [...] },
 *   },
 * ]
 * ```
 */
export interface PluginWidgetContribution {
  /**
   * Widget ID — automatically namespaced as `"<pluginId>__<widgetId>"`
   * when registered into WIDGET_REGISTRY.
   */
  widgetId: string;
  /** Display name in the slot picker. */
  name: string;
  /** Short description for the slot picker. */
  description: string;
  /** Preferred default grid slot. */
  defaultSlot?: GridSlot;
  /** Template-backed widget configuration used by the shared widget runtime/editor. */
  templateConfig: WidgetTemplateConfig;
  /** Optional size override for the expanded overlay. Omit to use the centralized widget default size ("md"). */
  expandedSize?: WidgetModalSize;
  /** Shared dashboard polling source IDs used by the template data sources. */
  pollingSourceIds?: PollingSourceId[];
  /** Header hint for default refresh interval in milliseconds. */
  defaultPollInterval?: number;
  /** Optional extra integration requirements beyond the parent plugin. */
  requiredIntegrations?: (keyof PlatformIntegrations)[];
}

// ---------------------------------------------------------------------------
// Plugin API — injected into every plugin via PluginRenderProps
// ---------------------------------------------------------------------------

/**
 * Runtime API injected into every plugin via {@link PluginRenderProps}.
 *
 * Provides scoped database access, notifications, hotkeys, event bus,
 * cross-plugin communication (intents + RPC), and project data.
 *
 * @example
 * ```ts
 * function MyPluginOverlay({ api }: PluginRenderProps) {
 *   // Read from plugin-scoped DB
 *   const items = await api.db.list<Item>("item:");
 *
 *   // Show a toast
 *   api.notify("Saved!", "success");
 *
 *   // Register a keyboard shortcut
 *   api.hotkeys.register("Mod+N", () => createItem());
 *
 *   // Close the overlay
 *   api.close();
 * }
 * ```
 */
export interface PluginAPI {
  /** Read widget data from the SWR cache. */
  widgets: {
    getState: (widgetId: string) => unknown;
  };

  /**
   * Plugin-namespaced key-value DB access.
   *
   * All keys are automatically scoped to this plugin — no collisions with
   * other plugins. Values are JSON-serialized.
   *
   * @example
   * ```ts
   * // Store a value
   * await api.db.set("item:abc", { title: "My item", done: false });
   *
   * // Read it back
   * const item = await api.db.get<Item>("item:abc");
   *
   * // List all items by prefix
   * const items = await api.db.list<Item>("item:");
   *
   * // Delete
   * await api.db.delete("item:abc");
   * ```
   */
  db: {
    get: <T>(key: string) => Promise<T | null>;
    set: <T>(key: string, value: T) => Promise<void>;
    delete: (key: string) => Promise<void>;
    list: <T>(prefix: string) => Promise<T[]>;
  };

  /**
   * Register keyboard shortcuts scoped to this plugin.
   *
   * Shortcuts are automatically cleaned up when the plugin unmounts.
   * Returns a cleanup function for manual removal.
   *
   * @example
   * ```ts
   * // Register Mod+N (Cmd on Mac, Ctrl on Windows/Linux)
   * const cleanup = api.hotkeys.register("Mod+N", () => createNewItem());
   *
   * // Manual cleanup if needed (auto-cleaned on unmount)
   * cleanup();
   * ```
   */
  hotkeys: {
    register: (key: string, handler: () => void) => () => void;
  };

  /** Fire a toast notification. */
  notify: (message: string, type?: "info" | "success" | "error") => void;

  /** Close the plugin overlay. */
  close: () => void;

  /**
   * Notification event bus — emit events into the Radarboard notification pipeline
   * and subscribe to events from other sources.
   *
   * Emitted events are automatically sourced as `plugin:<pluginId>`.
   */
  events: {
    emit: (event: {
      type: string;
      severity: NotificationSeverity;
      title: string;
      body?: string | null;
      metadata?: Record<string, unknown>;
    }) => void;
    on: (
      filter: { source?: string; type?: string },
      handler: (event: NotificationEventRow) => void
    ) => () => void;
  };

  /** Access the app's project list (read-only). */
  projects: {
    list: () => Promise<Array<{ slug: string; name: string; color: string }>>;
  };

  /** Reactive URL search parameters from Next.js */
  searchParams: URLSearchParams;

  /**
   * Cross-plugin intent system — send data to other plugins or the assistant.
   */
  intents: {
    /** Resolve which plugins can handle a given payload (for populating "Send to…" menus). */
    resolveTargets: (payload: IntentPayload) => ResolvedIntentTarget[];
    /** Send a payload to a specific plugin's intent handler. sourcePluginId is auto-injected. */
    sendTo: (
      targetPluginId: string,
      action: string,
      payload: IntentPayloadInput
    ) => Promise<IntentResult>;
    /** Send a payload to the assistant chat. Opens the chat drawer and queues the item. */
    sendToAssistant: (payload: IntentPayloadInput, promptHint?: string) => Promise<void>;
  };

  /**
   * Query the connection status of a plugin's data sources.
   * Returns which sources are connected and via which method.
   */
  dataSources: {
    /** Check if a specific data source is connected. */
    isConnected: (sourceId: string) => Promise<boolean>;
    /** Get the active connection type for a source, or null if not connected. */
    getConnectionType: (sourceId: string) => Promise<PluginConnectionType | null>;
  };

  /**
   * Cross-plugin RPC — call services exposed by other plugins.
   * Returns typed results with Zod-validated params.
   */
  rpc: {
    /** Call a service on another plugin. Params validated against the service's Zod schema. */
    call: <T = unknown>(
      pluginId: string,
      action: string,
      params?: unknown
    ) => Promise<PluginRpcResult<T>>;
    /** List all available services across registered plugins. */
    listServices: () => Array<{
      pluginId: string;
      action: string;
      description?: string;
    }>;
  };
}

/**
 * Props passed to every plugin's main component.
 *
 * Your overlay component receives this as its only prop. Destructure `api`
 * to access the full {@link PluginAPI}.
 *
 * @example
 * ```tsx
 * export function MyPluginOverlay({ api }: PluginRenderProps) {
 *   return <div>Hello from {api.db.get("name")}</div>;
 * }
 * ```
 */
export interface PluginRenderProps {
  api: PluginAPI;
}

// ---------------------------------------------------------------------------
// MCP Tool Definition
// ---------------------------------------------------------------------------

/**
 * Defines an MCP tool that the AI assistant can invoke on behalf of the user.
 *
 * Tools are automatically namespaced as `"<pluginId>__<name>"` when registered.
 * The `execute` function receives Zod-validated params and the plugin's API.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 *
 * const tools: McpToolDefinition[] = [
 *   {
 *     name: "list-items",
 *     description: "List all items in the plugin",
 *     parameters: z.object({
 *       limit: z.number().optional().describe("Max items to return"),
 *     }),
 *     execute: async (params, api) => {
 *       const items = await api.db.list("item:");
 *       return { items: items.slice(0, params.limit ?? 100) };
 *     },
 *   },
 * ];
 * ```
 */
export interface McpToolDefinition {
  /** Tool name — automatically namespaced as `"<pluginId>__<name>"`. */
  name: string;
  /** Description shown to LLMs — must be clear and accurate. */
  description: string;
  /** Zod schema for validated input parameters. */
  parameters: z.ZodType;
  /** Execute the tool with validated params and the plugin API. */
  execute: (params: unknown, api: PluginAPI) => Promise<unknown>;
}
