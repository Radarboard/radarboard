/**
 * Assistant action: list registered widgets so the AI knows what it can add,
 * what each needs, and where it can go.
 */
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";

export interface WidgetSummary {
  id: string;
  name: string;
  description: string;
  /** Integrations this widget needs data from (may be empty for core widgets). */
  requiredIntegrations: string[];
  /** Scopes this widget can be placed in ("all-projects", "project"). */
  scopes: string[];
  catalogCategory?: string;
}

export interface ListWidgetsResult {
  widgets: WidgetSummary[];
  count: number;
}

export function executeListWidgets(): ListWidgetsResult {
  const widgets: WidgetSummary[] = [];
  for (const descriptor of WIDGET_REGISTRY.values()) {
    widgets.push({
      id: descriptor.id,
      name: descriptor.name,
      description: descriptor.description,
      requiredIntegrations: descriptor.requiredIntegrations ?? [],
      scopes: descriptor.supportedDashboardScopes ?? ["all-projects", "project"],
      catalogCategory: descriptor.catalogCategory,
    });
  }
  widgets.sort((a, b) => a.name.localeCompare(b.name));
  return { widgets, count: widgets.length };
}
