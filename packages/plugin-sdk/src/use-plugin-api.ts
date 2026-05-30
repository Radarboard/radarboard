"use client";

import { createContext, useContext } from "react";
import type { PluginAPI } from "./types";

/** React context that provides the scoped PluginAPI to plugin components rendered inside PluginHost. */
export const PluginAPIContext = createContext<PluginAPI | null>(null);

/**
 * Access the PluginAPI inside a plugin component.
 *
 * Must be called within a `<PluginHost>` provider. Throws if used
 * outside the plugin context — this is intentional since plugins
 * should never render without the host.
 */
export function usePluginAPI(): PluginAPI {
  const api = useContext(PluginAPIContext);
  if (!api) {
    throw new Error(
      "usePluginAPI() must be used within a <PluginHost> provider. " +
        "Make sure the plugin component is rendered inside the plugin overlay."
    );
  }
  return api;
}
