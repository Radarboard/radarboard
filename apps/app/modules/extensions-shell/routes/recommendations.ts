import "@/lib/integrations-init";
import "@/lib/widgets-init";
import { getAllIntegrations } from "@radarboard/integration-sdk/registry";
import { checkDependenciesWithCredentials } from "@radarboard/integration-sdk/resolver";
import { createLogger } from "@radarboard/logger/logger";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { NextResponse } from "next/server";
import { getCredentialRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";
import {
  formatCapabilityLabel,
  getCanonicalWidgetMap,
  getCapabilityProvidingWidgets,
} from "@/lib/extensions/capability-governance";

const log = createLogger("api/extensions/recommendations");

interface Recommendation {
  extensionId: string;
  extensionType: "integration" | "plugin" | "widget";
  name: string;
  description: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

async function safeGetCredential(key: string): Promise<Record<string, string> | null> {
  try {
    return await getCredentialRepo().getCredential(key);
  } catch {
    return null;
  }
}

function collectWidgetRecommendations(configuredIds: Set<string>): Recommendation[] {
  const results: Recommendation[] = [];
  const integrations = getAllIntegrations();
  const integrationNames = new Map(
    integrations.map((integration) => [integration.id, integration.name])
  );

  for (const [, widget] of WIDGET_REGISTRY) {
    const capabilityMatches = getCapabilityProvidingWidgets(widget, configuredIds);
    if (capabilityMatches.length > 0) {
      const capabilityLabels = capabilityMatches.map(({ capability }) =>
        formatCapabilityLabel(capability.id)
      );
      const providerNames = capabilityMatches.flatMap(({ providers }) =>
        providers.map(
          (provider) => integrationNames.get(provider.integration) ?? provider.integration
        )
      );

      results.push({
        extensionId: widget.id,
        extensionType: "widget",
        name: widget.name,
        description: widget.description,
        reason: `${Array.from(new Set(providerNames)).join(", ")} provide ${Array.from(
          new Set(capabilityLabels)
        ).join(", ")} for this widget`,
        priority: "high",
      });
      continue;
    }

    const required = widget.requiredIntegrations ?? [];
    if (required.length === 0) continue;

    const satisfied = required.filter((id) => configuredIds.has(id as string));
    if (satisfied.length === required.length) {
      results.push({
        extensionId: widget.id,
        extensionType: "widget",
        name: widget.name,
        description: widget.description,
        reason: `All required integrations configured (${required.join(", ")})`,
        priority: "high",
      });
    } else if (satisfied.length > 0) {
      const missing = required.filter((id) => !configuredIds.has(id as string));
      results.push({
        extensionId: widget.id,
        extensionType: "widget",
        name: widget.name,
        description: widget.description,
        reason: `Configure ${missing.join(", ")} to unlock this widget`,
        priority: "medium",
      });
    }
  }
  return results;
}

function collectIntegrationRecommendations(
  integrations: ReturnType<typeof getAllIntegrations>,
  configuredIds: Set<string>
): Recommendation[] {
  const results: Recommendation[] = [];
  const canonicalByCapability = getCanonicalWidgetMap(
    Array.from(WIDGET_REGISTRY.values()) as Parameters<typeof getCanonicalWidgetMap>[0]
  );

  for (const integration of integrations.filter((i) => !configuredIds.has(i.id))) {
    const canonicalMatches = (integration.capabilities ?? []).flatMap((capability) => {
      const owner = canonicalByCapability.get(capability.id);
      return owner ? [{ capability, owner }] : [];
    });

    if (canonicalMatches.length > 0) {
      const capabilityLabels = canonicalMatches.map(({ capability }) =>
        formatCapabilityLabel(capability.id)
      );
      const widgetNames = canonicalMatches.map(({ owner }) => owner.widget.name);

      results.push({
        extensionId: integration.id,
        extensionType: "integration",
        name: integration.name,
        description: integration.description,
        reason: `Provides ${Array.from(new Set(capabilityLabels)).join(", ")} for ${Array.from(
          new Set(widgetNames)
        ).join(", ")}`,
        priority: "high",
      });
      continue;
    }

    let unlockCount = 0;
    for (const [, widget] of WIDGET_REGISTRY) {
      if ((widget.requiredIntegrations ?? []).includes(integration.id as never)) unlockCount++;
    }
    if (unlockCount > 0) {
      results.push({
        extensionId: integration.id,
        extensionType: "integration",
        name: integration.name,
        description: integration.description,
        reason: `Would unlock ${unlockCount} widget${unlockCount > 1 ? "s" : ""}`,
        priority: unlockCount >= 3 ? "high" : "low",
      });
    }
  }
  return results;
}

export async function handleGetExtensionRecommendations() {
  try {
    const integrations = getAllIntegrations();
    const integrationIds = integrations.map((i) => i.id);
    const statuses = await checkDependenciesWithCredentials(integrationIds, safeGetCredential);
    const configuredIds = new Set(statuses.filter((s) => s.configured).map((s) => s.integrationId));

    const recommendations: Recommendation[] = [
      ...collectWidgetRecommendations(configuredIds),
      ...collectIntegrationRecommendations(integrations, configuredIds),
    ];

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort(
      (a, b) =>
        priorityOrder[a.priority] - priorityOrder[b.priority] || a.name.localeCompare(b.name)
    );

    return NextResponse.json({ recommendations });
  } catch (err) {
    log.error("Failed to compute recommendations", { error: err });
    return errorJson(500, err instanceof Error ? err.message : "Failed to compute recommendations");
  }
}
