import { findDataSource } from "@radarboard/integration-sdk/registry";
import type { DataSourceContext } from "@radarboard/integration-sdk/types";
import {
  analyzeBriefingMetric,
  determineOverallStatus,
  formatBriefingMarkdown,
  getLatestBriefing,
  storeBriefing,
  type MorningBriefing,
} from "../morning-briefing";
import { extractNumericValues } from "../tools";

const FALLBACK_SOURCES: [string, string][] = [
  ["openpanel", "data"],
  ["revenuecat", "data"],
  ["betterstack", "data"],
];

async function discoverBriefingSources(listCredentialKeys: () => Promise<string[]>): Promise<[string, string][]> {
  try {
    const connectedKeys = await listCredentialKeys();
    const sources: [string, string][] = [];

    for (const key of connectedKeys) {
      if (findDataSource(key, "data")) {
        sources.push([key, "data"]);
      } else if (findDataSource(key, "daily-revenue")) {
        sources.push([key, "daily-revenue"]);
      }
    }

    return sources.length > 0 ? sources : FALLBACK_SOURCES;
  } catch {
    return FALLBACK_SOURCES;
  }
}

export async function getBriefingRoute(deps: {
  listCredentialKeys: () => Promise<string[]>;
  buildDataSourceContext: () => DataSourceContext;
  emitNotificationEvents: (
    events: Array<{
      source: string;
      type: string;
      severity: "warning" | "info";
      title: string;
      body: string;
      projectSlug: null;
      metadata: Record<string, unknown>;
    }>
  ) => void;
  onSourceError?: (integration: string, action: string, error: unknown) => void;
}): Promise<
  | { ok: true; status: 200; briefing: MorningBriefing }
  | { ok: false; status: 404 | 500; error: string }
> {
  const cached = getLatestBriefing();
  if (cached) {
    return { ok: true, status: 200, briefing: cached };
  }

  const ctx = deps.buildDataSourceContext();
  const sections: MorningBriefing["sections"] = [];

  const briefingSources = await discoverBriefingSources(deps.listCredentialKeys);
  for (const [integration, action] of briefingSources) {
    const ds = findDataSource(integration, action);
    if (!ds) continue;
    try {
      const data = await ds.fetch(
        { projectSlug: null, range: "30d", timeZone: "UTC", forceRefresh: false },
        ctx
      );
      const values = extractNumericValues(data);
      if (values.length < 4) continue;
      const mid = Math.floor(values.length / 2);
      sections.push(analyzeBriefingMetric(integration, action, values.slice(mid), values.slice(0, mid)));
    } catch (error) {
      deps.onSourceError?.(integration, action, error);
    }
  }

  if (sections.length === 0) {
    return { ok: false, status: 404, error: "No integration data available for briefing" };
  }

  const briefing: MorningBriefing = {
    generatedAt: Date.now(),
    sections,
    overallStatus: determineOverallStatus(sections),
    markdownSummary: formatBriefingMarkdown(sections),
  };
  storeBriefing(briefing);

  const meaningfulSections = sections.filter(
    (section) => (Math.abs(section.changePct) > 10 && section.anomalies > 0) || section.anomalies >= 2
  );

  if (meaningfulSections.length > 0) {
    const LABELS: Record<string, string> = {
      openpanel: "Analytics",
      revenuecat: "Revenue",
      betterstack: "Uptime",
      sentry: "Errors",
      "google-search-console": "SEO",
      stripe: "Stripe",
      pagerduty: "Incidents",
      linear: "Roadmap",
      github: "Shipping",
    };

    deps.emitNotificationEvents(
      meaningfulSections.map((section) => ({
        source: section.integration,
        type: "briefing.anomaly",
        severity: section.anomalies >= 2 ? "warning" : "info",
        title: `${LABELS[section.integration] ?? section.integration}: ${section.trend === "up" ? "+" : ""}${section.changePct}%`,
        body: `${section.anomalies} anomal${section.anomalies === 1 ? "y" : "ies"} detected in ${LABELS[section.integration] ?? section.integration}`,
        projectSlug: null,
        metadata: {
          changePct: section.changePct,
          trend: section.trend,
          anomalies: section.anomalies,
        },
      }))
    );
  }

  return { ok: true, status: 200, briefing };
}

export function buildBriefingPromptContext(): string[] {
  try {
    const briefing = getLatestBriefing();
    if (!briefing || briefing.overallStatus === "healthy") return [];

    const meaningful = briefing.sections.filter(
      (section) => (Math.abs(section.changePct) > 10 && section.anomalies > 0) || section.anomalies >= 2
    );
    if (meaningful.length === 0) return [];

    const labels: Record<string, string> = {
      openpanel: "Analytics",
      revenuecat: "Revenue",
      betterstack: "Uptime",
      sentry: "Errors",
      "google-search-console": "SEO",
      stripe: "Stripe",
      pagerduty: "Incidents",
    };

    const lines = meaningful.map(
      (section) =>
        `- ${labels[section.integration] ?? section.integration}: ${section.trend === "up" ? "+" : ""}${section.changePct}% (${section.anomalies} anomal${section.anomalies === 1 ? "y" : "ies"})`
    );

    return [
      `[PROACTIVE INSIGHTS]\nThe following anomalies were detected in recent data. If this is the user's first message, proactively mention these findings and offer to investigate further.\n${lines.join("\n")}\n\nAfter presenting any analysis results, always suggest 2-3 concrete next actions the user can take (e.g., "Want me to create a Linear issue?", "Should I set up an alert?", "I can export this as a report.").`,
    ];
  } catch {
    return [];
  }
}
