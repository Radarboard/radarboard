"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { IntegrationConnection } from "@radarboard/types/database";
import { useCallback } from "react";
import useSWR from "swr";

export interface IntegrationProviderDefinition {
  provider: string;
  name: string;
  capabilities: Array<{
    id: string;
    enabled: boolean;
    config?: Record<string, unknown>;
    resources?: Record<string, unknown>;
  }>;
}

interface IntegrationConnectionsResponse {
  connections: IntegrationConnection[];
  providers: IntegrationProviderDefinition[];
}

async function apiFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export function useIntegrationConnections() {
  const { data, error, isLoading, mutate } = useSWR<IntegrationConnectionsResponse>(
    API_ROUTES.integrationConnections,
    apiFetcher,
    { refreshInterval: 0 }
  );

  const addOrUpdate = useCallback(
    async (
      connection: Omit<IntegrationConnection, "source" | "createdAt" | "updatedAt"> & {
        source?: IntegrationConnection["source"];
        createdAt?: number;
        updatedAt?: number;
      }
    ): Promise<void> => {
      const res = await fetch(API_ROUTES.integrationConnections, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(connection),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to save connection (${res.status})`);
      }

      await mutate();
    },
    [mutate]
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const res = await fetch(API_ROUTES.integrationConnections, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to delete connection (${res.status})`);
      }

      await mutate();
    },
    [mutate]
  );

  return {
    connections: data?.connections ?? [],
    providers: data?.providers ?? [],
    loading: isLoading,
    error: error?.message ?? null,
    refetch: () => mutate(),
    addOrUpdate,
    remove,
  };
}
