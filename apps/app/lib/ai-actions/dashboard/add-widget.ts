/**
 * Assistant action: place a registered widget into a dashboard cell.
 */
import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import type { WidgetLayoutConfig } from "@radarboard/types/database";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { canPlaceWidgetInScope, type DashboardScope } from "@radarboard/widget-sdk/dashboard-scope";
import {
  applyAssignments,
  DEFAULT_DASHBOARD_PAGE_SLUG,
  resolvePageTarget,
  sortCells,
} from "./shared";

export interface AddWidgetParams {
  widgetId: string;
  projectSlug: string | null;
  pageSlug?: string;
  /** Target cell; when omitted, the first empty cell is used. */
  cellId?: string;
}

export interface PlaceWidgetResult {
  ok: boolean;
  error?: string;
  config?: WidgetLayoutConfig;
  cellId?: string;
  /** Widget that previously occupied the cell, if any (null when it was empty). */
  replaced?: string | null;
}

/** PURE: compute the config with `widgetId` placed. Registry validation is the caller's job. */
export function placeWidget(
  config: WidgetLayoutConfig,
  params: AddWidgetParams
): PlaceWidgetResult {
  const target = resolvePageTarget(config, params.projectSlug, params.pageSlug);
  const cells = sortCells(target.layout.cells);

  let cellId = params.cellId;
  if (cellId) {
    if (!cells.some((c) => c.id === cellId)) {
      return {
        ok: false,
        error: `Cell "${cellId}" is not part of the "${target.layout.name}" layout.`,
      };
    }
  } else {
    const empty = cells.find((c) => !target.assignments[c.id]);
    if (!empty) {
      return {
        ok: false,
        error: `The "${target.layout.name}" layout is full — remove a widget or pass a cellId to replace one.`,
      };
    }
    cellId = empty.id;
  }

  const replaced = target.assignments[cellId] ?? null;
  const nextAssignments = { ...target.assignments, [cellId]: params.widgetId };
  return { ok: true, config: applyAssignments(config, target, nextAssignments), cellId, replaced };
}

export interface AddWidgetResult {
  added: boolean;
  widgetId: string;
  cellId?: string;
  replaced?: string | null;
  pageSlug: string;
  error?: string;
}

export async function executeAddWidget(params: AddWidgetParams): Promise<AddWidgetResult> {
  const pageSlug = params.pageSlug?.trim() || DEFAULT_DASHBOARD_PAGE_SLUG;
  const descriptor = WIDGET_REGISTRY.get(params.widgetId);
  if (!descriptor) {
    return {
      added: false,
      widgetId: params.widgetId,
      pageSlug,
      error: `Unknown widget "${params.widgetId}". Call list_widgets to see valid widget IDs.`,
    };
  }

  const scope: DashboardScope =
    !params.projectSlug || params.projectSlug === ALL_PROJECTS_SLUG ? "all-projects" : "project";
  if (!canPlaceWidgetInScope(descriptor, scope)) {
    return {
      added: false,
      widgetId: params.widgetId,
      pageSlug,
      error: `Widget "${params.widgetId}" can't be placed in the ${scope} view.`,
    };
  }

  const { getSettingsRepo } = await import("@/data/core/repository");
  const repo = getSettingsRepo();
  const config = (await repo.getWidgetLayout()) ?? { configs: {} };
  const result = placeWidget(config, { ...params, pageSlug });
  if (!result.ok || !result.config) {
    return { added: false, widgetId: params.widgetId, pageSlug, error: result.error };
  }

  await repo.setWidgetLayout(result.config);
  return {
    added: true,
    widgetId: params.widgetId,
    cellId: result.cellId,
    replaced: result.replaced,
    pageSlug,
  };
}

// ---------------------------------------------------------------------------
// Move — relocate a placed widget to another cell (same page), swapping.
// ---------------------------------------------------------------------------

export interface MoveWidgetParams {
  widgetId: string;
  toCellId: string;
  projectSlug: string | null;
  pageSlug?: string;
}

export interface MoveWidgetResult {
  moved: boolean;
  widgetId: string;
  fromCellId?: string;
  toCellId?: string;
  /** Widget displaced from the target cell (swapped back to the source), if any. */
  swapped?: string | null;
  pageSlug: string;
  config?: WidgetLayoutConfig;
  error?: string;
}

/** PURE: move `widgetId` to `toCellId`, swapping with any occupant. */
export function moveWidget(config: WidgetLayoutConfig, params: MoveWidgetParams): MoveWidgetResult {
  const pageSlug = params.pageSlug?.trim() || DEFAULT_DASHBOARD_PAGE_SLUG;
  const target = resolvePageTarget(config, params.projectSlug, params.pageSlug);
  const cells = sortCells(target.layout.cells);

  if (!cells.some((c) => c.id === params.toCellId)) {
    return {
      moved: false,
      widgetId: params.widgetId,
      pageSlug,
      error: `Cell "${params.toCellId}" is not part of this layout.`,
    };
  }

  const fromCell = cells.find((c) => target.assignments[c.id] === params.widgetId);
  if (!fromCell) {
    return {
      moved: false,
      widgetId: params.widgetId,
      pageSlug,
      error: `Widget "${params.widgetId}" is not on the "${pageSlug}" page.`,
    };
  }
  if (fromCell.id === params.toCellId) {
    return {
      moved: false,
      widgetId: params.widgetId,
      fromCellId: fromCell.id,
      toCellId: params.toCellId,
      pageSlug,
      error: "Widget is already in that cell.",
    };
  }

  const occupant = target.assignments[params.toCellId] ?? null;
  const nextAssignments = {
    ...target.assignments,
    [fromCell.id]: occupant, // swap the occupant back (or null)
    [params.toCellId]: params.widgetId,
  };

  return {
    moved: true,
    widgetId: params.widgetId,
    fromCellId: fromCell.id,
    toCellId: params.toCellId,
    swapped: occupant,
    pageSlug,
    config: applyAssignments(config, target, nextAssignments),
  };
}

export async function executeMoveWidget(params: MoveWidgetParams): Promise<MoveWidgetResult> {
  const { getSettingsRepo } = await import("@/data/core/repository");
  const repo = getSettingsRepo();
  const config = (await repo.getWidgetLayout()) ?? { configs: {} };
  const result = moveWidget(config, params);
  if (result.moved && result.config) {
    await repo.setWidgetLayout(result.config);
  }
  const { config: _omit, ...rest } = result;
  return rest;
}
