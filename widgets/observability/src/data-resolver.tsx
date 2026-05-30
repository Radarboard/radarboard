"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { formatNumber } from "@radarboard/utils/format-number";
import { formatTimeAgo } from "@radarboard/utils/format-time-ago";
import {
  type DataSourceResolverProps,
  registerTemplateDataSource,
  reportResolverState,
} from "@radarboard/widget-sdk/data-source-registry";
import { useEffect, useMemo } from "react";
import { useAppStore } from "./hooks/use-app-store";
import { useHealth } from "./hooks/use-health";
import { useSentry } from "./hooks/use-sentry";

// ─── App Store utilities ──────────────────────────────────────────────────────

function appStoreTone(risk: string | null | undefined): string {
  switch (risk) {
    case "high":
      return "#e05555";
    case "elevated":
      return "#f5c542";
    default:
      return "#4ade80";
  }
}

function reviewRatingColor(rating: number): string {
  if (rating >= 4) return "#4ade80";
  if (rating === 3) return "#f5c542";
  return "#e05555";
}

function normalizeAppStoreData(
  input: import("@radarboard/types/app-store-connect").AppStoreOverview | null,
  configured: boolean
) {
  const reviews = (input?.recentReviews ?? []).map((review) => ({
    ...review,
    titleText: review.title?.trim() || review.reviewer,
    subtitleText: `${review.reviewer} · ${review.territory}`,
    excerpt: review.body?.trim() || "No written review",
    timestampLabel: formatTimeAgo(review.createdAt),
    ratingLabel: `${review.rating}★`,
    ratingColor: reviewRatingColor(review.rating),
  }));

  return {
    configured,
    appName: input?.appName ?? "App Store",
    averageRating: input?.averageRating ?? 0,
    averageRatingTone: appStoreTone(input?.releaseRisk),
    totalReviews: input?.totalReviews ?? 0,
    totalReviewsLabel: formatNumber(input?.totalReviews ?? 0),
    recentNegativeReviews: input?.recentNegativeReviews ?? 0,
    recentPositiveReviews: input?.recentPositiveReviews ?? 0,
    reviewPressureLabel: input?.releaseRisk ?? "low",
    reviewPressureTone: appStoreTone(input?.releaseRisk),
    reviewSummaryText:
      input?.reviewSummary?.text ??
      (configured ? "No review summary available yet." : "App Store Connect is not configured."),
    reviewSummaryMeta: (() => {
      if (input?.reviewSummary)
        return `${input.reviewSummary.territory} · ${formatTimeAgo(input.reviewSummary.createdAt)}`;
      if (configured) return "Waiting for review summary";
      return "Configure credentials and App ID";
    })(),
    latestVersion: input?.latestVersion ?? "Unavailable",
    latestVersionMeta: input?.latestVersionCreatedAt
      ? `${input.latestVersionState ?? "unknown"} · ${formatTimeAgo(input.latestVersionCreatedAt)}`
      : (input?.latestVersionState ?? "No release metadata"),
    reviews,
    reviewsCount: reviews.length,
  };
}

// ─── Health utilities ─────────────────────────────────────────────────────────

function normalizeHealthData(
  checks: import("@radarboard/types/health").HealthCheck[],
  incidents: import("@radarboard/types/health").HealthIncident[],
  configured: boolean
) {
  const upCount = checks.filter((check) => check.status === "up").length;
  const degradedCount = checks.filter((check) => check.status === "degraded").length;
  const avgResponseMs =
    checks.length > 0
      ? Math.round(checks.reduce((sum, check) => sum + check.responseTimeMs, 0) / checks.length)
      : 0;

  return {
    configured,
    upCount,
    degradedCount,
    totalCount: checks.length,
    incidentsCount: incidents.length,
    avgResponseMs,
    healthChecks: checks.map((check) => ({
      ...check,
      titleText: check.name,
      subtitleText: check.projectName ?? check.url,
      valueText: `${check.responseTimeMs} ms`,
      timestampLabel: formatTimeAgo(check.lastCheckedAt),
      statusTone: (() => {
        if (check.status === "down") return "#e05555";
        if (check.status === "degraded") return "#f5c542";
        return "#4ade80";
      })(),
    })),
    incidents: incidents.map((incident) => ({
      ...incident,
      titleText: incident.name,
      subtitleText: incident.cause,
      timestampLabel: formatTimeAgo(incident.startedAt),
      statusTone: "#e05555",
    })),
  };
}

// ─── Resolvers ────────────────────────────────────────────────────────────────

function AppStoreResolver({ projectSlug, timeRange = "30d", onState }: DataSourceResolverProps) {
  const { data, configured, fetchedAt, loading, error, refetch } = useAppStore(
    projectSlug,
    timeRange
  );
  const resolvedData = useMemo(() => {
    if ((data as { configured?: boolean } | null)?.configured === false) return data;
    return normalizeAppStoreData(
      data as import("@radarboard/types/app-store-connect").AppStoreOverview | null,
      configured
    );
  }, [configured, data]);

  useEffect(() => {
    reportResolverState(onState, {
      data: resolvedData,
      fetchedAt,
      refetch,
      loading,
      error,
    });
  }, [resolvedData, fetchedAt, refetch, loading, error, onState]);

  return null;
}

function HealthResolver({ onState }: DataSourceResolverProps) {
  const { checks, incidents, configured, fetchedAt, loading, error, refetch } = useHealth();
  const resolvedData = useMemo(
    () => normalizeHealthData(checks, incidents, configured),
    [checks, configured, incidents]
  );

  useEffect(() => {
    reportResolverState(onState, {
      data: resolvedData,
      fetchedAt,
      refetch,
      loading,
      error,
    });
  }, [resolvedData, fetchedAt, refetch, loading, error, onState]);

  return null;
}

function SentryResolver({ projectSlug, onState }: DataSourceResolverProps) {
  const { timeRange } = useDashboard();
  const { data, configured, fetchedAt, loading, error, refetch } = useSentry(
    projectSlug,
    timeRange
  );
  const resolvedData = useMemo(
    () =>
      (data as { configured?: boolean } | null)?.configured === false
        ? data
        : {
            configured,
            unresolvedCount:
              (data as import("@radarboard/types/sentry").SentryOverview | null)?.unresolvedCount ??
              0,
            errorTrend:
              (data as import("@radarboard/types/sentry").SentryOverview | null)?.errorTrend ?? [],
            issues:
              (data as import("@radarboard/types/sentry").SentryOverview | null)?.issues ?? [],
          },
    [configured, data]
  );

  useEffect(() => {
    reportResolverState(onState, {
      data: resolvedData,
      fetchedAt,
      refetch,
      loading,
      error,
    });
  }, [resolvedData, fetchedAt, refetch, loading, error, onState]);

  return null;
}

registerTemplateDataSource("app-store", AppStoreResolver);
registerTemplateDataSource("health", HealthResolver);
registerTemplateDataSource("sentry", SentryResolver);
