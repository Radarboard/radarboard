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

  const wipeDemo = useCallback(async (mode: "connect" | "fresh") => {
    try {
      await fetch(API_ROUTES.demoWipe, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
    } catch {
      // Non-critical — preferences update below handles the UI state
    }
  }, []);

  const connectRealData = useCallback(async () => {
    await wipeDemo("connect");
    updatePreferences({ ...preferences, demoMode: false });
  }, [preferences, updatePreferences, wipeDemo]);

  const startFresh = useCallback(async () => {
    await wipeDemo("fresh");
    updatePreferences({
      ...preferences,
      demoMode: false,
      onboardingCompleted: false,
      userProfile: null,
      intendedIntegrations: [],
      blueprintWidgetMap: {},
    });
  }, [preferences, updatePreferences, wipeDemo]);

  return { isDemoMode, connectRealData, startFresh } as const;
}
