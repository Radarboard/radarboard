type IntegrationDescriptor = {
  id: string;
  dataSources?: Array<{
    action: string;
  }>;
};

export const INTEGRATION_REGISTRY = new Map<string, IntegrationDescriptor>();
export const DATA_SOURCE_REGISTRY = new Map<string, { action: string }>();

function dataSourceKey(integration: string, action: string): string {
  return `${integration}/${action}`;
}

export function registerIntegration(descriptor: IntegrationDescriptor): void {
  INTEGRATION_REGISTRY.set(descriptor.id, descriptor);

  if (descriptor.dataSources) {
    for (const ds of descriptor.dataSources) {
      DATA_SOURCE_REGISTRY.set(dataSourceKey(descriptor.id, ds.action), ds);
    }
  }
}

export function getIntegration(id: string): IntegrationDescriptor | undefined {
  return INTEGRATION_REGISTRY.get(id);
}

export function getAllIntegrations(): IntegrationDescriptor[] {
  return Array.from(INTEGRATION_REGISTRY.values());
}

export function registerDataSources(
  integration: string,
  dataSources: Array<{
    action: string;
  }>
): void {
  for (const ds of dataSources) {
    DATA_SOURCE_REGISTRY.set(dataSourceKey(integration, ds.action), ds);
  }
}

export function findDataSource(
  integration: string,
  action: string
):
  | {
      action: string;
    }
  | undefined {
  return DATA_SOURCE_REGISTRY.get(dataSourceKey(integration, action));
}
