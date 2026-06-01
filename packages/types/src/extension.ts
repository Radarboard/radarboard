/**
 * Quality tier for extensions. Sets expectations for maintenance and support.
 *
 * - `"official"` — Maintained by the core team, tested on every release
 * - `"community"` — Maintained by contributors, reviewed before merge
 * - `"experimental"` — Proof of concept, may have rough edges
 */
export type ExtensionTier = "official" | "community" | "experimental";

/**
 * Granular permissions an extension may require.
 *
 * Extensions declare what capabilities they need so users and reviewers
 * can understand the blast radius before enabling.
 *
 * @example
 * ```ts
 * const permissions: ExtensionPermission[] = ["network", "credentials", "notifications"];
 * ```
 */
export type ExtensionPermission =
  | "network"
  | "credentials"
  | "database"
  | "notifications"
  | "filesystem"
  | "clipboard"
  | "shell";

/** Shared cross-service dashboard capabilities used for canonical widget ownership. */
export const CAPABILITY_IDS = [
  "revenue",
  "bookmarks",
  "stars",
  "domains",
  "errors",
  "uptime",
  "app-reviews",
  "downloads",
  "sponsorship",
  "shipping",
  "analytics",
  "seo",
] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export function isCapabilityId(value: string): value is CapabilityId {
  return (CAPABILITY_IDS as readonly string[]).includes(value);
}

/** Integration action that satisfies a capability. */
export interface CapabilityProviderRef {
  integration: string;
  action: string;
}

/** Capability exposed by an integration descriptor. */
export interface IntegrationCapability {
  id: CapabilityId;
  action: string;
}

/** Capability owned by a widget descriptor. */
export interface WidgetCapability {
  id: CapabilityId;
  role: "canonical" | "specialized";
  providers: CapabilityProviderRef[];
}

/**
 * Shared metadata for extensions (integrations, plugins, widgets) that may be installed from external repos.
 *
 * @example
 * ```ts
 * const meta: ExtensionMeta = {
 *   author: { name: "Acme Corp", url: "https://acme.dev" },
 *   repository: "https://github.com/acme/radarboard-jira",
 *   license: "MIT",
 *   tier: "community",
 *   requiredCapabilities: ["network", "credentials"],
 *   minAppVersion: "1.4.0",
 * };
 * ```
 */
export interface ExtensionMeta {
  /** Author of this extension. */
  author?: { name: string; url?: string };
  /** URL to the source code repository. */
  repository?: string;
  /** SPDX license identifier (e.g., "MIT", "Apache-2.0"). */
  license?: string;
  /** URL to the extension's landing page or documentation site. */
  homepage?: string;
  /** URL to the changelog or release notes. */
  changelog?: string;
  /** Minimum Radarboard app version required (semver, e.g., "1.2.0"). */
  minAppVersion?: string;
  /** URLs to preview screenshots shown in the extension catalog. */
  screenshots?: string[];
  /** Quality tier — sets expectations for maintenance and support. Defaults to "official" for in-repo extensions. */
  tier?: ExtensionTier;
  /** System-level capabilities this extension requires. Displayed in the catalog for transparency. */
  requiredCapabilities?: ExtensionPermission[];
}

export type ExtensionCatalogSource = "official" | "community";

export type ExtensionCatalogType = "integration" | "plugin" | "widget";

export interface ExtensionCatalogProviderRef {
  integration: string;
  action: string;
}

export interface ExtensionCatalogItem {
  id: string;
  packageName?: string;
  name: string;
  description: string;
  type: ExtensionCatalogType;
  category?: string;
  tags: string[];
  tier: ExtensionTier;
  source: ExtensionCatalogSource;
  repoUrl?: string;
  installUrl?: string;
  packagePath?: string;
  version?: string;
  sdkCompatibility?: string;
  capabilities: string[];
  requiredIntegrations: string[];
  providers: ExtensionCatalogProviderRef[];
  author?: string;
  lastUpdated?: string;
  readmeUrl?: string;
  installed: boolean;
  installable: boolean;
}

export interface ExtensionCatalogResponse {
  generatedAt: string;
  communityCatalogUrl: string;
  communityCatalogError?: string;
  extensions: ExtensionCatalogItem[];
}

// ---------------------------------------------------------------------------
// Extension config migration
// ---------------------------------------------------------------------------

/**
 * A versioned migration for extension configuration data.
 *
 * When an extension's config schema changes between versions, migrations
 * transform stored user config to the new shape. The runner compares the
 * stored config version against the migration list and applies pending ones.
 *
 * @example
 * ```ts
 * const migrations: ExtensionConfigMigration[] = [
 *   {
 *     version: "0.2.0",
 *     description: "Rename 'apiKey' to 'accessToken'",
 *     up: (config) => {
 *       if (config.apiKey) {
 *         config.accessToken = config.apiKey;
 *         delete config.apiKey;
 *       }
 *       return config;
 *     },
 *   },
 * ];
 * ```
 */
export interface ExtensionConfigMigration {
  /** Semver version this migration upgrades TO (e.g. "0.2.0"). */
  version: string;
  /** Human-readable description of what this migration does. */
  description?: string;
  /** Transform the config from the previous version to this version. */
  up: (config: Record<string, unknown>) => Record<string, unknown>;
}
