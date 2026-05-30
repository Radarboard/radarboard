"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import { EmptyState } from "@radarboard/ui/empty-state";
import { useCallback, useEffect, useState } from "react";
import {
  DebugBadge,
  DebugCell,
  DebugRow,
  DebugSection,
  DebugTable,
  LoadingState,
  SectionHeader,
  StatStrip,
} from "../../shared";

interface CacheEntry {
  key: string;
  route: string;
  fetchedAt: number; // unix seconds
  ttlSeconds: number;
}

function expiresIn(fetchedAt: number, ttlSeconds: number): { label: string; expired: boolean } {
  const expiresAt = (fetchedAt + ttlSeconds) * 1000;
  const diff = expiresAt - Date.now();
  if (diff <= 0) return { label: "Expired", expired: true };
  const s = Math.floor(diff / 1000);
  if (s < 60) return { label: `${s}s`, expired: false };
  const m = Math.floor(s / 60);
  if (m < 60) return { label: `${m}m`, expired: false };
  return { label: `${Math.floor(m / 60)}h`, expired: false };
}

function formatTs(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function CacheSection() {
  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(API_ROUTES.debugCache);
    if (res.ok) {
      const data = (await res.json()) as { entries: CacheEntry[] };
      setEntries(data.entries ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => {
      /* fire-and-forget */
    });
  }, [load]);

  const expired = entries.filter((e) => expiresIn(e.fetchedAt, e.ttlSeconds).expired).length;
  const live = entries.length - expired;

  // Group by route
  const routes = [...new Set(entries.map((e) => e.route))];

  return (
    <DebugSection>
      <StatStrip
        stats={[
          { label: "Total entries", value: entries.length.toString() },
          { label: "Live", value: live.toString() },
          { label: "Expired", value: expired.toString() },
          { label: "Routes", value: routes.length.toString() },
        ]}
      />

      <SectionHeader label={`${entries.length} cache entries`} onRefresh={load} />

      {Boolean(loading) && <LoadingState />}
      {!loading && entries.length === 0 && (
        <EmptyState message="No cache entries. Widget data will be cached here after the first fetch." />
      )}
      {!loading && entries.length > 0 && (
        <DebugTable headers={["Key", "Route", "Fetched at", "TTL", "Expires in"]}>
          {entries.map((e) => {
            const { label, expired: isExpired } = expiresIn(e.fetchedAt, e.ttlSeconds);
            return (
              <DebugRow key={e.key}>
                <DebugCell className="max-w-sidebar truncate font-mono text-muted-foreground text-w-sm">
                  {e.key}
                </DebugCell>
                <DebugCell>
                  <DebugBadge variant="muted">{e.route}</DebugBadge>
                </DebugCell>
                <DebugCell className="text-dim">{formatTs(e.fetchedAt)}</DebugCell>
                <DebugCell className="text-dim">{e.ttlSeconds}s</DebugCell>
                <DebugCell className={isExpired ? "text-destructive" : "text-success"}>
                  {label}
                </DebugCell>
              </DebugRow>
            );
          })}
        </DebugTable>
      )}
    </DebugSection>
  );
}
