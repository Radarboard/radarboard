/**
 * RevenueCat — Delta detector
 *
 * Accepts RevenueOverview from @radarboard/types/revenue.
 * Detects revenue drops and emits daily summaries.
 */

import type { DeltaDetector, IntegrationEvent } from "@radarboard/integration-sdk/types";
import type { RevenueOverview } from "@radarboard/types/revenue";

interface RevenueSnapshot {
  grossRevenue: number;
  mrr: number;
}

let prev: RevenueSnapshot | null = null;
const REVENUE_DROP_THRESHOLD = 0.2;

export const revenuecatDelta: DeltaDetector<RevenueOverview> = {
  detect(current, projectSlug) {
    const gross = current.grossRevenue.value;
    const mrr = current.mrr.value;

    if (!prev) {
      prev = { grossRevenue: gross, mrr };
      return [];
    }

    const events: IntegrationEvent[] = [];

    const grossDelta = gross - prev.grossRevenue;
    const grossPct = prev.grossRevenue > 0 ? grossDelta / prev.grossRevenue : 0;

    if (grossPct < -REVENUE_DROP_THRESHOLD) {
      events.push({
        source: "revenuecat",
        sourceEventId: `revenuecat:revenue:drop:${Date.now()}`,
        type: "revenue.drop",
        severity: "warning",
        projectSlug,
        title: `Revenue dropped ${Math.abs(Math.round(grossPct * 100))}%`,
        body: `Gross revenue: ${current.grossRevenue.currency}${gross.toFixed(2)} (was ${current.grossRevenue.currency}${prev.grossRevenue.toFixed(2)})`,
        metadata: {
          current: gross,
          previous: prev.grossRevenue,
          delta: grossDelta,
          pct: Math.round(grossPct * 100),
          currency: current.grossRevenue.currency,
          mrr,
        },
      });
    } else if (grossDelta !== 0) {
      events.push({
        source: "revenuecat",
        sourceEventId: `revenuecat:revenue:summary:${Date.now()}`,
        type: "revenue.daily_summary",
        severity: "info",
        projectSlug,
        title: `Revenue: ${current.grossRevenue.currency}${gross.toFixed(2)}${grossDelta !== 0 ? ` (${grossDelta > 0 ? "+" : ""}${grossDelta.toFixed(2)})` : ""}`,
        metadata: { gross, mrr, grossDelta, currency: current.grossRevenue.currency },
      });
    }

    prev = { grossRevenue: gross, mrr };
    return events;
  },
};

export function resetRevenuecatDeltaState(): void {
  prev = null;
}
