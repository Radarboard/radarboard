"use client";

import { useStore } from "@tanstack/react-store";
import { useCallback, useEffect } from "react";
import {
  loadSettings,
  settingsStore,
  updateProjectIntegrations,
} from "@/modules/settings/store/settings-store";

export type ProjectIntegrationsMap = Record<string, Record<string, Record<string, unknown>>>;

/**
 * Hook to read/write per-project integration overrides (e.g., GitHub repo assignments).
 * Stored in user_settings.project_integrations as JSON.
 */
export function useProjectIntegrations() {
  const integrations = useStore(settingsStore, (s) => s.projectIntegrations);
  const isLoading = useStore(settingsStore, (s) => s.isLoading);

  useEffect(() => {
    loadSettings().catch(() => {
      /* fire-and-forget */
    });
  }, []);

  const updateIntegration = useCallback(
    (projectSlug: string, platformId: string, key: string, value: unknown) => {
      const next = {
        ...integrations,
        [projectSlug]: {
          ...(integrations[projectSlug] ?? {}),
          [platformId]: {
            ...(integrations[projectSlug]?.[platformId] ?? {}),
            [key]: value,
          },
        },
      };

      updateProjectIntegrations(next);
    },
    [integrations]
  );

  const getIntegration = useCallback(
    (projectSlug: string, platformId: string, key: string) => {
      return integrations[projectSlug]?.[platformId]?.[key] ?? null;
    },
    [integrations]
  );

  return { integrations, isLoading, updateIntegration, getIntegration };
}
