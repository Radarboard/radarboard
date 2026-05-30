import { Store } from "@tanstack/react-store";

/** Tracks the currently selected item for each active plugin. */
export interface PluginSelectionState {
  /** Map of pluginId -> itemId (e.g. entryId, noteId) */
  selections: Record<string, string | null>;
}

/** Global reactive store for plugin selection state, powered by TanStack Store. */
export const pluginStore = new Store<PluginSelectionState>({
  selections: {},
});

/**
 * Update the active selection for a specific plugin.
 * This is used to ensure instant focus when a row is clicked,
 * bypassing the async nature of URL updates.
 */
export function setPluginSelection(pluginId: string, itemId: string | null) {
  pluginStore.setState((state) => ({
    ...state,
    selections: {
      ...state.selections,
      [pluginId]: itemId,
    },
  }));
}
