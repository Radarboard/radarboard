/**
 * Assistant action: render a REST integration's data on the dashboard.
 *
 * Each integration gets its OWN dedicated "REST Data" widget (`rest-<id>`), so
 * several no-code integrations can render side by side with independent field
 * mappings. This builds the config from a simple field spec (KPIs + optional
 * list), ensures the per-integration widget is registered, then configures and
 * places it in one step — the last rung of the ladder.
 */

import { restWidgetId } from "@radarboard/widget-generic-rest";
import { kpiRow, list } from "@radarboard/widget-sdk/section-helpers";

const SRC = "generic-rest";

/** Display format for a mapped value (mirrors the template engine's DataSourceFormat). */
export type FieldFormat =
  | "currency"
  | "number"
  | "percent"
  | "date"
  | "relative-time"
  | "duration-seconds";

export interface RestWidgetMetric {
  label: string;
  /** Dot-path into the response JSON, e.g. "stats.activeUsers". */
  field: string;
  format?: FieldFormat;
}

export interface RestWidgetList {
  /** Dot-path to the array, e.g. "items". */
  field: string;
  /** Field on each item for the title. */
  title: string;
  subtitle?: string;
  emptyMessage?: string;
}

export interface PlaceRestWidgetParams {
  integrationId: string;
  /** Display name for the widget (defaults to the integration id). */
  name?: string;
  action?: string;
  metrics?: RestWidgetMetric[];
  list?: RestWidgetList;
  projectSlug?: string | null;
  pageSlug?: string;
  cellId?: string;
}

export interface PlaceRestWidgetResult {
  placed: boolean;
  widgetId: string;
  dashboardChanged?: boolean;
  error?: string;
}

/** Build the generic-rest widget config (sections + integration binding) from a spec. */
export function buildGenericRestConfig(params: PlaceRestWidgetParams): Record<string, unknown> {
  const sections = [
    ...(params.metrics?.length
      ? [
          kpiRow(
            SRC,
            params.metrics.map((m) => ({ label: m.label, field: m.field, format: m.format }))
          ),
        ]
      : []),
    ...(params.list
      ? [
          list(SRC, params.list.field, {
            title: params.list.title,
            subtitle: params.list.subtitle,
            emptyMessage: params.list.emptyMessage ?? "No items",
          }),
        ]
      : []),
  ];

  return {
    dataSources: [{ id: SRC }],
    integrationId: params.integrationId,
    dataSourceAction: params.action ?? "data",
    sections,
    expandedSections: sections,
  };
}

/** Sentinel variant id for a REST Data widget's active binding. */
export const REST_BINDING_VARIANT_ID = "rest-binding";

/**
 * Build the per-instance widget config. The template config is stored as a
 * CUSTOM VARIANT (with `activeVariant` set) because the widget render pipeline
 * only applies a variant config or the descriptor default — arbitrary top-level
 * fields are dropped. `name` stays at the top level for client-side descriptor
 * registration from the placed layout.
 */
export function buildRestWidgetInstanceConfig(
  params: PlaceRestWidgetParams
): Record<string, unknown> {
  return {
    ...(params.name ? { name: params.name } : {}),
    activeVariant: REST_BINDING_VARIANT_ID,
    customVariants: [
      { id: REST_BINDING_VARIANT_ID, name: "REST binding", config: buildGenericRestConfig(params) },
    ],
  };
}

export async function executePlaceRestWidget(
  params: PlaceRestWidgetParams
): Promise<PlaceRestWidgetResult> {
  const integrationId = params.integrationId?.trim();
  if (!integrationId) {
    return { placed: false, widgetId: "", error: "integrationId is required." };
  }
  const widgetId = restWidgetId(integrationId);
  if (!params.metrics?.length && !params.list) {
    return {
      placed: false,
      widgetId,
      error: "Provide at least one metric or a list mapping so the widget has something to show.",
    };
  }

  // Ensure the integration's dedicated widget exists before configuring/placing.
  const { ensureRestWidgetRegistered } = await import("@/lib/integrations/rest-widget-registry");
  ensureRestWidgetRegistered(integrationId, params.name);

  const config = buildRestWidgetInstanceConfig(params);

  const { executeConfigureWidget } = await import("@/lib/ai-actions/dashboard/configure-widget");
  const configured = await executeConfigureWidget({ widgetId, config, mode: "replace" });
  if (!configured.configured) {
    return { placed: false, widgetId, error: configured.error };
  }

  const { executeAddWidget } = await import("@/lib/ai-actions/dashboard/add-widget");
  const added = await executeAddWidget({
    widgetId,
    projectSlug: params.projectSlug ?? null,
    pageSlug: params.pageSlug ?? "overview",
    cellId: params.cellId,
  });
  if (!added.added) {
    // Config was saved; surface the placement failure but note it's configured.
    return { placed: false, widgetId, error: added.error };
  }

  return { placed: true, widgetId, dashboardChanged: true };
}
