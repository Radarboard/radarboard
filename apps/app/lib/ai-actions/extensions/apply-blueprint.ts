/**
 * Server-side blueprint application for the AI assistant.
 *
 * Reads current settings, adds the blueprint's layout, assigns widgets
 * to cells, and persists via the settings repository.
 */

import type { LayoutDefinition } from "@radarboard/types/database";
import { applyBlueprint } from "@radarboard/widget-engine/blueprints/apply";
import { getBlueprintById } from "@radarboard/widget-engine/blueprints/registry";
import { generateCellId } from "@radarboard/widget-engine/layouts";

interface ApplyBlueprintParams {
  blueprintId: string;
  projectSlug: string | null;
  pageSlug: string;
}

interface ApplyBlueprintServerResult {
  applied: boolean;
  blueprintName: string;
  layoutId: string;
  widgetCount: number;
  missingIntegrations: string[];
  error?: string;
}

/**
 * Clone a layout with fresh cell IDs (server-side version).
 * Mirrors the client-side cloneLayoutWithFreshCellIds.
 */
function cloneLayoutForServer(layout: LayoutDefinition): LayoutDefinition {
  return {
    ...layout,
    id: crypto.randomUUID(),
    cells: layout.cells.map((cell) => ({ ...cell, id: generateCellId() })),
    colSizes: [...(layout.colSizes ?? [])],
    rowSizes: [...(layout.rowSizes ?? [])],
  };
}

export async function executeApplyBlueprint(
  params: ApplyBlueprintParams
): Promise<ApplyBlueprintServerResult> {
  const blueprint = getBlueprintById(params.blueprintId);
  if (!blueprint) {
    return {
      applied: false,
      blueprintName: "",
      layoutId: "",
      widgetCount: 0,
      missingIntegrations: [],
      error: `Blueprint "${params.blueprintId}" not found`,
    };
  }

  const result = applyBlueprint(blueprint, []);
  const newLayout = cloneLayoutForServer(result.layout);
  newLayout.name = blueprint.name;

  // Build cell ID mapping for widget assignments
  const remappedAssignments: Record<string, string | null> = {};
  for (let i = 0; i < blueprint.layout.cells.length; i++) {
    const sourceCell = blueprint.layout.cells[i];
    const newCell = newLayout.cells[i];
    if (sourceCell && newCell) {
      remappedAssignments[newCell.id] = result.widgetAssignments[sourceCell.id] ?? null;
    }
  }

  // Persist via settings repository
  const { getSettingsRepo } = await import("@/data/core/repository");
  const repo = getSettingsRepo();
  const widgetLayout = await repo.getWidgetLayout();
  const currentConfig = widgetLayout ?? { configs: {} };

  // Add layout to definitions
  const existingLayouts = currentConfig.layouts ?? [];
  const updatedLayouts = [...existingLayouts, newLayout];

  // Update widget assignments for the target project/page
  const ownerSlug = params.projectSlug ?? "__all__";
  const projectLayouts = currentConfig.projectLayouts ?? {};
  const projectConfig = projectLayouts[ownerSlug] ?? { pages: [] };
  const pages = projectConfig.pages ?? [];

  const pageIndex = pages.findIndex((p: { slug: string }) => p.slug === params.pageSlug);
  const existingPage =
    pageIndex >= 0 ? pages[pageIndex]! : { slug: params.pageSlug, name: params.pageSlug };

  const updatedPage = {
    ...existingPage,
    layoutId: newLayout.id,
    widgetLayouts: {
      ...(existingPage.widgetLayouts ?? {}),
      [newLayout.id]: remappedAssignments,
    },
  };

  const updatedPages = pageIndex >= 0 ? [...pages] : [...pages, updatedPage];
  if (pageIndex >= 0) {
    updatedPages[pageIndex] = updatedPage;
  }

  const updatedProjectLayouts: Record<string, typeof projectConfig> = {
    ...projectLayouts,
    [ownerSlug]: { ...projectConfig, pages: updatedPages },
  };

  await repo.setWidgetLayout({
    ...currentConfig,
    layouts: updatedLayouts,
    projectLayouts: updatedProjectLayouts,
  });

  return {
    applied: true,
    blueprintName: blueprint.name,
    layoutId: newLayout.id,
    widgetCount: blueprint.slots.length,
    missingIntegrations: result.missingIntegrations,
  };
}
