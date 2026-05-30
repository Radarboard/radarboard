"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { WebhookEndpointRow } from "@radarboard/types/notifications";
import { useCallback } from "react";
import useSWR from "swr";
import { apiFetcher } from "./fetcher";

interface WebhookEndpointsResponse {
  endpoints: Omit<WebhookEndpointRow, "secret">[];
}

export function useWebhookEndpoints() {
  const { data, error, isLoading, mutate } = useSWR<WebhookEndpointsResponse>(
    API_ROUTES.notificationWebhooks,
    apiFetcher,
    { revalidateOnFocus: false }
  );

  const saveEndpoint = useCallback(
    async (endpoint: WebhookEndpointRow) => {
      const res = await fetch(API_ROUTES.notificationWebhooks, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(endpoint),
      });
      if (!res.ok) throw new Error(`Failed to save webhook endpoint: ${res.status}`);
      await mutate();
    },
    [mutate]
  );

  const deleteEndpoint = useCallback(
    async (id: string) => {
      const res = await fetch(API_ROUTES.notificationWebhooks, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(`Failed to delete webhook endpoint: ${res.status}`);
      await mutate();
    },
    [mutate]
  );

  const testEndpoint = useCallback(async (id: string) => {
    const res = await fetch(API_ROUTES.notificationWebhooksTest, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      status: number | null;
      endpointName?: string;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error ?? `Failed to test webhook endpoint: ${res.status}`);
    }
    return data;
  }, []);

  return {
    endpoints: data?.endpoints ?? [],
    loading: isLoading,
    error: error?.message ?? null,
    saveEndpoint,
    deleteEndpoint,
    testEndpoint,
    refetch: mutate,
  };
}
