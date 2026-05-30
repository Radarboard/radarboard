"use client";

import { useContext } from "react";
import { DashboardContext } from "./use-dashboard";

/**
 * Read-only hook to check if demo mode is active.
 * Safe to use in widget hooks and outside DashboardProvider
 * (returns `isDemoMode: false` when no provider is available).
 */
export function useDemoMode() {
  const context = useContext(DashboardContext);
  const isDemoMode = context?.preferences?.demoMode === true;
  return { isDemoMode } as const;
}
