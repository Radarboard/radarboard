"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import {
  type DataSourceResolverProps,
  registerTemplateDataSource,
  reportResolverState,
} from "@radarboard/widget-sdk/data-source-registry";
import { useEffect, useMemo } from "react";
import { useShipping } from "./hooks/use-shipping";

function genericStatusColor(value: string): string {
  switch (value) {
    case "bug":
    case "error":
      return "#e05555";
    case "idea":
    case "open":
    case "github":
      return "#5b8af5";
    case "in_progress":
    case "vercel":
      return "#f5c542";
    case "done":
    case "linear":
      return "#4ade80";
    default:
      return "#777";
  }
}

function ShippingResolver({ projectSlug, onState }: DataSourceResolverProps) {
  const { timeRange } = useDashboard();
  const {
    items,
    configured,
    fetchedAt,
    loading,
    error,
    setupMessage,
    ctaLabel,
    ctaTarget,
    refetch,
  } = useShipping(projectSlug, timeRange);

  const resolvedData = useMemo(
    () => ({
      configured,
      setupMessage: setupMessage ?? "Connect GitHub, Linear, or Vercel to show release activity.",
      ctaLabel: ctaLabel ?? "Choose integration",
      ctaTarget: ctaTarget ?? "intent:release-activity",
      items: items.map((item) => ({
        ...item,
        sourceColor: genericStatusColor(item.source),
      })),
    }),
    [configured, ctaLabel, ctaTarget, items, setupMessage]
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

registerTemplateDataSource("shipping", ShippingResolver);
