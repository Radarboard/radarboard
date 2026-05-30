"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import { useRoutingConfig } from "@radarboard/hooks/use-routing-config";
import { getPluginToken } from "@radarboard/plugin-sdk/host";
import { pluginDataRoute } from "@radarboard/types/api-routes";
import type { TimeRange } from "@radarboard/types/dashboard";
import type { ShippingSource } from "@radarboard/types/shipping";
import { filterByProject, resolveProjectName } from "@radarboard/utils/project-helpers";
import { resolveRoutingSurfaceAccess } from "@radarboard/utils/routing";
import { isDateInTimeRange } from "@radarboard/utils/timezone";
import { useHealth } from "@radarboard/widget-observability";
import { useShipping } from "@radarboard/widget-shipping";
import { AlertTriangle, ExternalLink } from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";

interface BottomTickerProps {
  projectSlug: string | null;
}

type TickerSource = ShippingSource | "rss";

interface TickerActivityItem {
  id: string;
  title: string;
  projectName: string;
  projectColor: string;
  source: TickerSource;
  url?: string;
  createdAt: string;
  timeAgo: string;
}

const SOURCE_LABELS: Record<TickerSource, string> = {
  github: "GH",
  linear: "LN",
  vercel: "VC",
  manual: "—",
  rss: "RS",
};

const SOURCE_CLASSES: Record<TickerSource, string> = {
  github: "ticker-pill-github",
  linear: "ticker-pill-linear",
  vercel: "ticker-pill-vercel",
  manual: "ticker-pill-manual",
  rss: "ticker-pill-rss",
};

const TICKER_SPEED_MS: Record<string, number> = {
  slow: 90000,
  normal: 60000,
  fast: 30000,
};

const STATUS_PAGE_SYNC_MS = 15_000;
const MIN_TICKER_ITEMS_PER_HALF = 8;
const TICKER_EVENT_TYPES: Record<Extract<TickerSource, "github" | "linear" | "vercel">, string> = {
  github: "pr.merged",
  linear: "issue.completed",
  vercel: "deploy.succeeded",
};

interface StatusPageTickerSource {
  id: string;
  kind: "standalone" | "integration";
  name: string;
  status: "operational" | "degraded" | "outage" | "unknown";
  muted?: boolean;
  disabled?: boolean;
}

interface HealthAlertItem {
  id: string;
  label: string;
  tone: "critical" | "warning";
}

interface RssTickerItemRecord {
  id: string;
  feedId: string;
  title: string;
  link: string;
  publishedAt: string;
  read: boolean;
}

interface RssTickerFeedRecord {
  id: string;
  name: string;
}

async function loadStatusPageTickerSources(): Promise<StatusPageTickerSource[]> {
  const token = await getPluginToken("status-page");
  const response = await fetch(pluginDataRoute("status-page", "status:cache"), {
    headers: { "X-Plugin-Token": token },
  });
  if (!response.ok) return [];

  const data = (await response.json()) as { value?: string | null };
  if (!data.value) return [];

  return JSON.parse(data.value) as StatusPageTickerSource[];
}

async function loadStatusPageTickerEnabled(): Promise<boolean> {
  const token = await getPluginToken("status-page");
  const response = await fetch(pluginDataRoute("status-page", "_config"), {
    headers: { "X-Plugin-Token": token },
  });
  if (!response.ok) return true;

  const data = (await response.json()) as { value?: string | null };
  if (!data.value) return true;

  const config = JSON.parse(data.value) as { tickerIntegrationEnabled?: boolean };
  return config.tickerIntegrationEnabled ?? true;
}

function formatTimeAgo(value: string): string {
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds}s`;
  if (deltaSeconds < 3600) return `${Math.floor(deltaSeconds / 60)}m`;
  if (deltaSeconds < 86_400) return `${Math.floor(deltaSeconds / 3600)}h`;
  return `${Math.floor(deltaSeconds / 86_400)}d`;
}

async function loadRssTickerEnabled(): Promise<boolean> {
  const token = await getPluginToken("rss-reader");
  const response = await fetch(pluginDataRoute("rss-reader", "_config"), {
    headers: { "X-Plugin-Token": token },
  });
  if (!response.ok) return true;

  const data = (await response.json()) as { value?: string | null };
  if (!data.value) return true;

  const config = JSON.parse(data.value) as { tickerIntegrationEnabled?: boolean };
  return config.tickerIntegrationEnabled ?? true;
}

async function loadRssTickerItems(
  timeRange: TimeRange,
  timeZone: string
): Promise<TickerActivityItem[]> {
  const rssToken = await getPluginToken("rss-reader");
  const rssHeaders = { "X-Plugin-Token": rssToken };
  const [enabled, itemsResponse, feedsResponse] = await Promise.all([
    loadRssTickerEnabled(),
    fetch(pluginDataRoute("rss-reader", "rss:items"), { headers: rssHeaders }),
    fetch(pluginDataRoute("rss-reader", "rss:feeds"), { headers: rssHeaders }),
  ]);

  if (!enabled || !itemsResponse.ok || !feedsResponse.ok) return [];

  const itemsData = (await itemsResponse.json()) as { value?: string | null };
  const feedsData = (await feedsResponse.json()) as { value?: string | null };
  const items = itemsData.value ? (JSON.parse(itemsData.value) as RssTickerItemRecord[]) : [];
  const feeds = feedsData.value ? (JSON.parse(feedsData.value) as RssTickerFeedRecord[]) : [];
  const feedsById = new Map(feeds.map((feed) => [feed.id, feed]));

  return items
    .filter((item) => !item.read && isDateInTimeRange(item.publishedAt, timeRange, timeZone))
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    .slice(0, 10)
    .map((item) => ({
      id: item.id,
      title: item.title,
      projectName: feedsById.get(item.feedId)?.name ?? "RSS",
      projectColor: "#f59e0b",
      source: "rss",
      url: item.link,
      createdAt: item.publishedAt,
      timeAgo: formatTimeAgo(item.publishedAt),
    }));
}

// ── Hover card ──────────────────────────────────────────────────────────────

interface HoverCardProps {
  item: TickerActivityItem;
  anchorRect: DOMRect;
}

function HoverCard({ item, anchorRect }: HoverCardProps) {
  const top = anchorRect.top - 8; // 8px gap above the ticker
  const left = Math.max(8, anchorRect.left);

  return createPortal(
    <div
      className="ticker-hover-card"
      style={{ position: "fixed", top, left, transform: "translateY(-100%)" }}
    >
      {/* Top row: source pill + project badge + link */}
      <div className="flex items-center gap-2">
        <span className={`ticker-source-pill ${SOURCE_CLASSES[item.source]}`}>
          {SOURCE_LABELS[item.source]}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-item px-2 py-0.5 font-mono font-semibold text-w-sm uppercase tracking-wider"
          style={{
            background: `${item.projectColor}18`,
            color: item.projectColor,
            border: `1px solid ${item.projectColor}30`,
          }}
        >
          <span
            className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ background: item.projectColor }}
          />
          {item.projectName}
        </span>
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto flex items-center gap-1 font-mono text-accent text-w-sm transition-colors hover:text-accent/80"
          >
            Open
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ) : null}
      </div>

      {/* Full title */}
      <p className="mt-1.5 line-clamp-2 font-sans text-foreground-secondary text-w-sm leading-snug">
        {item.title}
      </p>

      {/* Meta row */}
      <div className="mt-2 flex items-center gap-2 font-mono text-dim text-w-sm">
        <span>{item.timeAgo}</span>
        {item.url ? (
          <>
            <span>·</span>
            <span className="max-w-[200px] truncate">{new URL(item.url).hostname}</span>
          </>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

// ── Main ticker ─────────────────────────────────────────────────────────────

export function BottomTicker({ projectSlug }: BottomTickerProps) {
  const { projects, appearance, timeRange } = useDashboard();
  const effectiveTimezone = useEffectiveTimeZone();
  const { checks: healthChecks } = useHealth();
  const { items: shippingItems } = useShipping(projectSlug, timeRange);
  const { routingConfig } = useRoutingConfig();
  const [hoveredItem, setHoveredItem] = useState<{
    item: TickerActivityItem;
    rect: DOMRect;
  } | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const pauseRef = useRef(false);
  const { data: statusPageTickerData } = useSWR(
    "bottom-ticker:status-page",
    async () => {
      try {
        const enabled = await loadStatusPageTickerEnabled();
        const sources = enabled ? await loadStatusPageTickerSources() : [];
        return { enabled, sources };
      } catch {
        return {
          enabled: true,
          sources: [] as StatusPageTickerSource[],
        };
      }
    },
    {
      fallbackData: { enabled: true, sources: [] as StatusPageTickerSource[] },
      refreshInterval: STATUS_PAGE_SYNC_MS,
      revalidateOnFocus: false,
    }
  );
  const { data: rssTickerItems = [] } = useSWR(
    ["bottom-ticker:rss", timeRange, effectiveTimezone] as const,
    async ([, nextTimeRange, nextTimezone]) => {
      try {
        return await loadRssTickerItems(nextTimeRange, nextTimezone);
      } catch {
        return [];
      }
    },
    {
      fallbackData: [] as TickerActivityItem[],
      refreshInterval: STATUS_PAGE_SYNC_MS,
      revalidateOnFocus: false,
    }
  );
  const statusPageTickerEnabled = statusPageTickerData.enabled;
  const statusPageSources = statusPageTickerData.sources;

  // Resolved ticker config with defaults
  const ticker = {
    speed: appearance.ticker?.speed ?? "normal",
    sources: {
      github: appearance.ticker?.sources?.github ?? true,
      linear: appearance.ticker?.sources?.linear ?? true,
      vercel: appearance.ticker?.sources?.vercel ?? true,
      manual: appearance.ticker?.sources?.manual ?? true,
    },
    showHealthAlerts: appearance.ticker?.showHealthAlerts ?? true,
  };

  const projectName = resolveProjectName(projects, projectSlug);
  const allActivities = filterByProject(shippingItems, projectName) as TickerActivityItem[];
  const projectSlugByName = useMemo(
    () => new Map(projects.map((project) => [project.name, project.slug])),
    [projects]
  );

  const activities = allActivities.filter((item) => {
    const baselineAllowed = item.source === "rss" ? true : ticker.sources[item.source];
    if (item.source === "rss" || !(item.source in TICKER_EVENT_TYPES)) {
      return baselineAllowed;
    }

    return resolveRoutingSurfaceAccess("ticker", baselineAllowed, routingConfig, {
      source: item.source,
      type: TICKER_EVENT_TYPES[item.source as keyof typeof TICKER_EVENT_TYPES],
      severity: "info",
      projectSlug: projectSlugByName.get(item.projectName) ?? null,
      title: item.title,
      body: null,
      metadata: {
        projectName: item.projectName,
        sourceItemId: item.id,
        url: item.url,
      },
    });
  });
  const mergedActivities = [...activities, ...rssTickerItems].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
  const repeatedActivities = useMemo(() => {
    if (mergedActivities.length === 0) return [];

    const cyclesPerHalf = Math.max(
      1,
      Math.ceil(MIN_TICKER_ITEMS_PER_HALF / mergedActivities.length)
    );
    const totalCycles = cyclesPerHalf * 2;

    return Array.from({ length: totalCycles }).flatMap((_, cycleIndex) =>
      mergedActivities.map((item) => ({
        item,
        key: `${item.id}-cycle-${String(cycleIndex)}`,
      }))
    );
  }, [mergedActivities]);

  const healthAlerts: HealthAlertItem[] = ticker.showHealthAlerts
    ? [
        ...healthChecks
          .filter((check) => check.status === "down")
          .map((check) => ({
            id: `betterstack:${check.id}`,
            label: `DOWN: ${check.url}`,
            tone: "critical" as const,
          })),
        ...statusPageSources
          .filter(
            (source) =>
              statusPageTickerEnabled &&
              !source.disabled &&
              !source.muted &&
              (source.status === "outage" || source.status === "degraded")
          )
          .map((source) => ({
            id: `status-page:${source.id}`,
            label: `${source.status === "outage" ? "OUTAGE" : "DEGRADED"}: ${source.name}`,
            tone: source.status === "outage" ? ("critical" as const) : ("warning" as const),
          })),
      ]
    : [];
  const visibleHealthAlerts = healthAlerts.slice(0, 3);

  const animationDuration = TICKER_SPEED_MS[ticker.speed] ?? 60000;

  const handleItemMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>, item: TickerActivityItem) => {
      pauseRef.current = true;
      setIsPaused(true);
      setHoveredItem({ item, rect: e.currentTarget.getBoundingClientRect() });
    },
    []
  );

  const handleItemMouseLeave = useCallback(() => {
    pauseRef.current = false;
    setIsPaused(false);
    setHoveredItem(null);
  }, []);

  return (
    <div className="flex h-8 items-center overflow-hidden">
      {/* Down alerts */}
      {visibleHealthAlerts.length > 0 && (
        <div className="flex h-full shrink-0 items-center gap-1.5 border-destructive/20 border-r bg-destructive/10 px-3">
          <AlertTriangle className="icon-xs text-destructive" />
          {visibleHealthAlerts.map((alert) => (
            <span
              key={alert.id}
              className={
                alert.tone === "critical"
                  ? "font-mono text-destructive text-w-sm uppercase"
                  : "font-mono text-w-sm text-warning uppercase"
              }
            >
              {alert.label}
            </span>
          ))}
          {healthAlerts.length > visibleHealthAlerts.length && (
            <span className="font-mono text-dim text-w-sm uppercase">
              +{healthAlerts.length - visibleHealthAlerts.length} more
            </span>
          )}
        </div>
      )}

      {/* Scrolling activity ticker */}
      <div
        className="ticker-scroll-area relative flex-1 overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 2%, black 98%, transparent 100%)",
        }}
      >
        {mergedActivities.length === 0 ? (
          <div className="flex h-full items-center px-3">
            <span className="font-mono text-dim text-w-sm">No recent activity</span>
          </div>
        ) : (
          <div
            className="ticker-scroll flex items-center gap-0 whitespace-nowrap"
            style={{
              animationDuration: `${animationDuration}ms`,
              animationPlayState: isPaused ? "paused" : "running",
            }}
          >
            {repeatedActivities.map(({ item, key }) => {
              if (item.url) {
                return (
                  <a
                    key={key}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={item.title}
                    className="flex h-8 shrink-0 items-center gap-1.5 border-border border-r px-3 no-underline transition-colors hover:bg-muted/50"
                    onMouseEnter={(e) => handleItemMouseEnter(e, item)}
                    onMouseLeave={handleItemMouseLeave}
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.projectColor }}
                    />
                    <span className="max-w-[260px] truncate text-dim text-w-sm">{item.title}</span>
                    <span className={`ticker-source-pill ${SOURCE_CLASSES[item.source]}`}>
                      {SOURCE_LABELS[item.source]}
                    </span>
                    <span className="font-mono text-dim/70 text-w-sm">{item.timeAgo}</span>
                  </a>
                );
              }

              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: hover-only presentation wrapper for ticker metadata
                <div
                  key={key}
                  className="flex h-8 shrink-0 items-center gap-1.5 border-border border-r px-3"
                  onMouseEnter={(e) => handleItemMouseEnter(e, item)}
                  onMouseLeave={handleItemMouseLeave}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.projectColor }}
                  />
                  <span className="max-w-[260px] truncate text-dim text-w-sm">{item.title}</span>
                  <span className={`ticker-source-pill ${SOURCE_CLASSES[item.source]}`}>
                    {SOURCE_LABELS[item.source]}
                  </span>
                  <span className="font-mono text-dim/70 text-w-sm">{item.timeAgo}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hover card portal */}
      {hoveredItem ? <HoverCard item={hoveredItem.item} anchorRect={hoveredItem.rect} /> : null}
    </div>
  );
}
