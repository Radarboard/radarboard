"use client";

import { useStore } from "@tanstack/react-store";
import { useCallback, useEffect } from "react";
import {
  loadSettings,
  settingsStore,
  updateProjectIntegrations,
} from "@/modules/settings/store/settings-store";

export type ProjectIntegrationsMap = Record<string, Record<string, Record<string, unknown>>>;
type ProjectIntegrationsUpdater = (current: ProjectIntegrationsMap) => ProjectIntegrationsMap;

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

  const updateIntegrations = useCallback(
    (configOrUpdater: ProjectIntegrationsMap | ProjectIntegrationsUpdater) => {
      const currentIntegrations = settingsStore.state.projectIntegrations;
      const next =
        typeof configOrUpdater === "function"
          ? configOrUpdater(currentIntegrations)
          : configOrUpdater;

      updateProjectIntegrations(next);
    },
    []
  );

  const updateIntegration = useCallback(
    (projectSlug: string, platformId: string, key: string, value: unknown) => {
      updateIntegrations((currentIntegrations) => ({
        ...currentIntegrations,
        [projectSlug]: {
          ...(currentIntegrations[projectSlug] ?? {}),
          [platformId]: {
            ...(currentIntegrations[projectSlug]?.[platformId] ?? {}),
            [key]: value,
          },
        },
      }));
    },
    [updateIntegrations]
  );

  const getIntegration = useCallback(
    (projectSlug: string, platformId: string, key: string) => {
      return integrations[projectSlug]?.[platformId]?.[key] ?? null;
    },
    [integrations]
  );

  return { integrations, isLoading, updateIntegrations, updateIntegration, getIntegration };
}
