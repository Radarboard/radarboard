"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { useCallback } from "react";

/**
 * Extended demo mode hook with write access to dismiss demo mode.
 * Use this in app-level components (dashboard, settings, banner).
 * Widget hooks should use the read-only `useDemoMode` from `@radarboard/hooks/use-demo-mode`.
 */
export function useDemoModeActions() {
  const { preferences, updatePreferences } = useDashboard();
  const isDemoMode = preferences.demoMode === true;

  const dismissDemo = useCallback(async () => {
    try {
      await fetch(API_ROUTES.demoWipe, { method: "POST" });
    } catch {
      // Non-critical — preferences update below handles the UI state
    }
    updatePreferences({ ...preferences, demoMode: false });
  }, [preferences, updatePreferences]);

  return { isDemoMode, dismissDemo } as const;
}
