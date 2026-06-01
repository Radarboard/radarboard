import { DATA_SOURCE_REGISTRY, getAllIntegrations } from "@radarboard/integration-sdk/registry";
import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import type {
  CapabilityId,
  CapabilityProviderRef,
  WidgetCapability,
} from "@radarboard/types/extension";
import { getAllWidgets } from "@radarboard/widget-engine/widgets/registry";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";

export interface CapabilityAudit {
  level: "warn" | "error";
  code:
    | "missing-provider-action"
    | "duplicate-canonical-widget"
    | "missing-canonical-widget"
    | "missing-canonical-provider";
  message: string;
  capabilityId?: CapabilityId;
  integrationId?: string;
  widgetId?: string;
}

const CAPABILITY_LABELS: Record<CapabilityId, string> = {
  revenue: "Revenue",
  bookmarks: "Bookmarks",
  stars: "GitHub Stars",
  domains: "Vercel Domains",
  errors: "Errors",
  uptime: "Uptime",
  "app-reviews": "App Reviews",
  downloads: "Downloads",
  sponsorship: "Sponsorship",
  shipping: "Release Activity",
  analytics: "Analytics",
  seo: "SEO",
};

export function formatCapabilityLabel(capabilityId: CapabilityId): string {
  return CAPABILITY_LABELS[capabilityId];
}

export function getCanonicalWidgetMap(
  widgets: WidgetDescriptor[]
): Map<CapabilityId, { widget: WidgetDescriptor; capability: WidgetCapability }> {
  const canonical = new Map<
    CapabilityId,
    { widget: WidgetDescriptor; capability: WidgetCapability }
  >();

  for (const widget of widgets) {
    for (const capability of widget.capabilities ?? []) {
      if (capability.role !== "canonical") continue;
      canonical.set(capability.id, { widget, capability });
    }
  }

  return canonical;
}

function hasProviderAction(provider: CapabilityProviderRef): boolean {
  return DATA_SOURCE_REGISTRY.has(`${provider.integration}/${provider.action}`);
}

function hasRegisteredProviderIntegration(provider: CapabilityProviderRef): boolean {
  if (getAllIntegrations().some((integration) => integration.id === provider.integration)) {
    return true;
  }

  const prefix = `${provider.integration}/`;
  return Array.from(DATA_SOURCE_REGISTRY.keys()).some((key) => key.startsWith(prefix));
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: governance checks intentionally compare canonical, registered, and provider-advertised capabilities together.
export function auditCapabilityGovernance(
  integrations: IntegrationDescriptor[],
  widgets: WidgetDescriptor[]
): CapabilityAudit[] {
  const audits: CapabilityAudit[] = [];
  const canonicalOwners = new Map<CapabilityId, string>();
  const canonicalMap = getCanonicalWidgetMap(widgets);

  for (const widget of widgets) {
    for (const capability of widget.capabilities ?? []) {
      if (capability.role === "canonical") {
        const existingOwner = canonicalOwners.get(capability.id);
        if (existingOwner && existingOwner !== widget.id) {
          audits.push({
            level: "error",
            code: "duplicate-canonical-widget",
            capabilityId: capability.id,
            widgetId: widget.id,
            message: `Capability "${capability.id}" is claimed as canonical by both "${existingOwner}" and "${widget.id}".`,
          });
        } else {
          canonicalOwners.set(capability.id, widget.id);
        }
      }

      for (const provider of capability.providers) {
        if (!hasRegisteredProviderIntegration(provider)) {
          continue;
        }

        if (!hasProviderAction(provider)) {
          audits.push({
            level: "error",
            code: "missing-provider-action",
            capabilityId: capability.id,
            widgetId: widget.id,
            integrationId: provider.integration,
            message: `Widget "${widget.id}" capability "${capability.id}" references missing provider "${provider.integration}/${provider.action}".`,
          });
        }
      }
    }
  }

  for (const integration of integrations) {
    for (const capability of integration.capabilities ?? []) {
      const canonicalOwner = canonicalMap.get(capability.id);
      if (!canonicalOwner) {
        audits.push({
          level: "warn",
          code: "missing-canonical-widget",
          capabilityId: capability.id,
          integrationId: integration.id,
          message: `Integration "${integration.id}" declares capability "${capability.id}" but no canonical widget owns it.`,
        });
        continue;
      }

      const providerMatch = canonicalOwner.capability.providers.some(
        (provider) =>
          provider.integration === integration.id && provider.action === capability.action
      );

      if (!providerMatch) {
        audits.push({
          level: "warn",
          code: "missing-canonical-provider",
          capabilityId: capability.id,
          integrationId: integration.id,
          widgetId: canonicalOwner.widget.id,
          message: `Canonical widget "${canonicalOwner.widget.id}" does not list "${integration.id}/${capability.action}" for capability "${capability.id}".`,
        });
      }
    }
  }

  return audits.sort((left, right) => left.message.localeCompare(right.message));
}

export function getCapabilityProvidingWidgets(
  widget: WidgetDescriptor,
  configuredIds: Set<string>
): Array<{ capability: WidgetCapability; providers: CapabilityProviderRef[] }> {
  const matches: Array<{ capability: WidgetCapability; providers: CapabilityProviderRef[] }> = [];

  for (const capability of widget.capabilities ?? []) {
    const providers = capability.providers.filter((provider) =>
      configuredIds.has(provider.integration)
    );
    if (providers.length > 0) {
      matches.push({ capability, providers });
    }
  }

  return matches;
}

export function getRegisteredCapabilityGovernanceState(): {
  integrations: IntegrationDescriptor[];
  widgets: WidgetDescriptor[];
} {
  return {
    integrations: getAllIntegrations(),
    widgets: getAllWidgets(),
  };
}
