import "@/lib/integrations-init";
import "@/lib/plugins-init";
import { getAllIntegrations } from "@radarboard/integration-sdk/registry";
import { createLogger } from "@radarboard/logger/logger";
import { getAllPlugins } from "@radarboard/plugin-sdk/registry";
import type {
  ExtensionCatalogItem,
  ExtensionCatalogProviderRef,
  ExtensionCatalogResponse,
  ExtensionCatalogType,
  ExtensionTier,
} from "@radarboard/types/extension";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { NextResponse } from "next/server";
import { getAllInstalledExtensions } from "@/data/extensions/sqlite-installed-extensions";
import { getWebEnv, WEB_ENV_KEYS } from "@/lib/system/runtime/env";
import { initializeWidgetDescriptors } from "@/lib/widgets-init";

const log = createLogger("api/extensions/catalog");

const COMMUNITY_CATALOG_URL =
  getWebEnv(WEB_ENV_KEYS.extensions.communityCatalogUrl) ??
  "https://raw.githubusercontent.com/Radarboard/community-extensions/main/catalog.json";

const EXTENSION_PACKAGE_PREFIX: Record<ExtensionCatalogType, string> = {
  integration: "@radarboard/integration-",
  plugin: "@radarboard/plugin-",
  widget: "@radarboard/widget-",
};

interface RemoteCatalog {
  generatedAt?: string;
  extensions?: unknown[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asTier(value: unknown): ExtensionTier {
  return value === "community" || value === "experimental" || value === "official"
    ? value
    : "community";
}

function asType(value: unknown): ExtensionCatalogType | undefined {
  return value === "integration" || value === "plugin" || value === "widget" ? value : undefined;
}

function packageNameFor(type: ExtensionCatalogType, id: string): string {
  return id.startsWith("@radarboard/") ? id : `${EXTENSION_PACKAGE_PREFIX[type]}${id}`;
}

function normalizePackageId(type: ExtensionCatalogType, value: string): string {
  const prefix = EXTENSION_PACKAGE_PREFIX[type];
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function normalizeRepoKey(value: string | undefined): string | null {
  if (!value) return null;

  const match = value.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/);
  if (match?.[1] && match[2]) return `${match[1]}/${match[2].replace(/\.git$/, "")}`.toLowerCase();

  const shorthand = value.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shorthand?.[1] && shorthand[2]) {
    return `${shorthand[1]}/${shorthand[2].replace(/\.git$/, "")}`.toLowerCase();
  }

  return null;
}

function unique(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value && value.trim().length > 0)))
  );
}

function normalizeProviders(value: unknown): ExtensionCatalogProviderRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const provider = asRecord(item);
    const integration = asString(provider.integration);
    const action = asString(provider.action);
    return integration && action ? [{ integration, action }] : [];
  });
}

function buildSearchTags(item: {
  id: string;
  name: string;
  description: string;
  category?: string;
  tags?: string[];
  capabilities?: string[];
  requiredIntegrations?: string[];
}): string[] {
  return unique([
    ...(item.tags ?? []),
    ...(item.capabilities ?? []),
    ...(item.requiredIntegrations ?? []),
    item.category,
    item.id,
    item.name,
    ...item.description.split(/\s+/).slice(0, 8),
  ]).map((tag) => tag.toLowerCase());
}

function collectOfficialExtensions(localExtensionIds: Set<string>): ExtensionCatalogItem[] {
  const integrations: ExtensionCatalogItem[] = getAllIntegrations().map((integration) => {
    const capabilities = (integration.capabilities ?? []).map((capability) => capability.id);
    return {
      id: integration.id,
      packageName: packageNameFor("integration", integration.id),
      name: integration.name,
      description: integration.description,
      type: "integration",
      category: integration.category,
      tags: buildSearchTags({
        id: integration.id,
        name: integration.name,
        description: integration.description,
        category: integration.category,
        capabilities,
      }),
      tier: "official",
      source: "official",
      capabilities,
      requiredIntegrations: [],
      providers: [],
      installed: localExtensionIds.has(integration.id),
      installable: false,
    };
  });

  const plugins: ExtensionCatalogItem[] = getAllPlugins().map((plugin) => ({
    id: plugin.id,
    packageName: packageNameFor("plugin", plugin.id),
    name: plugin.name,
    description: plugin.description,
    type: "plugin",
    category: plugin.category,
    tags: buildSearchTags({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      category: plugin.category,
      tags: plugin.launchSurfaces,
    }),
    tier: "official",
    source: "official",
    version: plugin.version,
    capabilities: [],
    requiredIntegrations: plugin.requiredIntegrations ?? [],
    providers: [],
    installed: localExtensionIds.has(plugin.id),
    installable: false,
  }));

  const widgets: ExtensionCatalogItem[] = Array.from(WIDGET_REGISTRY.values()).map((widget) => {
    const capabilities = (widget.capabilities ?? []).map((capability) => capability.id);
    const providers = (widget.capabilities ?? []).flatMap((capability) => capability.providers);
    return {
      id: widget.id,
      packageName: packageNameFor("widget", widget.id),
      name: widget.name,
      description: widget.description,
      type: "widget",
      category: widget.catalogCategory,
      tags: buildSearchTags({
        id: widget.id,
        name: widget.name,
        description: widget.description,
        category: widget.catalogCategory,
        capabilities,
        requiredIntegrations: widget.requiredIntegrations,
      }),
      tier: "official",
      source: "official",
      capabilities,
      requiredIntegrations: widget.requiredIntegrations,
      providers,
      installed: localExtensionIds.has(widget.id),
      installable: false,
    };
  });

  return [...integrations, ...plugins, ...widgets];
}

function normalizeRemoteExtension(
  value: unknown,
  installedRepoKeys: Set<string>,
  localExtensionIds: Set<string>
): ExtensionCatalogItem | null {
  const item = asRecord(value);
  const type = asType(item.type);
  const rawId = asString(item.id) ?? asString(item.packageName) ?? asString(item.name);
  if (!type || !rawId) return null;

  const id = normalizePackageId(type, rawId);
  const name = asString(item.name) ?? id;
  const description = asString(item.description) ?? "";
  const repoUrl =
    asString(item.repoUrl) ??
    asString(item.repository) ??
    asString(asRecord(item.meta).repository) ??
    asString(item.installUrl);
  const installUrl = asString(item.installUrl) ?? repoUrl;
  const repoKey = normalizeRepoKey(installUrl) ?? normalizeRepoKey(repoUrl);
  const capabilities = asStringArray(item.capabilities);
  const requiredIntegrations = asStringArray(item.requiredIntegrations);
  const tags = buildSearchTags({
    id,
    name,
    description,
    category: asString(item.category),
    tags: asStringArray(item.tags),
    capabilities,
    requiredIntegrations,
  });

  return {
    id,
    packageName: asString(item.packageName) ?? packageNameFor(type, id),
    name,
    description,
    type,
    category: asString(item.category),
    tags,
    tier: asTier(item.tier),
    source: "community",
    repoUrl,
    installUrl,
    packagePath: asString(item.packagePath) ?? asString(item.path),
    version: asString(item.version),
    sdkCompatibility: asString(item.sdkCompatibility) ?? asString(item.sdk),
    capabilities,
    requiredIntegrations,
    providers: normalizeProviders(item.providers),
    author: asString(item.author) ?? asString(asRecord(item.author).name),
    lastUpdated: asString(item.lastUpdated) ?? asString(item.updatedAt),
    readmeUrl: asString(item.readmeUrl),
    installed: localExtensionIds.has(id) || (repoKey ? installedRepoKeys.has(repoKey) : false),
    installable: Boolean(installUrl),
  };
}

async function fetchCommunityCatalog(
  installedRepoKeys: Set<string>,
  localExtensionIds: Set<string>
): Promise<{ extensions: ExtensionCatalogItem[]; error?: string }> {
  try {
    const response = await fetch(COMMUNITY_CATALOG_URL, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return { extensions: [], error: `Community catalog returned ${response.status}` };
    }

    const catalog = (await response.json()) as RemoteCatalog;
    const extensions = (catalog.extensions ?? [])
      .map((item) => normalizeRemoteExtension(item, installedRepoKeys, localExtensionIds))
      .filter((item): item is ExtensionCatalogItem => item !== null);

    return { extensions };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Community catalog unavailable";
    log.warn("Failed to fetch community catalog", { error: message });
    return { extensions: [], error: message };
  }
}

export async function handleGetExtensionCatalog() {
  initializeWidgetDescriptors();

  const officialIds = new Set<string>();
  for (const integration of getAllIntegrations()) officialIds.add(integration.id);
  for (const plugin of getAllPlugins()) officialIds.add(plugin.id);
  for (const widget of WIDGET_REGISTRY.values()) officialIds.add(widget.id);

  const installed = await getAllInstalledExtensions().catch(() => []);
  const installedRepoKeys = new Set(
    installed
      .map((extension) => normalizeRepoKey(extension.githubUrl) ?? extension.id.toLowerCase())
      .filter(Boolean)
  );

  const official = collectOfficialExtensions(officialIds);
  const community = await fetchCommunityCatalog(installedRepoKeys, officialIds);
  const byKey = new Map<string, ExtensionCatalogItem>();

  for (const extension of [...community.extensions, ...official]) {
    byKey.set(`${extension.type}:${extension.id}`, extension);
  }

  const response: ExtensionCatalogResponse = {
    generatedAt: new Date().toISOString(),
    communityCatalogUrl: COMMUNITY_CATALOG_URL,
    communityCatalogError: community.error,
    extensions: Array.from(byKey.values()).sort(
      (left, right) =>
        left.type.localeCompare(right.type) ||
        Number(right.installed) - Number(left.installed) ||
        left.name.localeCompare(right.name)
    ),
  };

  return NextResponse.json(response);
}
