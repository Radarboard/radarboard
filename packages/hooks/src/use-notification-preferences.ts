"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { NotificationPreferenceRow } from "@radarboard/types/notifications";
import { useCallback } from "react";
import useSWR from "swr";
import { apiFetcher } from "./fetcher";

interface NotificationPreferencesResponse {
  preferences: NotificationPreferenceRow[];
}

export function useNotificationPreferences() {
  const { data, error, isLoading, mutate } = useSWR<NotificationPreferencesResponse>(
    API_ROUTES.notificationPreferences,
    apiFetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const savePreference = useCallback(
    async (preference: NotificationPreferenceRow) => {
      const res = await fetch(API_ROUTES.notificationPreferences, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preference),
      });

      if (!res.ok) {
        throw new Error(`Failed to save preference: ${res.status}`);
      }

      await mutate();
    },
    [mutate]
  );

  return {
    preferences: data?.preferences ?? [],
    loading: isLoading,
    error: error?.message ?? null,
    savePreference,
    refetch: mutate,
  };
}
