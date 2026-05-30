"use client";

import { createContext, useContext } from "react";

/**
 * Layout mode the plugin is currently rendered in.
 * - "fullscreen": full overlay taking most of the viewport
 * - "drawer": narrow side-panel sliding from the right
 */
export type LayoutMode = "fullscreen" | "drawer";

export const LayoutContext = createContext<LayoutMode>("fullscreen");

/** Returns the current layout mode — "fullscreen" or "drawer". */
export function useLayoutMode(): LayoutMode {
  return useContext(LayoutContext);
}
