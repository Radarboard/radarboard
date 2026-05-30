import { INTEGRATION_REGISTRY } from "@radarboard/integration-sdk/registry";
import type { IntegrationAuth } from "@radarboard/integration-sdk/types";
import { API_ROUTES } from "@radarboard/types/api-routes";
import type { IntegrationConnection } from "@radarboard/types/database";
import type { McpSecretValue, McpServerConfig } from "@radarboard/types/mcp-server";
import type { NotificationPreferenceRow } from "@radarboard/types/notifications";
import type { PlatformIntegrations } from "@radarboard/types/project";
import type { WidgetAuth } from "@radarboard/widget-engine/widgets/registry";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import type { IntegrationProviderDefinition } from "@/hooks/settings/use-integration-connections";
import { buildCredentialReference } from "@/lib/mcp/mcp-server-config";
import { readStoredIntegrationModalTab } from "../settings-storage";
import { CATEGORY_ORDER, INTEGRATION_CATEGORY_LABELS, WEBHOOK_SERVICE_CONFIG } from "./constants";
import type {
  IntegrationModalTab,
  LinkedMcpDraft,
  ServiceCategory,
  ServiceEntry,
  WebhookServiceId,
  WidgetRegistryDescriptor,
} from "./types";

function getDescriptorPollingSourceIds(descriptorId: string): string[] {
  const descriptor = INTEGRATION_REGISTRY.get(descriptorId);
  if (!descriptor) return [];

  return Array.from(
    new Set(
      (descriptor.dataSources ?? [])
        .map((dataSource) => dataSource.pollingSourceId)
        .filter((sourceId): sourceId is string => typeof sourceId === "string")
    )
  );
}

export function isWebhookService(serviceId: string): serviceId is WebhookServiceId {
  return serviceId in WEBHOOK_SERVICE_CONFIG;
}

export function normalizeRelayUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function buildWebhookEndpoint(relayUrl: string, serviceId: WebhookServiceId): string {
  if (!relayUrl) return "";
  return `${normalizeRelayUrl(relayUrl)}/api/webhooks/${serviceId}`;
}

export function defaultNotificationPreference(id: string): NotificationPreferenceRow {
  return {
    id,
    enabled: true,
    preset: "critical_only",
    digestWindow: 300,
    channels: ["in_app"],
    quietHours: null,
    updatedAt: Math.floor(Date.now() / 1000),
  };
}

/** Convert IntegrationAuth → WidgetAuth for UI compatibility during migration. */
export function integrationAuthToWidgetAuth(auth: IntegrationAuth): WidgetAuth {
  return {
    id: auth.id,
    name: auth.name,
    type: auth.type,
    fields: auth.fields,
    testEndpoint: auth.testEndpoint,
    docsUrl: auth.docsUrl,
    oauth: auth.oauth,
  };
}

export function getAuthList(descriptor: WidgetRegistryDescriptor) {
  if (!descriptor.auth) return [];
  return Array.isArray(descriptor.auth) ? descriptor.auth : [descriptor.auth];
}

/** Merge OAuth scopes from `source` into `target`, deduplicating. */
export function mergeOAuthScopes(target: WidgetAuth, source: WidgetAuth) {
  const targetScopes = target.oauth?.scopes;
  const sourceScopes = source.oauth?.scopes;
  if (!targetScopes || !sourceScopes) return;
  for (const scope of sourceScopes) {
    if (!targetScopes.includes(scope)) {
      targetScopes.push(scope);
    }
  }
}

const REQUIRED_INTEGRATION_TO_SERVICE_ID: Record<string, string> = {
  appStoreConnect: "app-store-connect",
  betterstack: "betterstack",
  github: "github",
  googleSearchConsole: "google-search-console",
  linear: "linear",
  npm: "npm",
  openCollective: "open-collective",
  openPanel: "openpanel",
  revenuecat: "revenuecat",
  sentry: "sentry",
  vercel: "vercel",
};

const DESCRIPTOR_ID_TO_PLATFORM_INTEGRATION_KEY = Object.fromEntries(
  Object.entries(REQUIRED_INTEGRATION_TO_SERVICE_ID).map(([integrationKey, serviceId]) => [
    serviceId,
    integrationKey,
  ])
) as Record<string, keyof PlatformIntegrations>;

export function collectRegistryServices(serviceMap: Map<string, ServiceEntry>) {
  for (const descriptor of INTEGRATION_REGISTRY.values()) {
    const auth = integrationAuthToWidgetAuth(descriptor.auth);
    const existing = serviceMap.get(descriptor.auth.id);
    const pollingSourceIds = getDescriptorPollingSourceIds(descriptor.id);

    if (existing) {
      mergeOAuthScopes(existing.auth, auth);
      if (!existing.defaultRssFeedUrl && descriptor.defaultRssFeedUrl) {
        existing.defaultRssFeedUrl = descriptor.defaultRssFeedUrl;
      }
      if (!existing.defaultStatusPageUrl && descriptor.defaultStatusPageUrl) {
        existing.defaultStatusPageUrl = descriptor.defaultStatusPageUrl;
      }
      if (!existing.mcpConfig && descriptor.mcp) {
        existing.mcpConfig = descriptor.mcp;
      }
      if (!existing.category && descriptor.category) {
        existing.category = descriptor.category;
      }
      if (!existing.integrationKey) {
        existing.integrationKey = DESCRIPTOR_ID_TO_PLATFORM_INTEGRATION_KEY[descriptor.id];
      }
      if (!existing.descriptorId) {
        existing.descriptorId = descriptor.id;
      }
      if (!existing.description && descriptor.description) {
        existing.description = descriptor.description;
      }
      existing.pollingSourceIds = Array.from(
        new Set([...existing.pollingSourceIds, ...pollingSourceIds])
      );
      continue;
    }

    serviceMap.set(descriptor.auth.id, {
      credKey: descriptor.auth.id,
      auth,
      usedByWidgets: [],
      pollingSourceIds,
      category: descriptor.category,
      descriptorId: descriptor.id,
      description: descriptor.description,
      defaultRssFeedUrl: descriptor.defaultRssFeedUrl,
      defaultStatusPageUrl: descriptor.defaultStatusPageUrl,
      mcpConfig: descriptor.mcp,
      configFlow: descriptor.configFlow,
      integrationKey: DESCRIPTOR_ID_TO_PLATFORM_INTEGRATION_KEY[descriptor.id],
    });
  }
}

export function ensureWidgetUsage(
  serviceMap: Map<string, ServiceEntry>,
  serviceId: string,
  widgetName: string
) {
  const existing = serviceMap.get(serviceId);
  if (!existing) return;
  if (!existing.usedByWidgets.includes(widgetName)) {
    existing.usedByWidgets.push(widgetName);
  }
}

export function mergeWidgetAuthServices(
  serviceMap: Map<string, ServiceEntry>,
  descriptor: WidgetRegistryDescriptor
) {
  for (const auth of getAuthList(descriptor)) {
    if (auth.type === "none" || !auth.id) continue;

    const existing = serviceMap.get(auth.id);
    if (existing) {
      ensureWidgetUsage(serviceMap, auth.id, descriptor.name);
      mergeOAuthScopes(existing.auth, auth);
      if (!existing.category && descriptor.catalogCategory) {
        existing.category = descriptor.catalogCategory;
      }
      if (!existing.description && auth.description) {
        existing.description = auth.description;
      }
      continue;
    }

    serviceMap.set(auth.id, {
      credKey: auth.id,
      auth,
      usedByWidgets: [descriptor.name],
      pollingSourceIds: [],
      category: descriptor.catalogCategory,
      description: auth.description,
    });
  }
}

export function mergeWidgetRequiredServices(
  serviceMap: Map<string, ServiceEntry>,
  descriptor: WidgetRegistryDescriptor
) {
  if (!descriptor.requiredIntegrations) return;
  for (const requiredIntegration of descriptor.requiredIntegrations) {
    const serviceId = REQUIRED_INTEGRATION_TO_SERVICE_ID[requiredIntegration];
    if (!serviceId) continue;
    ensureWidgetUsage(serviceMap, serviceId, descriptor.name);
  }
}

export function mergeWidgetServices(serviceMap: Map<string, ServiceEntry>) {
  for (const descriptor of WIDGET_REGISTRY.values()) {
    mergeWidgetAuthServices(serviceMap, descriptor);
    mergeWidgetRequiredServices(serviceMap, descriptor);
  }
}

export function collectServices(): ServiceEntry[] {
  const serviceMap = new Map<string, ServiceEntry>();

  collectRegistryServices(serviceMap);
  mergeWidgetServices(serviceMap);

  return Array.from(serviceMap.values());
}

export function getIntegrationCategories(services: ServiceEntry[]): ServiceCategory[] {
  const categoryMap = new Map<string, string[]>();

  // Group services by their category
  for (const service of services) {
    const catId = service.category || "uncategorized";
    const list = categoryMap.get(catId) || [];
    list.push(service.credKey);
    categoryMap.set(catId, list);
  }

  const result: ServiceCategory[] = [];

  // Add categories in the preferred order
  for (const catId of CATEGORY_ORDER) {
    const serviceIds = categoryMap.get(catId);
    if (serviceIds && serviceIds.length > 0) {
      result.push({
        id: catId,
        label:
          INTEGRATION_CATEGORY_LABELS[catId as keyof typeof INTEGRATION_CATEGORY_LABELS] || catId,
        serviceIds,
      });
      categoryMap.delete(catId);
    }
  }

  // Add any remaining categories
  for (const [catId, serviceIds] of categoryMap.entries()) {
    result.push({
      id: catId,
      label: catId.charAt(0).toUpperCase() + catId.slice(1),
      serviceIds,
    });
  }

  return result;
}

export async function fetchCredentialValues(key: string): Promise<Record<string, string> | null> {
  const res = await fetch(`${API_ROUTES.credentials}?key=${encodeURIComponent(key)}`);
  const data = (await res.json()) as { values?: Record<string, string> | null };
  return data.values ?? null;
}

export async function saveCredentialValues(
  key: string,
  values: Record<string, string>
): Promise<boolean> {
  const compactValues = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value.trim().length > 0)
  );
  const res = await fetch(API_ROUTES.credentials, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, values: compactValues }),
  });
  return res.ok;
}

export async function deleteCredentialValues(key: string): Promise<boolean> {
  const res = await fetch(API_ROUTES.credentials, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  return res.ok;
}

export function hasRequiredCredentialFields(
  values: Record<string, string> | null,
  fields: WidgetAuth["fields"]
): boolean {
  if (!fields?.length || !values) return false;
  return fields.every((field) => field.optional || values[field.key]?.trim());
}

export function getLinkedServerNames(service: ServiceEntry): string[] {
  if (!service.mcpConfig) return [service.credKey];
  return [service.mcpConfig.serverName, ...(service.mcpConfig.aliases ?? []), service.credKey];
}

export function getServiceConnections(
  service: ServiceEntry,
  connections: IntegrationConnection[]
): IntegrationConnection[] {
  return connections.filter((connection) => connection.provider === service.credKey);
}

export function getDefaultServiceConnection(
  service: ServiceEntry,
  connections: IntegrationConnection[]
): IntegrationConnection | null {
  const serviceConnections = getServiceConnections(service, connections);
  return (
    serviceConnections.find((connection) => connection.isDefault) ?? serviceConnections[0] ?? null
  );
}

export function getServiceConnectionCount(
  service: ServiceEntry,
  connections: IntegrationConnection[]
): number {
  return getServiceConnections(service, connections).length;
}

export function getServiceApiConfigured(
  service: ServiceEntry,
  connections: IntegrationConnection[],
  connectedKeys: string[]
): boolean {
  const serviceConnections = getServiceConnections(service, connections);
  if (serviceConnections.length === 0) {
    return connectedKeys.includes(service.credKey);
  }

  return serviceConnections.some((connection) => connectedKeys.includes(connection.credentialKey));
}

export function getServiceMcpReady(
  service: ServiceEntry,
  connections: IntegrationConnection[],
  mcpServers: McpServerConfig[]
): boolean {
  const serviceConnections = getServiceConnections(service, connections);
  if (serviceConnections.length === 0) {
    return Boolean(_getLinkedMcpServer(service, mcpServers)?.enabled);
  }

  return serviceConnections.some((connection) =>
    Boolean(getLinkedMcpServerForConnection(service, connection, mcpServers)?.enabled)
  );
}

export function getServiceCapabilityIds(
  service: ServiceEntry,
  provider: IntegrationProviderDefinition | undefined
): string[] {
  const ids = new Set<string>((provider?.capabilities ?? []).map((capability) => capability.id));
  if (ids.size === 0) {
    ids.add(service.credKey);
  }
  return Array.from(ids).sort((left, right) => left.localeCompare(right));
}

export function getProviderSummaryText(
  service: ServiceEntry,
  provider: IntegrationProviderDefinition | undefined,
  connections: IntegrationConnection[]
): string {
  const connectionCount = getServiceConnectionCount(service, connections);
  const capabilityIds = getServiceCapabilityIds(service, provider);
  const getConnectionLabel = () => {
    if (connectionCount === 0) return "No connections";
    if (connectionCount === 1) return "1 connection";
    return `${connectionCount} connections`;
  };
  const connectionLabel = getConnectionLabel();
  const capabilityLabel =
    capabilityIds.length === 1
      ? `Capability: ${capabilityIds[0]}`
      : `${capabilityIds.length} capabilities`;
  return `${connectionLabel} · ${capabilityLabel}`;
}

export function getProviderCapabilityPreview(
  service: ServiceEntry,
  provider: IntegrationProviderDefinition | undefined
): string {
  const capabilityIds = getServiceCapabilityIds(service, provider);
  if (capabilityIds.length <= 2) return capabilityIds.join(" · ");
  return `${capabilityIds.slice(0, 2).join(" · ")} · +${capabilityIds.length - 2}`;
}

export function slugifyConnectionId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

export function getConnectionMcpServerName(
  service: ServiceEntry,
  connection: IntegrationConnection | null
): string {
  const metadataServerName = connection?.metadata?.assistantServerName;
  if (typeof metadataServerName === "string" && metadataServerName.trim().length > 0) {
    return metadataServerName;
  }

  const baseName = service.mcpConfig?.serverName ?? service.credKey;
  if (!connection) return baseName;
  if (connection.credentialKey === service.credKey) return baseName;

  const suffix = slugifyConnectionId(connection.id.split("::").pop() ?? connection.id);
  return `${baseName}-${suffix}`;
}

export function matchesLinkedMcpServer(service: ServiceEntry, serverName: string): boolean {
  return getLinkedServerNames(service).includes(serverName);
}

export function _getLinkedMcpServer(
  service: ServiceEntry,
  servers: McpServerConfig[]
): McpServerConfig | null {
  return servers.find((server) => matchesLinkedMcpServer(service, server.name)) ?? null;
}

export function getLinkedMcpServerForConnection(
  service: ServiceEntry,
  connection: IntegrationConnection | null,
  servers: McpServerConfig[]
): McpServerConfig | null {
  const serverName = getConnectionMcpServerName(service, connection);
  return servers.find((server) => server.name === serverName) ?? null;
}

export function buildLinkedMcpBindingsForCredentialKey(
  service: ServiceEntry,
  credentialKey: string
): {
  authHeader?: McpSecretValue;
  env: Record<string, McpSecretValue>;
} {
  const authBindings: { authHeader?: McpSecretValue; env: Record<string, McpSecretValue> } = {
    env: {},
  };

  for (const binding of service.mcpConfig?.credentialBindings ?? []) {
    const ref = buildCredentialReference(credentialKey, binding.sourceField, binding.template);
    if (binding.target.type === "authHeader") {
      authBindings.authHeader = ref;
      continue;
    }
    authBindings.env[binding.target.key] = ref;
  }

  return authBindings;
}

export function formatEditableEnvText(
  env: Record<string, McpSecretValue> | undefined,
  lockedKeys: Set<string>
): string {
  return Object.entries(env ?? {})
    .filter(([key, value]) => !lockedKeys.has(key) && typeof value === "string")
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export function parseEnvText(envText: string): { env?: Record<string, string>; error?: string } {
  const env: Record<string, string> = {};

  for (const rawLine of envText.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      return { error: 'Environment variables must use "KEY=VALUE" format.' };
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key) {
      return { error: 'Environment variables must use "KEY=VALUE" format.' };
    }

    env[key] = line.slice(separatorIndex + 1);
  }

  return Object.keys(env).length > 0 ? { env } : {};
}

export function createConnectionDraft(
  service: ServiceEntry,
  provider: IntegrationProviderDefinition | undefined,
  existingConnections: IntegrationConnection[]
): IntegrationConnection {
  const now = Math.floor(Date.now() / 1000);
  const isFirst = existingConnections.length === 0;
  const suffix = crypto.randomUUID();
  const id = isFirst ? `${service.credKey}::default` : `${service.credKey}::${suffix}`;
  const credentialKey = isFirst ? service.credKey : `connection::${service.credKey}::${suffix}`;

  return {
    id,
    provider: service.credKey,
    name: isFirst
      ? (service.auth.name ?? service.credKey)
      : `${service.auth.name ?? service.credKey} ${existingConnections.length + 1}`,
    credentialKey,
    enabled: true,
    isDefault: isFirst,
    source: "explicit",
    capabilities: provider?.capabilities.map((capability) => ({
      id: capability.id,
      enabled: capability.enabled,
      config: capability.config,
      resources: capability.resources,
    })) ?? [{ id: service.credKey, enabled: true }],
    metadata: isFirst
      ? undefined
      : {
          assistantServerName: getConnectionMcpServerName(service, {
            id,
            provider: service.credKey,
            name: "",
            credentialKey,
            enabled: true,
            isDefault: false,
            source: "explicit",
            capabilities: [],
            createdAt: now,
            updatedAt: now,
          }),
        },
    createdAt: now,
    updatedAt: now,
  };
}

export async function copyToClipboard(value: string): Promise<void> {
  const { copyText } = await import("@/lib/clipboard");
  await copyText(value);
}

export function pickEditableCredentialValues(
  values: Record<string, string> | null,
  fields: WidgetAuth["fields"]
): Record<string, string> {
  if (!values || !fields?.length) return {};
  return Object.fromEntries(
    fields
      .map((field) => [field.key, values[field.key]?.trim() ?? ""] as const)
      .filter(([, value]) => value.length > 0)
  );
}

export function buildMcpTestPayload(server: McpServerConfig) {
  return server.type === "stdio"
    ? {
        type: "stdio" as const,
        command: server.command,
        args: server.args,
        env: server.env,
        cwd: server.cwd,
      }
    : {
        type: "streamable-http" as const,
        url: server.url,
        authHeader: server.authHeader,
      };
}

export function getBindingLabel(service: ServiceEntry, sourceField: string): string {
  return service.auth.fields?.find((field) => field.key === sourceField)?.label ?? sourceField;
}

export function hasIntegrationAccessContent(service: ServiceEntry): boolean {
  return Boolean(
    (service.auth.type === "oauth" && service.auth.oauth && service.auth.fields) ||
      (service.auth.type === "api_key" && service.auth.fields) ||
      service.auth.type === "none" ||
      service.mcpConfig
  );
}

export function getVisibleIntegrationModalTabs(service: ServiceEntry): IntegrationModalTab[] {
  const tabs: IntegrationModalTab[] = [];

  if (hasIntegrationAccessContent(service)) {
    tabs.push("access");
  }

  tabs.push("data");
  tabs.push("events");
  return tabs;
}

export function getFirstIncompleteIntegrationTab(
  service: ServiceEntry,
  visibleTabs: IntegrationModalTab[],
  apiConfigured: boolean
): IntegrationModalTab | null {
  if (visibleTabs.includes("access") && service.auth.type !== "none" && !apiConfigured) {
    return "access";
  }

  return null;
}

export function resolveIntegrationModalTab(
  service: ServiceEntry,
  visibleTabs: IntegrationModalTab[],
  apiConfigured: boolean
): IntegrationModalTab {
  if (typeof window !== "undefined") {
    const stored = readStoredIntegrationModalTab(window.localStorage, service.credKey);
    if (visibleTabs.includes(stored)) {
      return stored;
    }
  }

  return (
    getFirstIncompleteIntegrationTab(service, visibleTabs, apiConfigured) ??
    visibleTabs[0] ??
    "access"
  );
}

export function getAssistantStatus(linkedServer: McpServerConfig | null): {
  label: string;
  className: string;
} {
  if (!linkedServer) {
    return { label: "Not configured", className: "border-border text-muted-foreground" };
  }

  if (!linkedServer.enabled) {
    return { label: "Inactive", className: "border-border text-muted-foreground" };
  }

  return { label: "Configured", className: "border-border text-foreground" };
}

export function buildInitialLinkedMcpDraft(
  service: ServiceEntry,
  linkedServer: McpServerConfig | null
): LinkedMcpDraft | null {
  const config = service.mcpConfig;

  if (!config) {
    if (linkedServer?.type === "stdio") {
      return {
        type: "stdio",
        enabled: linkedServer.enabled,
        command: linkedServer.command,
        argsText: (linkedServer.args ?? []).join("\n"),
        cwd: linkedServer.cwd ?? "",
        envText: formatEditableEnvText(linkedServer.env, new Set()),
        docsUrl: linkedServer.docsUrl ?? "",
      };
    }

    return {
      type: "streamable-http",
      enabled: linkedServer?.enabled ?? true,
      url: linkedServer?.type === "streamable-http" ? linkedServer.url : "",
      authHeader:
        linkedServer?.type === "streamable-http" && typeof linkedServer.authHeader === "string"
          ? linkedServer.authHeader
          : "",
      docsUrl: linkedServer?.docsUrl ?? "",
    };
  }

  const boundEnvKeys = new Set<string>();
  for (const binding of config.credentialBindings ?? []) {
    if (binding.target.type === "env") {
      boundEnvKeys.add(binding.target.key);
    }
  }

  if (config.transport.type === "stdio") {
    const current = linkedServer?.type === "stdio" ? linkedServer : null;
    return {
      type: "stdio",
      enabled: current?.enabled ?? true,
      command: current?.command ?? config.transport.command,
      argsText: (current?.args ?? config.transport.args ?? []).join("\n"),
      cwd: current?.cwd ?? config.transport.cwd ?? "",
      envText: formatEditableEnvText(current?.env ?? config.transport.env, boundEnvKeys),
      docsUrl: current?.docsUrl ?? config.docsUrl ?? "",
    };
  }

  const current = linkedServer?.type === "streamable-http" ? linkedServer : null;
  return {
    type: "streamable-http",
    enabled: current?.enabled ?? true,
    url: current?.url ?? config.transport.url,
    authHeader: typeof current?.authHeader === "string" ? current.authHeader : "",
    docsUrl: current?.docsUrl ?? config.docsUrl ?? "",
  };
}

export function buildLinkedMcpServer(
  service: ServiceEntry,
  connection: IntegrationConnection,
  draft: LinkedMcpDraft
): { ok: true; value: McpServerConfig } | { ok: false; error: string } {
  const config = service.mcpConfig;
  const bindings = config
    ? buildLinkedMcpBindingsForCredentialKey(service, connection.credentialKey)
    : { env: {} };

  if (draft.type === "stdio") {
    if (!draft.command.trim()) {
      return { ok: false, error: "Command is required for stdio MCP servers." };
    }

    const parsedEnv = parseEnvText(draft.envText);
    if (parsedEnv.error) return { ok: false, error: parsedEnv.error };

    const env = {
      ...(config?.transport.type === "stdio" ? (config.transport.env ?? {}) : {}),
      ...(parsedEnv.env ?? {}),
      ...bindings.env,
    };

    return {
      ok: true,
      value: {
        name: getConnectionMcpServerName(service, connection),
        type: "stdio",
        command: draft.command.trim(),
        args: draft.argsText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        env: Object.keys(env).length > 0 ? env : undefined,
        cwd: draft.cwd.trim() || undefined,
        docsUrl: draft.docsUrl.trim() || undefined,
        enabled: draft.enabled,
      },
    };
  }

  if (!draft.url.trim()) {
    return { ok: false, error: "URL is required for streamable HTTP MCP servers." };
  }

  return {
    ok: true,
    value: {
      name: getConnectionMcpServerName(service, connection),
      type: "streamable-http",
      url: draft.url.trim(),
      authHeader: bindings.authHeader ?? (draft.authHeader.trim() || undefined),
      docsUrl: draft.docsUrl.trim() || undefined,
      enabled: draft.enabled,
    },
  };
}
