"use client";

/**
 * useSelectedItem
 *
 * Use this hook in any widget sub-component that receives an externally
 * controlled `selectedId` prop and needs to resolve it to a local item value.
 *
 * Replaces the repeated useEffect + useState pair that every detail-list
 * component previously duplicated:
 *
 *   const [selected, setSelected] = useState<T | null>(null);
 *   useEffect(() => {
 *     if (selectedId === undefined) return;
 *     setSelected(selectedId === null ? null : itemMap.get(selectedId) ?? null);
 *   }, [selectedId, itemMap]);
 *
 * Do NOT inline those hooks in widget files — use this hook instead.
 *
 * @param selectedId - The externally controlled selected item ID.
 *   - `undefined` means "uncontrolled / no URL state" — returns null without
 *     touching the internal state.
 *   - `null` means "nothing selected".
 *   - A string means "look up this ID in the map".
 * @param itemMap - A Map from ID string to item. Typically built with useMemo.
 * @returns The currently selected item, or null.
 */

import { useEffect, useState } from "react";

export function useSelectedItem<T>(
  selectedId: string | null | undefined,
  itemMap: Map<string, T>
): T | null {
  const [selected, setSelected] = useState<T | null>(null);

  useEffect(() => {
    if (selectedId === undefined) return;
    if (selectedId === null) {
      setSelected(null);
    } else {
      setSelected(itemMap.get(selectedId) ?? null);
    }
  }, [selectedId, itemMap]);

  return selected;
}
