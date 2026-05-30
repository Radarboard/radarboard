import { NextResponse } from "next/server";
import { getAllHealthSummaries } from "@/lib/health-tracker";

/** GET /api/health/integrations — returns health summaries for all tracked data sources. */
export async function handleHealthIntegrations() {
  const summaries = getAllHealthSummaries();

  const unhealthyCount = summaries.filter((s) => s.status === "unhealthy").length;
  const degradedCount = summaries.filter((s) => s.status === "degraded").length;

  const overallStatus =
    unhealthyCount > 0 ? "unhealthy" : degradedCount > 0 ? "degraded" : "healthy";

  return NextResponse.json({
    status: overallStatus,
    totalSources: summaries.length,
    unhealthyCount,
    degradedCount,
    sources: summaries,
  });
}
