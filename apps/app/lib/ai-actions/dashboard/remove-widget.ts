/**
 * Assistant action: remove a widget from a dashboard cell (leaving it empty),
 * targeting either a specific cell or the first cell holding a given widget.
 */
import type { WidgetLayoutConfig } from "@radarboard/types/database";
import {
  applyAssignments,
  DEFAULT_DASHBOARD_PAGE_SLUG,
  resolvePageTarget,
  sortCells,
} from "./shared";

export interface RemoveWidgetParams {
  projectSlug: string | null;
  pageSlug?: string;
  /** Remove whatever is in this cell. */
  cellId?: string;
  /** Or: remove the first cell holding this widget. */
  widgetId?: string;
}

export interface RemoveWidgetResult {
  removed: boolean;
  cellId?: string;
  widgetId?: string | null;
  pageSlug: string;
  config?: WidgetLayoutConfig;
  error?: string;
}

/** PURE: compute the config with the targeted cell cleared. */
export function clearWidget(
  config: WidgetLayoutConfig,
  params: RemoveWidgetParams
): RemoveWidgetResult {
  const pageSlug = params.pageSlug?.trim() || DEFAULT_DASHBOARD_PAGE_SLUG;
  const target = resolvePageTarget(config, params.projectSlug, params.pageSlug);
  const cells = sortCells(target.layout.cells);

  let cellId = params.cellId;
  if (!cellId) {
    if (!params.widgetId) {
      return {
        removed: false,
        pageSlug,
        error: "Provide either a cellId or a widgetId to remove.",
      };
    }
    const match = cells.find((c) => target.assignments[c.id] === params.widgetId);
    if (!match) {
      return {
        removed: false,
        pageSlug,
        error: `Widget "${params.widgetId}" is not on the "${pageSlug}" page.`,
      };
    }
    cellId = match.id;
  } else if (!cells.some((c) => c.id === cellId)) {
    return { removed: false, pageSlug, error: `Cell "${cellId}" is not part of this layout.` };
  }

  const previous = target.assignments[cellId] ?? null;
  if (!previous) {
    return {
      removed: false,
      cellId,
      widgetId: null,
      pageSlug,
      error: `Cell "${cellId}" is already empty.`,
    };
  }

  const nextAssignments = { ...target.assignments, [cellId]: null };
  return {
    removed: true,
    cellId,
    widgetId: previous,
    pageSlug,
    config: applyAssignments(config, target, nextAssignments),
  };
}

export async function executeRemoveWidget(params: RemoveWidgetParams): Promise<RemoveWidgetResult> {
  const { getSettingsRepo } = await import("@/data/core/repository");
  const repo = getSettingsRepo();
  const config = (await repo.getWidgetLayout()) ?? { configs: {} };
  const result = clearWidget(config, params);
  if (result.removed && result.config) {
    await repo.setWidgetLayout(result.config);
  }
  // Never leak the whole config back to the LLM.
  const { config: _omit, ...rest } = result;
  return rest;
}
