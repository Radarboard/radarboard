"use client";

import { detectBrowserLocale } from "@radarboard/utils/format-date-time";
import { useContext } from "react";
import { DashboardContext } from "./use-dashboard";

export function useEffectiveLocale(): string {
  return useContext(DashboardContext)?.effectiveLocale ?? detectBrowserLocale();
}
