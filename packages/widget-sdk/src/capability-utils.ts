import type {
  CapabilityId,
  CapabilityProviderRef,
  WidgetCapability,
} from "@radarboard/types/extension";
import type { Project } from "@radarboard/types/project";
import type { WidgetDescriptor } from "./widget-types";

function toCamelCase(input: string): string {
  return input.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

export function getProjectIntegrationKeyCandidates(integrationId: string): string[] {
  const camelCase = toCamelCase(integrationId);
  return camelCase === integrationId ? [integrationId] : [integrationId, camelCase];
}

export function getWidgetCapability(
  descriptor: Pick<WidgetDescriptor, "capabilities">,
  capabilityId: CapabilityId
): WidgetCapability | null {
  return descriptor.capabilities?.find((capability) => capability.id === capabilityId) ?? null;
}

export function isCapabilityProviderConnected(
  projects: Project[],
  projectSlug: string | null,
  provider: CapabilityProviderRef
): boolean {
  if (!projectSlug) return true;

  const project = projects.find((entry) => entry.slug === projectSlug);
  if (!project) return false;

  const keys = getProjectIntegrationKeyCandidates(provider.integration);
  return project.platforms.some((platform) =>
    keys.some((key) => Boolean(platform.integrations[key]))
  );
}

export function getConnectedCapabilityProviders(
  capability: WidgetCapability | null,
  projects: Project[],
  projectSlug: string | null
): CapabilityProviderRef[] {
  if (!capability) return [];
  return capability.providers.filter((provider) =>
    isCapabilityProviderConnected(projects, projectSlug, provider)
  );
}

export function resolveCapabilityProvider(
  capability: WidgetCapability | null,
  projects: Project[],
  projectSlug: string | null,
  preferredIntegrationId?: string | null
): CapabilityProviderRef | null {
  if (!capability || capability.providers.length === 0) return null;

  if (preferredIntegrationId) {
    const preferred = capability.providers.find(
      (provider) => provider.integration === preferredIntegrationId
    );
    if (preferred) return preferred;
  }

  const connected = getConnectedCapabilityProviders(capability, projects, projectSlug);
  if (connected.length === 1) return connected[0] ?? null;
  if (connected.length > 1) return connected[0] ?? null;
  return capability.providers[0] ?? null;
}
