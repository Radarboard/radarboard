"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { NotificationRuleRow } from "@radarboard/types/notifications";
import { useCallback } from "react";
import useSWR from "swr";
import { apiFetcher } from "./fetcher";

interface NotificationRulesResponse {
  rules: NotificationRuleRow[];
}

export function useNotificationRules() {
  const { data, error, isLoading, mutate } = useSWR<NotificationRulesResponse>(
    API_ROUTES.notificationRules,
    apiFetcher,
    { revalidateOnFocus: false }
  );

  const saveRule = useCallback(
    async (rule: NotificationRuleRow) => {
      const res = await fetch(API_ROUTES.notificationRules, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      if (!res.ok) throw new Error(`Failed to save rule: ${res.status}`);
      await mutate();
    },
    [mutate]
  );

  const deleteRule = useCallback(
    async (id: string) => {
      const res = await fetch(API_ROUTES.notificationRules, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(`Failed to delete rule: ${res.status}`);
      await mutate();
    },
    [mutate]
  );

  return {
    rules: data?.rules ?? [],
    loading: isLoading,
    error: error?.message ?? null,
    saveRule,
    deleteRule,
    refetch: mutate,
  };
}
