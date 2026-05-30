"use client";

import { useContext } from "react";
import { DashboardContext } from "./use-dashboard";

const DEFAULT_TIMEZONE = "UTC";

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function detectBrowserTimeZone(): string {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return detected && isValidTimeZone(detected) ? detected : DEFAULT_TIMEZONE;
}

export function useEffectiveTimeZone(): string {
  return useContext(DashboardContext)?.effectiveTimezone ?? detectBrowserTimeZone();
}
