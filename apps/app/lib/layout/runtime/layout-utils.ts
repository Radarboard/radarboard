/**
 * Pure utility functions for widget layout manipulation.
 *
 * Kept separate from React components so they can be unit-tested
 * without any rendering overhead.
 */

/**
 * Swap the widgets between two grid slots in a layout map.
 *
 * - If `sourceSlot === targetSlot`, the original layout is returned unchanged.
 * - If the target slot is empty, the source widget moves there and the source becomes null.
 * - If both slots have widgets, they are swapped.
 * - All other slots are unaffected.
 *
 * @param layout   The current slot → widgetId mapping.
 * @param sourceSlot  The slot being dragged from.
 * @param targetSlot  The slot being dropped onto.
 * @returns A new layout object with the swap applied (never mutates the input).
 */
export function swapWidgetSlots(
  layout: Record<string, string | null>,
  sourceSlot: string,
  targetSlot: string
): Record<string, string | null> {
  if (sourceSlot === targetSlot) return layout;

  const newLayout = { ...layout };
  const sourceWidget = newLayout[sourceSlot] ?? null;
  const targetWidget = newLayout[targetSlot] ?? null;

  newLayout[sourceSlot] = targetWidget;
  newLayout[targetSlot] = sourceWidget;

  return newLayout;
}
