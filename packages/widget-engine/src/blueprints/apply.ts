/**
 * Blueprint application — pure functions that resolve a blueprint into
 * a layout definition + widget assignment map.
 */

import type { ApplyBlueprintResult, LayoutBlueprintDescriptor } from "./types";

/**
 * Apply a blueprint as a fresh layout (no existing widgets).
 * Returns the layout + widget assignments + any missing integrations.
 */
export function applyBlueprint(
  blueprint: LayoutBlueprintDescriptor,
  connectedIntegrations: string[]
): ApplyBlueprintResult {
  const widgetAssignments: Record<string, string | null> = {};
  const filledCells: string[] = [];

  for (const cell of blueprint.layout.cells) {
    widgetAssignments[cell.id] = null;
  }

  for (const slot of blueprint.slots) {
    widgetAssignments[slot.cellId] = slot.widgetId;
    filledCells.push(slot.cellId);
  }

  const missingIntegrations = blueprint.requiredIntegrations.filter(
    (i) => !connectedIntegrations.includes(i)
  );

  return {
    layout: blueprint.layout,
    widgetAssignments,
    missingIntegrations,
    keptWidgets: [],
    filledCells,
    skippedDuplicates: [],
  };
}

/**
 * Smart-merge a blueprint into an existing layout with widgets.
 *
 * Rules:
 * 1. Cells that already have a widget → keep the existing widget.
 * 2. Empty cells → assign the blueprint's suggested widget, unless
 *    that widget is already placed in another cell (skip duplicates).
 * 3. Report missing integrations for all assigned widgets.
 */
export function smartMergeBlueprint(
  blueprint: LayoutBlueprintDescriptor,
  existingAssignments: Record<string, string | null>,
  connectedIntegrations: string[]
): ApplyBlueprintResult {
  const widgetAssignments: Record<string, string | null> = { ...existingAssignments };
  const keptWidgets: string[] = [];
  const filledCells: string[] = [];
  const skippedDuplicates: string[] = [];

  // Collect all widget IDs already placed (both existing and newly assigned)
  const placedWidgets = new Set<string>();
  for (const widgetId of Object.values(widgetAssignments)) {
    if (widgetId) placedWidgets.add(widgetId);
  }

  for (const slot of blueprint.slots) {
    const currentWidget = widgetAssignments[slot.cellId];

    if (currentWidget) {
      // Cell already has a widget — keep it
      keptWidgets.push(currentWidget);
      continue;
    }

    // Cell is empty — check if the blueprint's suggestion is already placed
    if (placedWidgets.has(slot.widgetId)) {
      skippedDuplicates.push(slot.widgetId);
      continue;
    }

    // Assign the blueprint's widget to the empty cell
    widgetAssignments[slot.cellId] = slot.widgetId;
    placedWidgets.add(slot.widgetId);
    filledCells.push(slot.cellId);
  }

  const missingIntegrations = blueprint.requiredIntegrations.filter(
    (i) => !connectedIntegrations.includes(i)
  );

  return {
    layout: blueprint.layout,
    widgetAssignments,
    missingIntegrations,
    keptWidgets,
    filledCells,
    skippedDuplicates,
  };
}
