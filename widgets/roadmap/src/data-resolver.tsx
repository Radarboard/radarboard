"use client";

import { useEffectiveLocale } from "@radarboard/hooks/use-effective-locale";
import { formatDate } from "@radarboard/utils/format-date-time";
import {
  type DataSourceResolverProps,
  registerTemplateDataSource,
  reportResolverState,
} from "@radarboard/widget-sdk/data-source-registry";
import { useEffect, useMemo } from "react";
import { useRoadmap } from "./hooks/use-roadmap";

function RoadmapResolver({ projectSlug, onState }: DataSourceResolverProps) {
  const effectiveLocale = useEffectiveLocale();
  const { projects, inProgressIssues, configured, fetchedAt, loading, error, refetch } =
    useRoadmap(projectSlug);

  const resolvedData = useMemo(() => {
    const wipCount = inProgressIssues.length;
    const blockedCount = 0; // Linear doesn't expose a "blocked" state; reserved for future use

    // Pick the next upcoming release (first started project with a target date, or first project)
    const nextRelease = projects[0] ?? null;
    const nextReleaseItems = nextRelease
      ? [
          {
            id: nextRelease.id,
            name: nextRelease.name,
            progressLabel: `${Math.round(nextRelease.progress * 100)}%`,
            healthColor: (() => {
              if (nextRelease.health === "atRisk") return "#f5c542";
              if (nextRelease.health === "offTrack") return "#e05555";
              return "#4ade80";
            })(),
            targetDateLabel: nextRelease.targetDate
              ? (formatDate(nextRelease.targetDate, {
                  compact: true,
                  locale: effectiveLocale,
                }) ?? "")
              : "",
          },
        ]
      : [];

    return {
      configured,
      projects,
      inProgressIssues,
      wipCount: String(wipCount),
      blockedCount: String(blockedCount),
      nextReleaseItems,
    };
  }, [configured, effectiveLocale, projects, inProgressIssues]);

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

registerTemplateDataSource("roadmap", RoadmapResolver);
