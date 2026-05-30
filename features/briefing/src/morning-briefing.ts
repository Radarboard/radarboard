/**
 * Morning briefing generator.
 *
 * Fetches data from all connected integrations, runs anomaly detection,
 * and generates a markdown summary via LLM. The briefing is stored with
 * a TTL and can be broadcast via SSE for proactive dashboard notifications.
 */

import { detectAnomalies, type DataPoint } from "@radarboard/assistant-core/anomaly-detector";
import { analyzeTrend } from "@radarboard/assistant-core/trend-analyzer";

export interface BriefingSection {
  integration: string;
  action: string;
  summary: string;
  anomalies: number;
  trend: "up" | "down" | "flat";
  changePct: number;
}

export interface MorningBriefing {
  generatedAt: number;
  sections: BriefingSection[];
  overallStatus: "healthy" | "attention" | "critical";
  markdownSummary: string;
}

/**
 * Analyze a time-series metric and produce a briefing section.
 */
export function analyzeBriefingMetric(
  integration: string,
  action: string,
  currentValues: number[],
  previousValues: number[],
  timestamps?: number[]
): BriefingSection {
  const trend = analyzeTrend(currentValues, previousValues);

  const dataPoints: DataPoint[] = currentValues.map((value, i) => ({
    timestamp: timestamps?.[i] ?? Date.now() - (currentValues.length - i) * 3600000,
    value,
  }));

  const anomalies = detectAnomalies(dataPoints, { sensitivity: 2 });

  // Don't count anomalies when previous period had no data (0 baseline)
  const hasBaseline = trend.previousAvg > 0;
  const effectiveAnomalies = hasBaseline ? anomalies.length : 0;
  const effectiveChangePct = hasBaseline ? trend.changePct : 0;
  const effectiveDirection = hasBaseline ? trend.direction : ("flat" as const);

  const directionEmoji = effectiveDirection === "up" ? "+" : effectiveDirection === "down" ? "" : "~";
  const summary = hasBaseline
    ? `${directionEmoji}${effectiveChangePct}% (avg ${trend.currentAvg} vs ${trend.previousAvg})${effectiveAnomalies > 0 ? ` — ${effectiveAnomalies} anomaly detected` : ""}`
    : `First data period (avg ${trend.currentAvg})`;

  return {
    integration,
    action,
    summary,
    anomalies: effectiveAnomalies,
    trend: effectiveDirection,
    changePct: effectiveChangePct,
  };
}

/**
 * Determine overall status from briefing sections.
 */
export function determineOverallStatus(
  sections: BriefingSection[]
): "healthy" | "attention" | "critical" {
  const totalAnomalies = sections.reduce((sum, s) => sum + s.anomalies, 0);
  const criticalDrops = sections.filter(
    (s) => s.trend === "down" && Math.abs(s.changePct) > 20
  ).length;

  if (totalAnomalies > 3 || criticalDrops > 1) return "critical";
  if (totalAnomalies > 0 || criticalDrops > 0) return "attention";
  return "healthy";
}

/**
 * Format briefing sections into a markdown summary.
 */
export function formatBriefingMarkdown(sections: BriefingSection[]): string {
  const lines: string[] = ["# Morning Briefing", ""];

  const status = determineOverallStatus(sections);
  const statusEmoji = status === "healthy" ? "green" : status === "attention" ? "yellow" : "red";
  lines.push(`**Overall status:** ${statusEmoji}`);
  lines.push("");

  for (const section of sections) {
    const trendIcon = section.trend === "up" ? "^" : section.trend === "down" ? "v" : "~";
    lines.push(`### ${section.integration}/${section.action} ${trendIcon}`);
    lines.push(section.summary);
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Briefing cache (in-memory with TTL)
// ---------------------------------------------------------------------------

const GLOBAL_KEY = "__radarboard_briefing__" as const;
const BRIEFING_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export function storeBriefing(briefing: MorningBriefing): void {
  (globalThis as unknown as Record<string, MorningBriefing>)[GLOBAL_KEY] = briefing;
}

export function getLatestBriefing(): MorningBriefing | null {
  const briefing = (globalThis as unknown as Record<string, MorningBriefing | undefined>)[GLOBAL_KEY];
  if (!briefing) return null;
  if (Date.now() - briefing.generatedAt > BRIEFING_TTL_MS) return null;
  return briefing;
}
