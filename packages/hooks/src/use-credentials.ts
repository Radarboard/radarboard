"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import useSWR from "swr";
import { apiFetcher } from "./fetcher";

interface CredentialsResponse {
  connectedKeys: string[];
}

export function useCredentials() {
  const { data, error, isLoading, mutate } = useSWR<CredentialsResponse>(
    API_ROUTES.credentials,
    apiFetcher,
    { refreshInterval: 0 } // No polling -- only refreshes on mutation
  );

  return {
    connectedKeys: data?.connectedKeys ?? [],
    loading: isLoading,
    error: error?.message ?? null,
    refetch: () => mutate(),
  };
}
