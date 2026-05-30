"use client";

/**
 * Revenue — Compact grid view
 */

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import type { RevenueOverview } from "@radarboard/types/revenue";
import { SkeletonShimmer } from "@radarboard/ui/skeleton-shimmer";
import { cn } from "@radarboard/utils/cn";
import { useWidgetCallbacks } from "@radarboard/widget-engine/hooks/use-widget-callbacks";
import { SummaryQuadShell } from "@radarboard/widget-engine/summary-quad-shell";
import { WidgetNotConfigured } from "@radarboard/widget-engine/widget-not-configured";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { resolveRevenueProviderIntegrationId } from "../../capabilities";
import { useRevenue } from "../../hooks/use-revenue";
import { LastPaymentCard, RevenueKPICard } from "../revenue-kpi";

function RevenueSummaryShell({
  revenue,
  className,
}: {
  revenue: RevenueOverview;
  className?: string;
}) {
  return (
    <SummaryQuadShell
      className={cn("h-full", className)}
      slots={[
        <RevenueKPICard
          key="gross"
          label="Gross Revenue"
          data={revenue.grossRevenue}
          breakdown={revenue.breakdown?.grossRevenue}
        />,
        <RevenueKPICard
          key="mrr"
          label="MRR"
          data={revenue.mrr}
          breakdown={revenue.breakdown?.mrr}
        />,
        <LastPaymentCard key="last-payment" data={revenue.lastPayment} />,
        <RevenueKPICard
          key="net"
          label="Net Revenue"
          data={revenue.netRevenue}
          breakdown={revenue.breakdown?.netRevenue}
        />,
      ]}
    />
  );
}

export { RevenueSummaryShell };

export function RevenueCompact({
  widgetId,
  projectSlug,
  onFetchedAt,
  onRefetch,
  onChromeStateChange,
  onConnectService,
}: WidgetRenderProps) {
  const { timeRange, currency, projects } = useDashboard();
  const providerIntegrationId = resolveRevenueProviderIntegrationId(projects, projectSlug);
  const { data, configured, fetchedAt, refetch, loading, error } = useRevenue(
    providerIntegrationId,
    timeRange,
    currency,
    projectSlug
  );

  useWidgetCallbacks({
    widgetId,
    projectSlug,
    timeRange,
    sourceIds: ["revenue"],
    fetchedAt: configured ? fetchedAt : null,
    loading,
    error,
    refetch,
    chromeStatus: !loading && !configured ? "disconnected" : "default",
    onFetchedAt,
    onRefetch,
    onChromeStateChange,
  });

  if (!loading && !configured) {
    const serviceName = providerIntegrationId === "stripe" ? "Stripe" : "RevenueCat";
    const setupState =
      data && typeof data === "object"
        ? (data as {
            ctaLabel?: string;
            ctaTarget?: string;
            setupMessage?: string;
          })
        : null;
    return (
      <WidgetNotConfigured
        serviceName={serviceName}
        serviceId={setupState?.ctaTarget ?? providerIntegrationId}
        message={setupState?.setupMessage}
        actionLabel={setupState?.ctaLabel}
        onConnect={onConnectService}
      />
    );
  }

  return (
    <SkeletonShimmer loading={loading}>
      {data && !("configured" in data) ? <RevenueSummaryShell revenue={data} /> : null}
    </SkeletonShimmer>
  );
}
