"use client";

/**
 * Revenue — Expanded fullscreen view
 */

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { EmptyState } from "@radarboard/ui/empty-state";
import { SkeletonShimmer } from "@radarboard/ui/skeleton-shimmer";
import { WidgetNotConfigured } from "@radarboard/widget-engine/widget-not-configured";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { resolveRevenueProviderIntegrationId } from "../../capabilities";
import { useRevenue } from "../../hooks/use-revenue";
import { RevenueChart } from "../revenue-chart";
import { RevenueSummaryShell } from "../revenue-compact";

export function RevenueExpanded({ projectSlug, onConnectService }: WidgetRenderProps) {
  const { timeRange, currency, projects } = useDashboard();
  const providerIntegrationId = resolveRevenueProviderIntegrationId(projects, projectSlug);
  const { data, series, raw, loading } = useRevenue(
    providerIntegrationId,
    timeRange,
    currency,
    projectSlug
  );

  return (
    <SkeletonShimmer loading={loading}>
      {!data ? (
        <EmptyState
          message="Revenue data unavailable"
          subMessage="Connect revenue first"
          variant="compact"
        />
      ) : "configured" in data ? (
        <WidgetNotConfigured
          serviceName={providerIntegrationId === "stripe" ? "Stripe" : "RevenueCat"}
          serviceId={data.ctaTarget ?? providerIntegrationId}
          message={data.setupMessage}
          actionLabel={data.ctaLabel}
          onConnect={onConnectService}
        />
      ) : (
        <div className="flex h-full flex-col">
          <RevenueSummaryShell revenue={data} className="shrink-0" />

          {raw ? (
            <div className="grid shrink-0 grid-cols-2 gap-px border-border border-t bg-secondary">
              <div className="bg-surface-raised px-3 py-2">
                <div className="font-mono text-dim text-w-sm uppercase tracking-wider">
                  New Customers
                </div>
                <div className="mt-0.5 font-mono text-foreground-secondary text-w-lg">
                  {raw.newCustomers.toLocaleString()}
                </div>
              </div>
              <div className="bg-surface-raised px-3 py-2">
                <div className="font-mono text-dim text-w-sm uppercase tracking-wider">
                  Active Users
                </div>
                <div className="mt-0.5 font-mono text-foreground-secondary text-w-lg">
                  {raw.activeUsers.toLocaleString()}
                </div>
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 border-border border-t p-2">
            <RevenueChart series={series} height={400} currency={currency} />
          </div>
        </div>
      )}
    </SkeletonShimmer>
  );
}
