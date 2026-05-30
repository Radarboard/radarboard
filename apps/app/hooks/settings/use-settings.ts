"use client";

import { useStore } from "@tanstack/react-store";
import { useEffect } from "react";
import {
  loadSettings,
  settingsStore,
  updateProjectIntegrations,
  updateProjectOrder,
  updateWidgetLayout,
} from "@/modules/settings/store/settings-store";

/**
 * Subscribes to persisted settings backed by settingsStore.
 * Triggers the initial API load on first mount (guarded — only fetches once globally).
 */
export function useSettings() {
  const projectOrder = useStore(settingsStore, (s) => s.projectOrder);
  const widgetLayout = useStore(settingsStore, (s) => s.widgetLayout);
  const projectIntegrations = useStore(settingsStore, (s) => s.projectIntegrations);
  const isLoading = useStore(settingsStore, (s) => s.isLoading);

  useEffect(() => {
    loadSettings().catch(() => {
      /* fire-and-forget */
    });
  }, []);

  return {
    projectOrder,
    widgetLayout,
    projectIntegrations,
    updateProjectOrder,
    updateWidgetLayout,
    updateProjectIntegrations,
    isLoading,
  };
}
