/**
 * Assistant action: propose the highest-value next setup steps — widgets that
 * are ready to add (their integrations are connected) and integrations worth
 * connecting (they'd unlock widgets).
 */

import { getDashboardConfigOwnerSlug } from "@radarboard/hooks/dashboard-layout";
import { getAllIntegrations } from "@radarboard/integration-sdk/registry";
import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import type { WidgetLayoutConfig } from "@radarboard/types/database";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import type { DashboardScope } from "@radarboard/widget-sdk/dashboard-scope";

export interface SetupSuggestion {
  type: "connect_integration" | "add_widget";
  id: string;
  name: string;
  reason: string;
  requiredIntegrations?: string[];
}

interface WidgetInfo {
  id: string;
  name: string;
  requiredIntegrations: string[];
  scopes: DashboardScope[];
}

interface IntegrationInfo {
  id: string;
  name: string;
  provider: string;
}

export interface ComputeSuggestionsInput {
  widgets: WidgetInfo[];
  integrations: IntegrationInfo[];
  connectedProviders: Set<string>;
  placedWidgetIds: Set<string>;
  scope: DashboardScope;
}

/** PURE: rank the next best setup steps. Widgets first (ready ones), then integrations that unlock the most. */
export function computeSetupSuggestions(input: ComputeSuggestionsInput): SetupSuggestion[] {
  const providerOf = (req: string): { provider: string; name: string } => {
    const match = input.integrations.find((i) => i.id === req || i.provider === req);
    return { provider: match?.provider ?? req, name: match?.name ?? req };
  };

  const ready: SetupSuggestion[] = [];
  const unlocks = new Map<string, { name: string; widgets: string[] }>();

  for (const widget of input.widgets) {
    if (input.placedWidgetIds.has(widget.id)) continue;
    if (!widget.scopes.includes(input.scope)) continue;

    const missing = widget.requiredIntegrations.filter(
      (req) => !input.connectedProviders.has(providerOf(req).provider)
    );

    if (missing.length === 0) {
      ready.push({
        type: "add_widget",
        id: widget.id,
        name: widget.name,
        reason:
          widget.requiredIntegrations.length === 0
            ? "Core widget — no setup needed."
            : `Ready — ${widget.requiredIntegrations.join(", ")} connected.`,
        requiredIntegrations: widget.requiredIntegrations,
      });
      continue;
    }

    for (const req of missing) {
      const { provider, name } = providerOf(req);
      const entry = unlocks.get(provider) ?? { name, widgets: [] };
      entry.widgets.push(widget.name);
      unlocks.set(provider, entry);
    }
  }

  const connectSuggestions: SetupSuggestion[] = [...unlocks.entries()]
    .sort((a, b) => b[1].widgets.length - a[1].widgets.length)
    .map(([provider, { name, widgets }]) => ({
      type: "connect_integration" as const,
      id: provider,
      name,
      reason: `Unlocks ${widgets.slice(0, 3).join(", ")}${widgets.length > 3 ? ` +${widgets.length - 3} more` : ""}.`,
    }));

  return [...ready, ...connectSuggestions];
}

/** Collect widget IDs already placed on the owner's pages. */
export function collectPlacedWidgetIds(
  config: WidgetLayoutConfig,
  projectSlug: string | null
): Set<string> {
  const ownerSlug = getDashboardConfigOwnerSlug(projectSlug);
  const placed = new Set<string>();
  const pages = config.projectLayouts?.[ownerSlug]?.pages ?? [];
  for (const page of pages) {
    for (const assignments of Object.values(page.widgetLayouts ?? {})) {
      for (const widgetId of Object.values(assignments)) {
        if (widgetId) placed.add(widgetId);
      }
    }
  }
  return placed;
}

export interface SuggestSetupResult {
  connectedProviders: string[];
  onDashboard: string[];
  suggestions: SetupSuggestion[];
}

export async function executeSuggestSetup(params: {
  projectSlug: string | null;
}): Promise<SuggestSetupResult> {
  const { getSettingsRepo, getCredentialRepo } = await import("@/data/core/repository");

  const [config, connectedKeys] = await Promise.all([
    getSettingsRepo().getWidgetLayout(),
    getCredentialRepo().listCredentialKeys(),
  ]);
  const connectedProviders = new Set(connectedKeys);
  const layoutConfig: WidgetLayoutConfig = config ?? { configs: {} };
  const placedWidgetIds = collectPlacedWidgetIds(layoutConfig, params.projectSlug);

  const widgets: WidgetInfo[] = [...WIDGET_REGISTRY.values()].map((d) => ({
    id: d.id,
    name: d.name,
    requiredIntegrations: [...(d.requiredIntegrations ?? [])] as string[],
    scopes: d.supportedDashboardScopes ?? ["all-projects", "project"],
  }));
  const integrations: IntegrationInfo[] = getAllIntegrations().map((d) => ({
    id: d.id,
    name: d.name,
    provider: d.auth.provider ?? d.auth.id,
  }));

  const scope: DashboardScope =
    !params.projectSlug || params.projectSlug === ALL_PROJECTS_SLUG ? "all-projects" : "project";

  return {
    connectedProviders: connectedKeys,
    onDashboard: [...placedWidgetIds],
    suggestions: computeSetupSuggestions({
      widgets,
      integrations,
      connectedProviders,
      placedWidgetIds,
      scope,
    }),
  };
}
