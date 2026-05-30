import "@/lib/integrations-init";
import { INTEGRATION_REGISTRY } from "@radarboard/integration-sdk/registry";
import type {
  IntegrationConnection,
  IntegrationConnectionCapability,
  IntegrationConnectionsConfig,
} from "@radarboard/types/database";

export interface KnownIntegrationProvider {
  provider: string;
  name: string;
  capabilities: IntegrationConnectionCapability[];
}

function buildProviderDefinitions(): Map<string, KnownIntegrationProvider> {
  const definitions = new Map<string, KnownIntegrationProvider>();

  for (const descriptor of INTEGRATION_REGISTRY.values()) {
    const provider = descriptor.auth.id || descriptor.id;
    const existing = definitions.get(provider);
    const capability = { id: descriptor.id, enabled: true };

    if (existing) {
      if (!existing.capabilities.some((entry) => entry.id === descriptor.id)) {
        existing.capabilities.push(capability);
      }
      continue;
    }

    definitions.set(provider, {
      provider,
      name: descriptor.auth.name || descriptor.name,
      capabilities: [capability],
    });
  }

  return definitions;
}

const PROVIDER_DEFINITIONS = buildProviderDefinitions();

export function listKnownIntegrationProviders(): KnownIntegrationProvider[] {
  return Array.from(PROVIDER_DEFINITIONS.values()).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

function buildLegacyConnection(definition: KnownIntegrationProvider): IntegrationConnection {
  return {
    id: `${definition.provider}::default`,
    provider: definition.provider,
    name: definition.name,
    credentialKey: definition.provider,
    enabled: true,
    isDefault: true,
    source: "legacy",
    capabilities: definition.capabilities,
    createdAt: 0,
    updatedAt: 0,
  };
}

export function mergeConnectionsWithLegacy(
  explicitConnections: IntegrationConnectionsConfig,
  credentialKeys: string[]
): IntegrationConnectionsConfig {
  const explicitByProvider = new Set(explicitConnections.map((connection) => connection.provider));
  const merged = [...explicitConnections];

  for (const definition of listKnownIntegrationProviders()) {
    if (!credentialKeys.includes(definition.provider)) continue;
    if (explicitByProvider.has(definition.provider)) continue;
    merged.push(buildLegacyConnection(definition));
  }

  return merged.sort((left, right) => {
    if (left.provider !== right.provider) return left.provider.localeCompare(right.provider);
    if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}
