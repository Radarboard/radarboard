/**
 * Client-safe registration of per-integration "REST Data" widgets.
 *
 * Kept free of any server/DB imports so it can run on the client (the dashboard
 * needs these descriptors registered to render placed `rest-<id>` widgets).
 */

import {
  registerWidget,
  unregisterWidget,
  WIDGET_REGISTRY,
} from "@radarboard/widget-engine/widgets/registry";
import { createRestWidgetDescriptor, restWidgetId } from "@radarboard/widget-generic-rest";

/** Register the dedicated widget for one integration if absent. Returns its widget id. */
export function ensureRestWidgetRegistered(integrationId: string, name?: string): string {
  const id = restWidgetId(integrationId);
  if (!WIDGET_REGISTRY.has(id)) {
    registerWidget(createRestWidgetDescriptor(integrationId, name));
  }
  return id;
}

/** Remove the dedicated widget for one integration. Returns its widget id. */
export function unregisterRestWidget(integrationId: string): string {
  const id = restWidgetId(integrationId);
  unregisterWidget(id);
  return id;
}

/**
 * Register a widget for every placed `rest-<id>` entry in a widget-layout's
 * `configs` map. Placed configs are self-describing (they carry `integrationId`
 * and an optional `name`), so the client can register renderable widgets without
 * a round-trip to fetch the integration list.
 */
export function registerPlacedRestWidgets(configs: Record<string, unknown> | undefined): void {
  if (!configs) return;
  for (const [widgetId, cfg] of Object.entries(configs)) {
    if (!widgetId.startsWith("rest-")) continue;
    const integrationId = widgetId.slice("rest-".length);
    if (!integrationId) continue;
    const name = (cfg as { name?: unknown } | null)?.name;
    ensureRestWidgetRegistered(integrationId, typeof name === "string" ? name : undefined);
  }
}
