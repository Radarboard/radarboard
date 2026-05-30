import type { DataSourceDescriptor, IntegrationDescriptor } from "./types";

/** Global registry of all registered integration descriptors, keyed by integration ID. */
export const INTEGRATION_REGISTRY = new Map<string, IntegrationDescriptor>();

type RegistryDataSourceDescriptor = DataSourceDescriptor<Record<string, unknown>, unknown>;

/**
 * Registry mapping `"integration/action"` to data-source descriptors.
 * Populated automatically from integration descriptors and directly for virtual integrations.
 */
export const DATA_SOURCE_REGISTRY = new Map<string, RegistryDataSourceDescriptor>();

function dataSourceKey(integration: string, action: string): string {
  return `${integration}/${action}`;
}

const MAX_DESCRIPTION_LENGTH = 120;

/**
 * Register an integration descriptor. Call once per integration at app startup.
 * Validates uniqueness, description length, and auto-populates the data source registry.
 */
export function registerIntegration(descriptor: IntegrationDescriptor): void {
  if (INTEGRATION_REGISTRY.has(descriptor.id)) {
    throw new Error(
      `Integration "${descriptor.id}" is already registered. Each integration ID must be unique.`
    );
  }
  if (descriptor.description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(
      `Integration "${descriptor.id}" description exceeds ${MAX_DESCRIPTION_LENGTH} characters (${descriptor.description.length}). Keep it concise for the onboarding and settings UI.`
    );
  }

  if (descriptor.dataSources) {
    const seenActions = new Set<string>();
    for (const ds of descriptor.dataSources) {
      if (seenActions.has(ds.action)) {
        throw new Error(
          `Integration "${descriptor.id}" has duplicate data source action "${ds.action}".`
        );
      }
      seenActions.add(ds.action);
    }
  }

  INTEGRATION_REGISTRY.set(descriptor.id, descriptor);

  // Auto-populate the data-source registry from the descriptor.
  if (descriptor.dataSources) {
    for (const ds of descriptor.dataSources) {
      const key = dataSourceKey(descriptor.id, ds.action);
      DATA_SOURCE_REGISTRY.set(key, ds);
    }
  }
}

/**
 * Register data sources for virtual integrations that don't have a full
 * IntegrationDescriptor (e.g. "shipping" aggregates Linear + GitHub + Vercel).
 */
export function registerDataSources(
  integration: string,
  dataSources: RegistryDataSourceDescriptor[]
): void {
  for (const ds of dataSources) {
    const key = dataSourceKey(integration, ds.action);
    DATA_SOURCE_REGISTRY.set(key, ds);
  }
}

/** Look up a data source by integration ID and action slug. */
export function findDataSource(
  integration: string,
  action: string
): RegistryDataSourceDescriptor | undefined {
  return DATA_SOURCE_REGISTRY.get(dataSourceKey(integration, action));
}

/** Get a registered integration by ID, or undefined if not found. */
export function getIntegration(id: string): IntegrationDescriptor | undefined {
  return INTEGRATION_REGISTRY.get(id);
}

/** Get all registered integration descriptors. */
export function getAllIntegrations(): IntegrationDescriptor[] {
  return Array.from(INTEGRATION_REGISTRY.values());
}
