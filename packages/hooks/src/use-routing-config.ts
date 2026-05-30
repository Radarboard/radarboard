"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { RoutingConfig } from "@radarboard/types/database";
import { useCallback } from "react";
import useSWR from "swr";
import { apiFetcher } from "./fetcher";

interface SettingsRoutingResponse {
  routingConfig?: RoutingConfig;
}

const EMPTY_ROUTING_CONFIG: RoutingConfig = {
  rules: [],
};

export function useRoutingConfig() {
  const { data, error, isLoading, mutate } = useSWR<SettingsRoutingResponse>(
    API_ROUTES.settings,
    apiFetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const saveRoutingConfig = useCallback(
    async (routingConfig: RoutingConfig) => {
      const res = await fetch(API_ROUTES.settings, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routingConfig }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save routing config: ${res.status}`);
      }

      await mutate();
    },
    [mutate]
  );

  return {
    routingConfig: data?.routingConfig ?? EMPTY_ROUTING_CONFIG,
    loading: isLoading,
    error: error?.message ?? null,
    saveRoutingConfig,
    refetch: mutate,
  };
}
