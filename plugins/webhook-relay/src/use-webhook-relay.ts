"use client";

import { getPluginToken } from "@radarboard/plugin-sdk/host";
import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { API_ROUTES, pluginDataRoute } from "@radarboard/types/api-routes";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RelayEventSummary, RelayStats } from "./types";

const EVENTS_KEY = "relay-events";
const STATS_KEY = "relay-stats";
const MAX_STORED_EVENTS = 200;
const SYNC_INTERVAL_MS = 15_000;

export function useWebhookRelay(api: PluginAPI) {
  const [events, setEvents] = useState<RelayEventSummary[]>([]);
  const [stats, setStats] = useState<RelayStats | null>(null);
  const [loaded, setLoaded] = useState(false);
  const eventsRef = useRef<RelayEventSummary[]>([]);

  const loadFromDb = useCallback(async () => {
    const [storedEvents, storedStats] = await Promise.all([
      api.db.get<RelayEventSummary[]>(EVENTS_KEY),
      api.db.get<RelayStats>(STATS_KEY),
    ]);
    const ev = storedEvents ?? [];
    eventsRef.current = ev;
    setEvents(ev);
    setStats(storedStats);
    setLoaded(true);
  }, [api.db]);

  useEffect(() => {
    loadFromDb().catch(() => {
      /* fire-and-forget */
    });
    const interval = window.setInterval(
      () =>
        loadFromDb().catch(() => {
          /* fire-and-forget */
        }),
      SYNC_INTERVAL_MS
    );
    return () => window.clearInterval(interval);
  }, [loadFromDb]);

  const clearEvents = useCallback(async () => {
    await api.db.delete(EVENTS_KEY);
    await api.db.delete(STATS_KEY);
    eventsRef.current = [];
    setEvents([]);
    setStats(null);
    api.notify("Relay events cleared", "success");
  }, [api]);

  return { events, stats, loaded, clearEvents, refresh: loadFromDb };
}

/**
 * Append relay events to plugin DB and update stats.
 * Called from the bridge (relay poller → plugin data).
 */
async function _persistRelayEvents(
  events: RelayEventSummary[],
  pollStatus: "connected" | "unconfigured" | "error"
): Promise<void> {
  if (events.length === 0 && pollStatus === "connected") return;

  const pluginId = "webhook-relay";

  try {
    const token = await getPluginToken(pluginId);
    const res = await fetch(pluginDataRoute(pluginId, EVENTS_KEY), {
      headers: { "X-Plugin-Token": token },
    });
    let existing: RelayEventSummary[] = [];
    if (res.ok) {
      const data = (await res.json()) as { value?: string | null };
      existing = data.value ? (JSON.parse(data.value) as RelayEventSummary[]) : [];
    }

    const merged = [...events, ...existing].slice(0, MAX_STORED_EVENTS);

    const byIntegration: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    for (const ev of merged) {
      byIntegration[ev.integration] = (byIntegration[ev.integration] ?? 0) + 1;
      bySeverity[ev.severity] = (bySeverity[ev.severity] ?? 0) + 1;
    }

    const newStats: RelayStats = {
      totalEvents: merged.length,
      byIntegration,
      bySeverity,
      lastEventAt: merged[0]?.receivedAt ?? null,
      pollStatus,
    };

    const authHeaders = {
      "Content-Type": "application/json",
      "X-Plugin-Token": token,
    };
    await Promise.all([
      fetch(API_ROUTES.pluginData, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ pluginId, key: EVENTS_KEY, value: JSON.stringify(merged) }),
      }),
      fetch(API_ROUTES.pluginData, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ pluginId, key: STATS_KEY, value: JSON.stringify(newStats) }),
      }),
    ]);
  } catch {
    // Best-effort — don't break the poll cycle
  }
}
