"use client";

import { getEffectivePollingInterval, type PollingSourceId } from "@radarboard/types/polling";
import { useContext } from "react";
import { DashboardContext } from "./use-dashboard";

export function usePollingInterval(sourceId: PollingSourceId): number {
  const preferences = useContext(DashboardContext)?.pollingPreferences;
  return getEffectivePollingInterval(sourceId, preferences);
}
