"use client";

import { Sparkline } from "@radarboard/charts/sparkline";
import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { StatCard } from "@radarboard/ui/stat-card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radarboard/ui/tooltip";
import { formatCurrency } from "@radarboard/utils/format-currency";
import { resolveGitHubLogin, resolveOcSlug } from "@radarboard/utils/project-helpers";
import { useWidgetCallbacks } from "@radarboard/widget-engine/hooks/use-widget-callbacks";
import { SummaryQuadShell } from "@radarboard/widget-engine/summary-quad-shell";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { Info } from "lucide-react";
import { domAnimation, LazyMotion, m } from "motion/react";
import { useCallback, useMemo } from "react";
import type { GitHubSponsorsOverviewData } from "../../hooks/use-github-sponsors";
import { useGitHubSponsors } from "../../hooks/use-github-sponsors";
import type { OpenCollectiveOverviewData } from "../../hooks/use-open-collective";
import { useOpenCollective } from "../../hooks/use-open-collective";

// ---------------------------------------------------------------------------
// Unified KPIs
// ---------------------------------------------------------------------------

function sourceLabel(hasOC: boolean, hasGH: boolean): string {
  if (hasOC && hasGH) return "OC + GitHub";
  if (hasGH) return "GitHub";
  return "Open Collective";
}

interface UnifiedKPIsProps {
  monthlyIncome: number;
  totalSponsors: number;
  ocBalance: number | null;
  currency: string;
  sparklineData: { value: number }[];
  hasOC: boolean;
  hasGH: boolean;
  isApproximate: boolean;
  ghLimitedAccess: boolean;
}

export function UnifiedKPIs({
  monthlyIncome,
  totalSponsors,
  ocBalance,
  currency,
  sparklineData,
  hasOC,
  hasGH,
  isApproximate,
  ghLimitedAccess,
}: UnifiedKPIsProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {Boolean(ghLimitedAccess) && (
        <div className="shrink-0 border-amber-800/30 border-b bg-amber-950/30 px-3 py-1.5 font-mono text-amber-600 text-w-sm">
          GitHub token needs <span className="font-bold">read:user</span> scope for full sponsor
          data. Reconnect GitHub in Settings.
        </div>
      )}
      <div className="min-h-0 flex-1">
        <SummaryQuadShell
          className="h-full"
          slots={[
            <StatCard
              key="monthly-income"
              label={
                <div className="flex items-center gap-1">
                  Monthly Income
                  {Boolean(isApproximate) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="icon-xs cursor-help text-dim" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-[200px]">
                            GitHub Sponsors (exact monthly) + Open Collective (yearly / 12,
                            approximate).
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              }
              value={formatCurrency(monthlyIncome / 100, currency)}
              variant="surface"
            />,
            <StatCard
              key="total-sponsors"
              label="Total Sponsors"
              value={totalSponsors.toLocaleString()}
              description={sourceLabel(hasOC, hasGH)}
              variant="surface"
            />,
            ocBalance !== null ? (
              <StatCard
                key="oc-balance"
                label="OC Balance"
                value={formatCurrency(ocBalance / 100, currency)}
                variant="surface"
              />
            ) : (
              <div key="empty-slot" className="h-full bg-surface" />
            ),
            <div key="donations" className="flex h-full flex-col justify-center bg-surface p-3">
              {sparklineData.length > 0 ? (
                <>
                  <span className="mb-1 font-mono text-dim text-w-sm uppercase tracking-wider">
                    Donations
                  </span>
                  <div className="mt-auto">
                    <Sparkline data={sparklineData} positive={true} height={36} />
                  </div>
                </>
              ) : (
                <span className="text-center font-mono text-dim text-w-sm">No trend data</span>
              )}
            </div>,
          ]}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function computeUnifiedKPIs(
  ocData: OpenCollectiveOverviewData | null,
  ghData: GitHubSponsorsOverviewData | null
) {
  const ghMonthly = ghData?.stats.monthlyIncome ?? 0;
  const ocMonthlyApprox = ocData ? Math.round(ocData.stats.yearlyBudget / 12) : 0;
  return {
    monthlyIncome: ghMonthly + ocMonthlyApprox,
    totalSponsors: (ghData?.stats.sponsorCount ?? 0) + (ocData?.stats.backersCount ?? 0),
    ocBalance: ocData ? ocData.stats.balance : null,
    currency: ghData?.stats.currency ?? ocData?.stats.currency ?? "USD",
    sparklineData: (ocData?.stats.sparklineData ?? []).map((d) => ({ value: d.value / 100 })),
    hasOC: !!ocData,
    hasGH: !!ghData,
    isApproximate: !!ocData && !!ghData,
    ghLimitedAccess: ghData?.limitedAccess ?? false,
  };
}

// ---------------------------------------------------------------------------
// Compact View
// ---------------------------------------------------------------------------

export function SponsorshipCompact({
  widgetId,
  projectSlug,
  onFetchedAt,
  onRefetch,
}: WidgetRenderProps) {
  const { projects, timeRange, preferences } = useDashboard();
  const ocSlug = resolveOcSlug(projects, projectSlug);
  const ghLogin = resolveGitHubLogin(projects, projectSlug);
  const demoMode = preferences.demoMode === true;

  const {
    data: ocData,
    fetchedAt: ocFetchedAt,
    refetch: ocRefetch,
    loading: ocLoading,
    error: ocError,
  } = useOpenCollective(ocSlug, timeRange, demoMode);
  const {
    data: ghData,
    fetchedAt: ghFetchedAt,
    refetch: ghRefetch,
    loading: ghLoading,
    error: ghError,
  } = useGitHubSponsors(ghLogin, true, demoMode);

  const fetchedAt = useMemo(() => {
    if (ocFetchedAt && ghFetchedAt) return Math.max(ocFetchedAt, ghFetchedAt);
    return ocFetchedAt ?? ghFetchedAt ?? null;
  }, [ocFetchedAt, ghFetchedAt]);

  const refetch = useCallback(async () => {
    await Promise.all([ocRefetch(), ghRefetch()]);
  }, [ocRefetch, ghRefetch]);

  useWidgetCallbacks({
    widgetId,
    projectSlug,
    timeRange,
    sourceIds: ["sponsorship"],
    fetchedAt,
    loading: ocLoading || ghLoading,
    error: ocError ?? ghError,
    refetch,
    onFetchedAt,
    onRefetch,
  });

  if (!ocData && !ghData) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-dim text-w-base">
        No sponsorship data available
      </div>
    );
  }

  const kpis = computeUnifiedKPIs(ocData, ghData);

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="h-full"
      >
        <UnifiedKPIs {...kpis} />
      </m.div>
    </LazyMotion>
  );
}
