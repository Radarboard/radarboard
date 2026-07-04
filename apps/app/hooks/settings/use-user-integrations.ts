"use client";

import { API_ROUTES, userIntegrationRoute } from "@radarboard/types/api-routes";
import { useCallback } from "react";
import useSWR from "swr";

export interface UserIntegrationSummary {
  id: string;
  name: string;
  category: string;
  baseUrl: string;
  dataSourceActions: string[];
}

interface UserIntegrationsResponse {
  integrations: UserIntegrationSummary[];
}

async function apiFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

/**
 * Loads the user-created (no-code) REST integrations and exposes a `remove`
 * mutation. Backed by `/api/system/user-integrations`, which shares the same
 * executors as the assistant/MCP tools.
 */
export function useUserIntegrations() {
  const { data, error, isLoading, mutate } = useSWR<UserIntegrationsResponse>(
    API_ROUTES.userIntegrations,
    apiFetcher,
    { refreshInterval: 0 }
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const res = await fetch(userIntegrationRoute(id), { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to remove integration (${res.status})`);
      }
      await mutate();
    },
    [mutate]
  );

  return {
    integrations: data?.integrations ?? [],
    loading: isLoading,
    error: error?.message ?? null,
    refetch: () => mutate(),
    remove,
  };
}
