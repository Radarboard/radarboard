import type { LayoutDefinition } from "@radarboard/types/database";
import { getSortedCells } from "@radarboard/widget-engine/layouts";

export function getVisibleCellIds(layout: LayoutDefinition): string[] {
  return getSortedCells(layout.cells).map((cell) => cell.id);
}

export function getWidgetToVisibleCellIdMap(
  widgetLayout: Record<string, string | null>,
  visibleCellIds: string[]
): Map<string, string> {
  const map = new Map<string, string>();

  for (const cellId of visibleCellIds) {
    const widgetId = widgetLayout[cellId];
    if (widgetId) {
      map.set(widgetId, cellId);
    }
  }

  return map;
}

export function placeWidgetInVisibleCells(
  layout: Record<string, string | null>,
  widgetId: string,
  visibleCellIds: string[],
  preferredCellId: string | null
): Record<string, string | null> {
  const nextLayout = { ...layout };
  const targetCellId =
    preferredCellId && visibleCellIds.includes(preferredCellId)
      ? preferredCellId
      : (visibleCellIds.find((cellId) => !nextLayout[cellId]) ?? visibleCellIds[0] ?? null);

  if (!targetCellId) {
    return nextLayout;
  }

  const occupant = nextLayout[targetCellId];
  if (occupant) {
    const emptyCellId = visibleCellIds.find(
      (cellId) => cellId !== targetCellId && !nextLayout[cellId]
    );
    if (emptyCellId) {
      nextLayout[emptyCellId] = occupant;
    }
  }

  nextLayout[targetCellId] = widgetId;
  return nextLayout;
}

export function getPreferredCellId(visibleCellIds: string[], preferredSlot: string): string | null {
  const slotIndex = Number.parseInt(preferredSlot.replace("slot", ""), 10) - 1;
  return Number.isFinite(slotIndex) ? (visibleCellIds[slotIndex] ?? null) : null;
}
