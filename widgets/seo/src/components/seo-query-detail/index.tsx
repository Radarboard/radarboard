"use client";

import {
  buildAssistantHandoffPrompt,
  SendToAssistantButton,
} from "@radarboard/assistant-ui/assistant-handoff";
import type { DataPoint } from "@radarboard/types/dashboard";
import type { WidgetModalSize } from "@radarboard/types/database";
import type { SearchQuery, SeoQueryDetail as SeoQueryDetailData } from "@radarboard/types/seo";
import {
  DetailLink,
  DetailRow,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { formatNumber } from "@radarboard/utils/format-number";
import { useCurrentWidgetModalSize } from "@radarboard/widget-engine/widget-modal";
import type React from "react";
import { useMemo } from "react";
import { useSeoQuery } from "../../hooks/use-seo-query";
import {
  buildSeoQueryDiagnosis,
  type DiagnosisConfidence,
  type DiagnosisPriority,
  type DiagnosisTone,
  type SeoQueryDiagnosis,
} from "../seo-query-diagnosis";

interface SeoQueryDetailProps {
  query: SearchQuery;
  siteAvgCtr: number;
  siteAvgPosition: number;
  projectSlug?: string | null;
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function getDomain(siteUrl: string): string {
  if (siteUrl.startsWith("sc-domain:")) return siteUrl.slice("sc-domain:".length);
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return siteUrl;
  }
}

function buildGscUrl(siteUrl: string, query: string): string {
  const base = "https://search.google.com/search-console/performance/search-analytics";
  return `${base}?resource_id=${encodeURIComponent(siteUrl)}&query=!${encodeURIComponent(query)}`;
}

function buildGoogleUrl(siteUrl: string, query: string): string {
  const domain = getDomain(siteUrl);
  return `https://www.google.com/search?q=${encodeURIComponent(query)}+site%3A${encodeURIComponent(domain)}`;
}

function formatQueryMetrics(query: SearchQuery): string {
  return `Clicks ${formatNumber(query.clicks)} · Impressions ${formatNumber(
    query.impressions
  )} · CTR ${query.ctr.toFixed(1)}% · Position ${query.position.toFixed(1)}`;
}

function getPageLabel(pageUrl: string): string {
  try {
    return new URL(pageUrl).pathname || "/";
  } catch {
    return pageUrl;
  }
}

function buildSeoQueryHandoffItem(args: {
  query: SearchQuery;
  projectSlug: string | null;
  diagnosis: SeoQueryDiagnosis | null;
}) {
  const { query, projectSlug, diagnosis } = args;
  return {
    id: `${query.query}::${query.siteUrl ?? "default"}`,
    kind: "seo-query",
    title: query.query,
    summary: formatQueryMetrics(query),
    sourceUrl: query.siteUrl ? buildGscUrl(query.siteUrl, query.query) : undefined,
    projectSlug,
    badge: diagnosis?.opportunity.label ?? undefined,
    metadata: {
      query: query.query,
      siteUrl: query.siteUrl ?? null,
      clicks: query.clicks,
      impressions: query.impressions,
      ctr: query.ctr,
      position: query.position,
    },
    bodyMarkdown: [
      "## SEO Query",
      `Query: ${query.query}`,
      formatQueryMetrics(query),
      diagnosis ? `Diagnosis: ${diagnosis.headline}` : null,
      diagnosis?.summary ?? null,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function buildSeoRecommendationHandoffItem(args: {
  query: SearchQuery;
  projectSlug: string | null;
  recommendation: SeoQueryDiagnosis["recommendations"][number];
  diagnosis: SeoQueryDiagnosis;
}) {
  const { query, projectSlug, recommendation, diagnosis } = args;
  return {
    id: `${query.query}:${recommendation.title}`,
    kind: "seo-recommendation",
    title: recommendation.title,
    summary: recommendation.detail,
    sourceUrl: query.siteUrl ? buildGscUrl(query.siteUrl, query.query) : undefined,
    projectSlug,
    badge: recommendation.priority,
    metadata: {
      query: query.query,
      recommendation: recommendation.title,
      priority: recommendation.priority,
      siteUrl: query.siteUrl ?? null,
    },
    bodyMarkdown: [
      "## SEO Recommendation",
      `Query: ${query.query}`,
      `Recommendation: ${recommendation.title}`,
      recommendation.detail,
      `Diagnosis: ${diagnosis.headline}`,
      diagnosis.summary,
    ].join("\n\n"),
  };
}

function buildSeoPageHandoffItem(args: {
  query: SearchQuery;
  projectSlug: string | null;
  page: SeoQueryDetailData["pages"][number];
}) {
  const { query, projectSlug, page } = args;
  const pageLabel = getPageLabel(page.page);
  return {
    id: `${query.query}:${page.page}`,
    kind: "seo-ranking-page",
    title: `${query.query} → ${pageLabel}`,
    summary: `Position ${page.position.toFixed(1)} · ${formatNumber(
      page.clicks
    )} clicks · ${formatNumber(page.impressions)} impressions`,
    sourceUrl: page.page,
    projectSlug,
    badge: `pos ${page.position.toFixed(1)}`,
    metadata: {
      query: query.query,
      page: page.page,
      clicks: page.clicks,
      impressions: page.impressions,
      ctr: page.ctr,
      position: page.position,
    },
    bodyMarkdown: [
      "## SEO Ranking Page",
      `Query: ${query.query}`,
      `Page: ${page.page}`,
      `Position ${page.position.toFixed(1)} · ${formatNumber(page.clicks)} clicks · ${formatNumber(
        page.impressions
      )} impressions`,
    ].join("\n\n"),
  };
}

function buildSeoLinkHandoffItem(args: {
  query: SearchQuery;
  projectSlug: string | null;
  label: string;
  href: string;
}) {
  const { query, projectSlug, label, href } = args;
  return {
    id: `${query.query}:${label}:${href}`,
    kind: "link",
    title: label,
    summary: `Discuss this query-related link for “${query.query}”.`,
    sourceUrl: href,
    projectSlug,
    metadata: {
      query: query.query,
      href,
      label,
      siteUrl: query.siteUrl ?? null,
    },
    bodyMarkdown: [
      "## SEO Link",
      `Query: ${query.query}`,
      `Label: ${label}`,
      `URL: ${href}`,
      formatQueryMetrics(query),
    ].join("\n\n"),
  };
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 font-mono text-dim text-w-sm uppercase tracking-wider">{children}</div>
  );
}

function MiniSparkline({
  points,
  className,
  invertScale,
  unit,
}: {
  points: DataPoint[];
  className?: string;
  invertScale?: boolean;
  unit?: string;
}) {
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return (
    <div className="flex h-16 items-end gap-px">
      {points.map((point) => {
        const pct = invertScale
          ? ((max - point.value) / range) * 100
          : ((point.value - min) / range) * 100;
        const label = unit ? `${point.value.toLocaleString()} ${unit}` : formatNumber(point.value);
        return (
          <Tooltip key={point.date}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex-1 cursor-default rounded-t-sm opacity-70 transition-opacity hover:opacity-100",
                  className
                )}
                style={{ height: `${Math.max(pct, 4)}%` }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="font-mono text-w-sm">
              <div className="text-dim">{point.date}</div>
              <div className="font-bold">{label}</div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function GaugeBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
      <div
        className={cn("h-full rounded-full", className)}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function SummaryRail({
  query,
  siteAvgCtr,
  siteAvgPosition,
  showVsAverage,
}: {
  query: SearchQuery;
  siteAvgCtr: number;
  siteAvgPosition: number;
  showVsAverage: boolean;
}) {
  return (
    <div className="flex w-[200px] shrink-0 flex-col gap-0 border-border border-r p-3">
      <div className="flex flex-col gap-0">
        <DetailRow label="Clicks">{formatNumber(query.clicks)}</DetailRow>
        <DetailRow label="Impressions">{formatNumber(query.impressions)}</DetailRow>
        <DetailRow label="CTR">{query.ctr.toFixed(1)}%</DetailRow>
        <DetailRow label="Position">{query.position.toFixed(1)}</DetailRow>
        {query.siteUrl ? <DetailRow label="Site">{getDomain(query.siteUrl)}</DetailRow> : null}
      </div>

      {showVsAverage && (siteAvgCtr > 0 || siteAvgPosition > 0) && (
        <div className="mt-3 border-border border-t pt-3">
          <SectionLabel>vs. Site Average</SectionLabel>
          <VsAverage
            queryCtr={query.ctr}
            queryPosition={query.position}
            siteAvgCtr={siteAvgCtr}
            siteAvgPosition={siteAvgPosition}
          />
        </div>
      )}
    </div>
  );
}

function SummaryStack({
  query,
  siteAvgCtr,
  siteAvgPosition,
  showVsAverage,
  columns,
}: {
  query: SearchQuery;
  siteAvgCtr: number;
  siteAvgPosition: number;
  showVsAverage: boolean;
  columns: 1 | 2;
}) {
  return (
    <div
      className={
        columns === 2 ? "grid grid-cols-[minmax(0,1fr)_220px] gap-3" : "grid grid-cols-1 gap-3"
      }
    >
      <div className="rounded-item border border-border bg-surface p-3">
        <SectionLabel>Query Metrics</SectionLabel>
        <div className={columns === 2 ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
          <DetailRow label="Clicks">{formatNumber(query.clicks)}</DetailRow>
          <DetailRow label="Impressions">{formatNumber(query.impressions)}</DetailRow>
          <DetailRow label="CTR">{query.ctr.toFixed(1)}%</DetailRow>
          <DetailRow label="Position">{query.position.toFixed(1)}</DetailRow>
          {query.siteUrl ? <DetailRow label="Site">{getDomain(query.siteUrl)}</DetailRow> : null}
        </div>
      </div>
      {showVsAverage && (siteAvgCtr > 0 || siteAvgPosition > 0) ? (
        <div className="rounded-item border border-border bg-surface p-3">
          <SectionLabel>vs. Site Average</SectionLabel>
          <VsAverage
            queryCtr={query.ctr}
            queryPosition={query.position}
            siteAvgCtr={siteAvgCtr}
            siteAvgPosition={siteAvgPosition}
          />
        </div>
      ) : null}
    </div>
  );
}

function DetailLoadingState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <div className="font-mono text-dim text-w-base">Loading detail...</div>
      <div className="max-w-sidebar text-dim text-w-sm leading-relaxed">
        Query breakdowns come from Google Search Console and can take a few seconds.
      </div>
    </div>
  );
}

function DetailEmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center font-mono text-dim text-w-base">
      No detail available for this query yet.
    </div>
  );
}

function hasContentWidth(size: WidgetModalSize): boolean {
  return size === "content" || size === "md";
}

// ---------------------------------------------------------------------------
// Main component — 2-column layout
// ---------------------------------------------------------------------------

function SmallLayout({
  query,
  siteAvgCtr,
  siteAvgPosition,
  projectSlug,
  loading,
  detail,
  diagnosis,
  modalSize,
}: {
  query: SearchQuery;
  siteAvgCtr: number;
  siteAvgPosition: number;
  projectSlug: string | null;
  loading: boolean;
  detail: SeoQueryDetailData | null;
  diagnosis: SeoQueryDiagnosis | null;
  modalSize: WidgetModalSize;
}) {
  return (
    <div className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="p-3">
        <SummaryStack
          query={query}
          siteAvgCtr={siteAvgCtr}
          siteAvgPosition={siteAvgPosition}
          showVsAverage={!loading}
          columns={1}
        />
      </div>
      {diagnosis ? (
        <AssistantDiagnosisSection
          diagnosis={diagnosis}
          modalSize={modalSize}
          projectSlug={projectSlug}
          query={query}
        />
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col border-border border-t p-3">
        {Boolean(loading) && <DetailLoadingState />}
        {!loading && detail && (
          <RightSections
            detail={detail}
            modalSize={modalSize}
            query={query}
            projectSlug={projectSlug}
          />
        )}
        {!loading && !detail && <DetailEmptyState />}
      </div>
    </div>
  );
}

function LargeLayout({
  query,
  siteAvgCtr,
  siteAvgPosition,
  projectSlug,
  loading,
  detail,
  diagnosis,
  modalSize,
}: {
  query: SearchQuery;
  siteAvgCtr: number;
  siteAvgPosition: number;
  projectSlug: string | null;
  loading: boolean;
  detail: SeoQueryDetailData | null;
  diagnosis: SeoQueryDiagnosis | null;
  modalSize: WidgetModalSize;
}) {
  const isLarge = modalSize === "lg";
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        {!isLarge ? (
          <div className="border-border border-b p-3">
            <SummaryStack
              query={query}
              siteAvgCtr={siteAvgCtr}
              siteAvgPosition={siteAvgPosition}
              showVsAverage={!loading}
              columns={2}
            />
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1">
          {isLarge ? (
            <SummaryRail
              query={query}
              siteAvgCtr={siteAvgCtr}
              siteAvgPosition={siteAvgPosition}
              showVsAverage={!loading}
            />
          ) : null}
          <div className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
            {Boolean(loading) && <DetailLoadingState />}
            {!loading && detail && (
              <RightSections
                detail={detail}
                modalSize={modalSize}
                query={query}
                projectSlug={projectSlug}
              />
            )}
            {!loading && !detail && <DetailEmptyState />}
          </div>
        </div>
      </div>
      {diagnosis ? (
        <AssistantDiagnosisSection
          diagnosis={diagnosis}
          modalSize={modalSize}
          projectSlug={projectSlug}
          query={query}
        />
      ) : null}
    </>
  );
}

export function SeoQueryDetail({
  query,
  siteAvgCtr,
  siteAvgPosition,
  projectSlug = null,
}: SeoQueryDetailProps) {
  const { detail, loading } = useSeoQuery(query.query, query.siteUrl ?? null);
  const modalSize = useCurrentWidgetModalSize();
  const diagnosis = useMemo(
    () => (detail ? buildSeoQueryDiagnosis(query, detail, siteAvgCtr, siteAvgPosition) : null),
    [detail, query, siteAvgCtr, siteAvgPosition]
  );
  const queryHandoffItem = useMemo(
    () => buildSeoQueryHandoffItem({ query, projectSlug, diagnosis }),
    [diagnosis, projectSlug, query]
  );
  const queryPrompt = useMemo(
    () => buildAssistantHandoffPrompt("compare-query", queryHandoffItem),
    [queryHandoffItem]
  );
  const searchConsoleItem = useMemo(
    () =>
      query.siteUrl
        ? buildSeoLinkHandoffItem({
            query,
            projectSlug,
            label: "Search Console query view",
            href: buildGscUrl(query.siteUrl, query.query),
          })
        : null,
    [projectSlug, query]
  );
  const googleSearchItem = useMemo(
    () =>
      query.siteUrl
        ? buildSeoLinkHandoffItem({
            query,
            projectSlug,
            label: "Google SERP search",
            href: buildGoogleUrl(query.siteUrl, query.query),
          })
        : null,
    [projectSlug, query]
  );
  const isSmall = modalSize === "sm";

  return (
    <TooltipProvider delayDuration={100}>
      <DialogHeader>
        <DialogTitle>Query Detail</DialogTitle>
        <p className="mt-0.5 truncate font-mono text-dim text-w-base">
          &ldquo;{query.query}&rdquo;
        </p>
      </DialogHeader>

      <DialogBody className="flex min-h-0 flex-1 flex-col p-0">
        {isSmall ? (
          <SmallLayout
            diagnosis={diagnosis}
            modalSize={modalSize}
            projectSlug={projectSlug}
            query={query}
            loading={loading}
            detail={detail}
            siteAvgCtr={siteAvgCtr}
            siteAvgPosition={siteAvgPosition}
          />
        ) : (
          <LargeLayout
            diagnosis={diagnosis}
            modalSize={modalSize}
            projectSlug={projectSlug}
            query={query}
            loading={loading}
            detail={detail}
            siteAvgCtr={siteAvgCtr}
            siteAvgPosition={siteAvgPosition}
          />
        )}
      </DialogBody>

      {query.siteUrl ? (
        <DialogFooter className="justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <DetailLink href={buildGscUrl(query.siteUrl, query.query)}>
              View in Search Console
            </DetailLink>
            {searchConsoleItem ? (
              <SendToAssistantButton
                compact
                item={searchConsoleItem}
                promptTemplate={buildAssistantHandoffPrompt("summarize-link", searchConsoleItem)}
                pinProject={projectSlug}
                label="Discuss"
              />
            ) : null}
            {query.siteUrl ? (
              <DetailLink href={buildGoogleUrl(query.siteUrl, query.query)}>
                Search on Google
              </DetailLink>
            ) : null}
            {googleSearchItem ? (
              <SendToAssistantButton
                compact
                item={googleSearchItem}
                promptTemplate={buildAssistantHandoffPrompt("summarize-link", googleSearchItem)}
                pinProject={projectSlug}
                label="Discuss"
              />
            ) : null}
          </div>
          <SendToAssistantButton
            item={queryHandoffItem}
            promptTemplate={queryPrompt}
            pinProject={projectSlug}
          />
        </DialogFooter>
      ) : null}
    </TooltipProvider>
  );
}

function toneClasses(tone: DiagnosisTone): string {
  switch (tone) {
    case "positive":
      return "border-success/30 bg-success/10 text-success";
    case "warning":
      return "border-warning/30 bg-warning/10 text-warning";
    default:
      return "border-border bg-surface-raised text-muted-foreground";
  }
}

function priorityClasses(priority: DiagnosisPriority): string {
  switch (priority) {
    case "high":
      return "border-warning/30 text-warning";
    case "medium":
      return "border-accent/30 text-accent";
    default:
      return "border-border text-dim";
  }
}

function confidenceClasses(confidence: DiagnosisConfidence): string {
  switch (confidence) {
    case "high":
      return "border-success/30 text-success";
    case "medium":
      return "border-warning/30 text-warning";
    default:
      return "border-border text-dim";
  }
}

function AssistantDiagnosisSection({
  diagnosis,
  modalSize,
  projectSlug,
  query,
}: {
  diagnosis: SeoQueryDiagnosis;
  modalSize: WidgetModalSize;
  projectSlug: string | null;
  query: SearchQuery;
}) {
  const queryItem = buildSeoQueryHandoffItem({ query, projectSlug, diagnosis });
  return (
    <div className="flex flex-col gap-3 border-border border-t p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionLabel>Assistant Diagnosis</SectionLabel>
          <div className="font-mono text-foreground-secondary text-w-base">
            {diagnosis.headline}
          </div>
          <p className="mt-1 text-dim text-w-sm leading-relaxed">{diagnosis.summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SendToAssistantButton
            compact={modalSize !== "lg"}
            item={queryItem}
            promptTemplate={buildAssistantHandoffPrompt("compare-query", queryItem)}
            pinProject={projectSlug}
            label={modalSize === "lg" ? "Discuss Query" : "Discuss"}
          />
          <span
            className={cn(
              "rounded-item border px-1.5 py-0.5 font-mono text-w-sm uppercase tracking-wider",
              confidenceClasses(diagnosis.confidence)
            )}
          >
            {diagnosis.confidence} confidence
          </span>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-3",
          (() => {
            if (modalSize === "lg") return "grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]";
            if (hasContentWidth(modalSize)) return "grid-cols-2";
            return "grid-cols-1";
          })()
        )}
      >
        <div className={cn("rounded-item border p-3", toneClasses(diagnosis.opportunity.tone))}>
          <div className="font-mono text-w-sm uppercase tracking-wider opacity-80">Opportunity</div>
          <div className="mt-1 font-mono text-w-sm">{diagnosis.opportunity.label}</div>
          <p className="mt-2 text-w-sm leading-relaxed opacity-70">
            {diagnosis.opportunity.detail}
          </p>
          {diagnosis.dataWindowLabel ? (
            <div className="mt-3 font-mono text-dim text-w-sm">
              Recent window: {diagnosis.dataWindowLabel}
            </div>
          ) : null}
        </div>

        <div className="rounded-item border border-border bg-surface p-3">
          <SectionLabel>Evidence</SectionLabel>
          <div className="flex flex-col gap-2">
            {diagnosis.observations.map((item) => (
              <div key={item.label} className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-1 h-2 w-2 shrink-0 rounded-full",
                    (() => {
                      if (item.tone === "positive") return "bg-success";
                      if (item.tone === "warning") return "bg-warning";
                      return "bg-dim";
                    })()
                  )}
                />
                <div className="min-w-0">
                  <div className="font-mono text-dim text-w-sm uppercase tracking-wider">
                    {item.label}
                  </div>
                  <div className="mt-0.5 text-w-sm leading-relaxed opacity-70">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className={cn(
            "rounded-item border border-border bg-surface p-3",
            hasContentWidth(modalSize) ? "col-span-2" : ""
          )}
        >
          <SectionLabel>Next Actions</SectionLabel>
          <div className="flex flex-col gap-2">
            {diagnosis.recommendations.map((item) => (
              <div key={item.title} className="border-border border-b pb-2 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-foreground-secondary text-w-sm">{item.title}</div>
                  <div className="flex items-center gap-2">
                    <SendToAssistantButton
                      compact
                      item={buildSeoRecommendationHandoffItem({
                        query,
                        projectSlug,
                        recommendation: item,
                        diagnosis,
                      })}
                      promptTemplate={buildAssistantHandoffPrompt(
                        "evaluate-next-action",
                        buildSeoRecommendationHandoffItem({
                          query,
                          projectSlug,
                          recommendation: item,
                          diagnosis,
                        })
                      )}
                      pinProject={projectSlug}
                      label="Discuss"
                    />
                    <span
                      className={cn(
                        "rounded-item border px-1.5 py-0.5 font-mono text-w-sm uppercase tracking-wider",
                        priorityClasses(item.priority)
                      )}
                    >
                      {item.priority}
                    </span>
                  </div>
                </div>
                <div className="mt-1 text-dim text-w-sm leading-relaxed">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right column sections
// ---------------------------------------------------------------------------

function ChartSparklines({
  detail,
  modalSize,
}: {
  detail: SeoQueryDetailData;
  modalSize: WidgetModalSize;
}) {
  return (
    <div
      className={cn(
        "grid gap-2",
        (() => {
          if (modalSize === "lg") return "grid-cols-3";
          if (hasContentWidth(modalSize)) return "grid-cols-2";
          return "grid-cols-1";
        })()
      )}
    >
      {detail.clicksTrend.length > 0 && (
        <div>
          <SectionLabel>Clicks</SectionLabel>
          <MiniSparkline points={detail.clicksTrend} className="bg-success" unit="clicks" />
        </div>
      )}
      {detail.impressionsTrend.length > 0 && (
        <div>
          <SectionLabel>Impressions</SectionLabel>
          <MiniSparkline points={detail.impressionsTrend} className="bg-accent" unit="impr." />
        </div>
      )}
      {detail.positionTrend.length > 0 && (
        <div>
          <SectionLabel>Position — lower is better</SectionLabel>
          <MiniSparkline
            points={detail.positionTrend}
            className="bg-warning"
            invertScale
            unit="avg pos"
          />
          <div className="mt-1 flex justify-between font-mono text-dim text-w-sm">
            <span>{detail.positionTrend[0]?.value.toFixed(1)}</span>
            <span>{detail.positionTrend[detail.positionTrend.length - 1]?.value.toFixed(1)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function BreakdownPanel({
  detail,
  modalSize,
  projectSlug,
  query,
}: {
  detail: SeoQueryDetailData;
  modalSize: WidgetModalSize;
  projectSlug: string | null;
  query: SearchQuery;
}) {
  return (
    <div
      className={cn(
        "grid items-start gap-2",
        modalSize === "lg" ? "grid-cols-[1fr_160px]" : "grid-cols-1"
      )}
    >
      {detail.pages.length > 0 && (
        <RankingPagesList pages={detail.pages} query={query} projectSlug={projectSlug} />
      )}

      <div
        className={hasContentWidth(modalSize) ? "grid grid-cols-2 gap-3" : "flex flex-col gap-0"}
      >
        {detail.devices.length > 0 && (
          <div className={hasContentWidth(modalSize) ? "" : "pb-3"}>
            <SectionLabel>Devices</SectionLabel>
            <DeviceBreakdown devices={detail.devices} />
          </div>
        )}
        {!hasContentWidth(modalSize) &&
          detail.devices.length > 0 &&
          detail.countries.length > 0 && <div className="border-border border-t" />}
        {detail.countries.length > 0 && (
          <div className={hasContentWidth(modalSize) ? "" : "pt-3"}>
            <SectionLabel>Countries</SectionLabel>
            <CountryBreakdown countries={detail.countries} />
          </div>
        )}
      </div>
    </div>
  );
}

function RightSections({
  detail,
  modalSize,
  projectSlug,
  query,
}: {
  detail: SeoQueryDetailData;
  modalSize: WidgetModalSize;
  projectSlug: string | null;
  query: SearchQuery;
}) {
  const hasCharts =
    detail.clicksTrend.length > 0 ||
    detail.impressionsTrend.length > 0 ||
    detail.positionTrend.length > 0;

  const hasBreakdown =
    detail.pages.length > 0 || detail.devices.length > 0 || detail.countries.length > 0;

  return (
    <>
      {Boolean(hasCharts) && <ChartSparklines detail={detail} modalSize={modalSize} />}

      {Boolean(hasCharts) && hasBreakdown && <div className="border-border border-t" />}

      {Boolean(hasBreakdown) && (
        <BreakdownPanel
          detail={detail}
          modalSize={modalSize}
          projectSlug={projectSlug}
          query={query}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Breakdown helpers
// ---------------------------------------------------------------------------

function positionColor(position: number): string {
  if (position <= 3) return "text-success";
  if (position <= 10) return "text-warning";
  return "text-dim";
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function RankingPagesList({
  pages,
  query,
  projectSlug,
}: {
  pages: SeoQueryDetailData["pages"];
  query: SearchQuery;
  projectSlug: string | null;
}) {
  return (
    <div>
      <SectionLabel>Ranking Pages ({pages.length})</SectionLabel>
      <div className="flex flex-col">
        {pages.map((p) => {
          const pageItem = buildSeoPageHandoffItem({ query, projectSlug, page: p });
          return (
            <div
              key={p.page}
              className="flex items-center justify-between gap-2 border-border border-b py-1 last:border-0"
            >
              <span
                className="flex-1 truncate font-mono text-muted-foreground text-w-sm"
                title={p.page}
              >
                {safePath(p.page)}
              </span>
              <SendToAssistantButton
                compact
                item={pageItem}
                promptTemplate={buildAssistantHandoffPrompt("discuss-item", pageItem)}
                pinProject={projectSlug}
                label="Discuss"
              />
              <span className={cn("shrink-0 font-mono text-w-sm", positionColor(p.position))}>
                pos {p.position.toFixed(1)}
              </span>
              <span className="w-16 shrink-0 text-right font-mono text-dim text-w-sm">
                {formatNumber(p.clicks)} clicks
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeviceBreakdown({ devices }: { devices: SeoQueryDetailData["devices"] }) {
  const total = devices.reduce((s, d) => s + d.clicks, 0) || 1;
  const deviceClass = (device: string): string => {
    const key = device.toLowerCase();
    if (key === "mobile") return "bg-accent";
    if (key === "desktop") return "bg-indigo-500";
    if (key === "tablet") return "bg-warning";
    return "bg-dim";
  };
  return (
    <div className="flex flex-col gap-1">
      {devices.map((d) => {
        const pct = (d.clicks / total) * 100;
        const className = deviceClass(d.device);
        return (
          <Tooltip key={d.device}>
            <TooltipTrigger asChild>
              <div className="flex cursor-default items-center gap-1.5">
                <span className="w-12 shrink-0 font-mono text-dim text-w-sm capitalize">
                  {d.device.toLowerCase()}
                </span>
                <GaugeBar pct={pct} className={className} />
                <span className="w-7 shrink-0 text-right font-mono text-dim text-w-sm">
                  {pct.toFixed(0)}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="font-mono text-w-sm">
              <div className="font-bold">{formatNumber(d.clicks)} clicks</div>
              <div className="text-dim">
                {formatNumber(d.impressions)} impr. · pos {d.position.toFixed(1)}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function CountryBreakdown({ countries }: { countries: SeoQueryDetailData["countries"] }) {
  const total = countries.reduce((s, c) => s + c.clicks, 0) || 1;
  return (
    <div className="flex flex-col gap-1">
      {countries.map((c) => {
        const pct = (c.clicks / total) * 100;
        const label = c.country.length === 3 ? c.country.toUpperCase() : c.country;
        return (
          <Tooltip key={c.country}>
            <TooltipTrigger asChild>
              <div className="flex cursor-default items-center gap-1.5">
                <span
                  className="w-12 shrink-0 truncate font-mono text-dim text-w-sm"
                  title={c.country}
                >
                  {label}
                </span>
                <GaugeBar pct={pct} className="bg-success" />
                <span className="w-7 shrink-0 text-right font-mono text-dim text-w-sm">
                  {pct.toFixed(0)}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="font-mono text-w-sm">
              <div className="font-bold">{formatNumber(c.clicks)} clicks</div>
              <div className="text-dim">
                {formatNumber(c.impressions)} impr. · pos {c.position.toFixed(1)}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function VsAverage({
  queryCtr,
  queryPosition,
  siteAvgCtr,
  siteAvgPosition,
}: {
  queryCtr: number;
  queryPosition: number;
  siteAvgCtr: number;
  siteAvgPosition: number;
}) {
  const maxCtr = Math.max(queryCtr, siteAvgCtr) || 1;
  const maxPos = Math.max(queryPosition, siteAvgPosition) || 1;
  const queryCtrColor = queryCtr >= siteAvgCtr ? "text-success" : "text-warning";
  const queryPosColor = queryPosition <= siteAvgPosition ? "text-success" : "text-warning";
  const queryCtrBg = queryCtr >= siteAvgCtr ? "bg-success" : "bg-warning";
  const queryPosBg = queryPosition <= siteAvgPosition ? "bg-success" : "bg-warning";

  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="mb-1 font-mono text-dim text-w-sm">CTR</div>
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className="w-7 shrink-0 font-mono text-dim text-w-sm">This</span>
          <GaugeBar pct={(queryCtr / maxCtr) * 100} className={queryCtrBg} />
          <span className={cn("w-9 shrink-0 text-right font-mono text-w-sm", queryCtrColor)}>
            {queryCtr.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-7 shrink-0 font-mono text-dim text-w-sm">Avg</span>
          <GaugeBar pct={(siteAvgCtr / maxCtr) * 100} className="bg-secondary-foreground/20" />
          <span className="w-9 shrink-0 text-right font-mono text-dim text-w-sm">
            {siteAvgCtr.toFixed(1)}%
          </span>
        </div>
      </div>
      <div>
        <div className="mb-1 font-mono text-dim text-w-sm">Position</div>
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className="w-7 shrink-0 font-mono text-dim text-w-sm">This</span>
          <GaugeBar pct={((maxPos - queryPosition) / maxPos) * 100} className={queryPosBg} />
          <span className={cn("w-9 shrink-0 text-right font-mono text-w-sm", queryPosColor)}>
            {queryPosition.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-7 shrink-0 font-mono text-dim text-w-sm">Avg</span>
          <GaugeBar
            pct={((maxPos - siteAvgPosition) / maxPos) * 100}
            className="bg-secondary-foreground/20"
          />
          <span className="w-9 shrink-0 text-right font-mono text-dim text-w-sm">
            {siteAvgPosition.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}
