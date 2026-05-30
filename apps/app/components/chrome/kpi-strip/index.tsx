"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { cn } from "@radarboard/utils/cn";
import { formatTimeAgo } from "@radarboard/utils/format-time-ago";
import { useAnalytics } from "@radarboard/widget-analytics";
import { resolveCompactProjectBadgeLabel } from "@radarboard/widget-engine/compact-project-badge";
import { useAppStore, useHealth, useSentry } from "@radarboard/widget-observability";
import { useShipping } from "@radarboard/widget-shipping";
import type React from "react";

// --- Types ---

interface KPIStripProps {
  projectSlug: string | null;
}

interface HealthKPI {
  total: number;
  up: number;
  down: number;
  degraded: number;
}

interface DeployKPI {
  timeAgo: string;
  projectName: string;
  projectColor: string;
}

// --- Status Dot ---

function StatusDot({
  color,
  pulse,
}: {
  color: "green" | "red" | "amber" | "blue";
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        color === "green" && "bg-success",
        color === "red" && "bg-destructive",
        color === "amber" && "bg-warning",
        color === "blue" && "bg-accent",
        pulse && "pulse-dot"
      )}
    />
  );
}

// --- KPI Card ---

function KPICard({ children, alert }: { children: React.ReactNode; alert?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 border-border border-r px-3 py-1.5 last:border-r-0",
        alert && "bg-destructive/10"
      )}
    >
      {children}
    </div>
  );
}

// --- Individual KPI components ---

function HealthKPICell({ health }: { health: HealthKPI }) {
  const hasDown = health.down > 0;
  const hasDegraded = health.degraded > 0;
  const getColor = () => {
    if (hasDown) return "red";
    if (hasDegraded) return "amber";
    return "green";
  };
  const color = getColor();
  const getLabel = () => {
    if (hasDown) return `${health.down} down`;
    if (hasDegraded) return `${health.degraded} degraded`;
    return `${health.up}/${health.total} up`;
  };
  const label = getLabel();

  return (
    <KPICard alert={hasDown}>
      <StatusDot color={color} pulse={hasDown} />
      <span
        className={cn(
          "whitespace-nowrap font-mono text-w-sm",
          hasDown ? "text-destructive" : "text-dim"
        )}
      >
        {label}
      </span>
    </KPICard>
  );
}

function ErrorsKPICell({ count }: { count: number }) {
  const hasErrors = count > 0;
  return (
    <KPICard alert={hasErrors}>
      <StatusDot color={hasErrors ? "red" : "green"} pulse={count > 5} />
      <span
        className={cn(
          "whitespace-nowrap font-mono text-w-sm",
          hasErrors ? "text-destructive" : "text-dim"
        )}
      >
        {hasErrors ? `${count} unresolved` : "0 errors"}
      </span>
    </KPICard>
  );
}

function AppRatingKPICell({
  average,
  totalReviews,
  recentNegativeReviews,
  releaseRisk,
}: {
  average: number;
  totalReviews: number;
  recentNegativeReviews: number;
  releaseRisk: "low" | "elevated" | "high";
}) {
  const getRatingColor = () => {
    if (average >= 4.5) return "text-success";
    if (average >= 4.0) return "text-dim";
    return "text-warning";
  };
  const ratingColor = getRatingColor();
  const getTone = () => {
    if (releaseRisk === "high") return "red";
    if (releaseRisk === "elevated") return "amber";
    return "green";
  };
  const tone = getTone();

  return (
    <KPICard alert={releaseRisk === "high"}>
      <StatusDot color={tone} pulse={releaseRisk === "high"} />
      <span className={cn("whitespace-nowrap font-mono text-w-sm", ratingColor)}>
        {average.toFixed(1)}&#9733; ({totalReviews})
      </span>
      {recentNegativeReviews > 0 && (
        <span
          className={cn(
            "whitespace-nowrap font-mono text-w-sm",
            releaseRisk === "high" ? "text-destructive" : "text-warning"
          )}
        >
          {recentNegativeReviews} low
        </span>
      )}
    </KPICard>
  );
}

function DeployKPICell({ deploy }: { deploy: DeployKPI }) {
  const projectLabel = resolveCompactProjectBadgeLabel(deploy.projectName) ?? deploy.projectName;

  return (
    <KPICard>
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: deploy.projectColor }}
      />
      <span className="whitespace-nowrap font-mono text-dim text-w-sm">{deploy.timeAgo}</span>
      <span className="whitespace-nowrap font-mono text-dim text-w-sm">{projectLabel}</span>
    </KPICard>
  );
}

function LiveVisitorsKPICell({ count }: { count: number }) {
  return (
    <KPICard>
      <StatusDot color="blue" pulse />
      <span className="whitespace-nowrap font-mono text-dim text-w-sm">{count} live</span>
    </KPICard>
  );
}

// --- Data hook ---

function useKPIData(projectSlug: string | null) {
  const { timeRange } = useDashboard();
  const { checks, configured: healthConfigured } = useHealth();
  const { data: sentryData, configured: sentryConfigured } = useSentry(projectSlug, timeRange);
  const { data: appStoreData } = useAppStore(projectSlug, timeRange);
  const { items: shippingItems, configured: shippingConfigured } = useShipping(
    projectSlug,
    timeRange
  );
  const { data: analyticsData } = useAnalytics(timeRange, projectSlug);

  const health: HealthKPI | null =
    healthConfigured && checks.length > 0
      ? {
          total: checks.length,
          up: checks.filter((c) => c.status === "up").length,
          down: checks.filter((c) => c.status === "down").length,
          degraded: checks.filter((c) => c.status === "degraded").length,
        }
      : null;

  const errors =
    sentryConfigured && sentryData && "unresolvedCount" in sentryData
      ? sentryData.unresolvedCount
      : null;

  const appRating =
    appStoreData && "averageRating" in appStoreData
      ? {
          average: appStoreData.averageRating,
          totalReviews: appStoreData.totalReviews,
          recentNegativeReviews: appStoreData.recentNegativeReviews,
          releaseRisk: appStoreData.releaseRisk,
        }
      : null;

  const lastDeploy: DeployKPI | null = (() => {
    if (!shippingConfigured || shippingItems.length === 0) return null;
    const item = shippingItems.find((i) => i.source === "vercel") ?? shippingItems[0];
    if (!item) return null;
    return {
      timeAgo: formatTimeAgo(item.createdAt),
      projectName: item.projectName,
      projectColor: item.projectColor,
    };
  })();

  const liveVisitors =
    analyticsData && "liveVisitors" in analyticsData ? analyticsData.liveVisitors : null;

  return { health, errors, appRating, lastDeploy, liveVisitors };
}

// --- KPI Strip ---

export function KPIStrip({ projectSlug }: KPIStripProps) {
  const { health, errors, appRating, lastDeploy, liveVisitors } = useKPIData(projectSlug);

  const hasAny = health || errors != null || appRating || lastDeploy || liveVisitors != null;
  if (!hasAny) return null;

  return (
    <div className="flex items-center overflow-x-auto">
      {health ? <HealthKPICell health={health} /> : null}
      {errors != null ? <ErrorsKPICell count={errors} /> : null}
      {appRating ? (
        <AppRatingKPICell
          average={appRating.average}
          totalReviews={appRating.totalReviews}
          recentNegativeReviews={appRating.recentNegativeReviews}
          releaseRisk={appRating.releaseRisk}
        />
      ) : null}
      {lastDeploy ? <DeployKPICell deploy={lastDeploy} /> : null}
      {liveVisitors != null ? <LiveVisitorsKPICell count={liveVisitors} /> : null}
    </div>
  );
}
