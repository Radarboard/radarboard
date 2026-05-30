"use client";

import { useHealth } from "@radarboard/widget-observability";
import { useEffect } from "react";
import { isTauri } from "@/lib/platform";

/**
 * Hook that synchronizes the application health status with the Tauri system tray.
 * Only runs when in Tauri environment.
 */
export function useTauriHealthSync() {
  const { checks, incidents, configured, loading, error } = useHealth();

  useEffect(() => {
    if (!isTauri() || loading || !configured) return;

    const syncHealth = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");

        const criticalIncidents = incidents;
        const downChecks = checks.filter((c) => c.status === "down");

        const isHealthy = criticalIncidents.length === 0 && downChecks.length === 0;

        let message = "All systems operational";
        if (!isHealthy) {
          message = `${criticalIncidents.length} incidents, ${downChecks.length} checks down`;
        } else if (error) {
          message = `Health sync error: ${error}`;
        }

        await invoke("update_health_status", {
          isHealthy,
          message,
        });
      } catch (_err) {
        // Ignore desktop tray sync failures so the dashboard health view keeps rendering.
      }
    };

    syncHealth();
  }, [checks, incidents, configured, loading, error]);
}
