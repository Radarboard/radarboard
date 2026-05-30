"use client";

import { API_ROUTES, buildApiRoute } from "@radarboard/types/api-routes";
import type { LlmTraceRow } from "@radarboard/types/database";
import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useState } from "react";
import {
  DebugBadge,
  DebugCell,
  DebugRow,
  DebugSection,
  DebugTable,
  formatMs,
  LoadingState,
  relativeTime,
  SectionHeader,
  StatStrip,
} from "../../shared";

interface TraceInsightRef {
  id: string;
  label: string;
  kind: "artifact" | "note" | "skill";
  badge?: string;
}

interface TraceInsight {
  eventCount: number;
  memoryCount: number;
  attachedSkills: TraceInsightRef[];
  attachedNotes: TraceInsightRef[];
  attachedArtifacts: TraceInsightRef[];
  dependencyArtifacts: TraceInsightRef[];
  toolCount: number;
  toolNames: string[];
  toolSources: string[];
  evidenceRefCount: number;
  evidenceRefs: Array<{
    kind: "entity" | "page" | "query" | "repo" | "url";
    label: string;
    url?: string;
  }>;
  artifactTitle: string | null;
  nextMode: string | null;
  feedbackRating: number | null;
}

type DebugTraceRow = LlmTraceRow & { insight?: TraceInsight };

function getContextCount(insight?: TraceInsight): number {
  if (!insight) return 0;
  return (
    insight.attachedSkills.length +
    insight.attachedNotes.length +
    insight.attachedArtifacts.length +
    insight.dependencyArtifacts.length
  );
}

function incrementRatingBucket(
  bucketMap: Map<string, { positive: number; negative: number }>,
  keys: string[],
  rating: 1 | -1
) {
  for (const key of keys) {
    const bucket = bucketMap.get(key) ?? { positive: 0, negative: 0 };
    if (rating === 1) bucket.positive += 1;
    else bucket.negative += 1;
    bucketMap.set(key, bucket);
  }
}

function sortAndSliceBuckets(
  bucketMap: Map<string, { positive: number; negative: number }>,
  limit = 5
) {
  return [...bucketMap.entries()]
    .sort(
      (left, right) => right[1].positive + right[1].negative - (left[1].positive + left[1].negative)
    )
    .slice(0, limit);
}

function getTraceContextKeys(insight: TraceInsight | undefined): string[] {
  const labels = [
    ...(insight?.attachedSkills ?? []).map((item) => `skill:${item.label}`),
    ...(insight?.attachedArtifacts ?? []).map((item) => `artifact:${item.label}`),
    ...(insight?.attachedNotes ?? []).map((item) => `note:${item.label}`),
  ];
  return labels.length > 0 ? labels : ["context:none"];
}

function getTraceSourceKeys(insight: TraceInsight | undefined): string[] {
  return insight?.toolSources && insight.toolSources.length > 0
    ? insight.toolSources
    : ["source:none"];
}

function getTraceEvidenceKeys(insight: TraceInsight | undefined): string[] {
  return insight?.evidenceRefs && insight.evidenceRefs.length > 0
    ? insight.evidenceRefs.map((ref) => `${ref.kind}:${ref.label}`)
    : ["evidence:none"];
}

function buildFeedbackSummary(traces: DebugTraceRow[]) {
  const ratedTraces = traces.filter(
    (trace) => trace.insight?.feedbackRating === 1 || trace.insight?.feedbackRating === -1
  );

  const byNextMode = new Map<string, { positive: number; negative: number }>();
  const byContext = new Map<string, { positive: number; negative: number }>();
  const bySource = new Map<string, { positive: number; negative: number }>();
  const byEvidence = new Map<string, { positive: number; negative: number }>();

  for (const trace of ratedTraces) {
    const rating = trace.insight?.feedbackRating;
    if (rating !== 1 && rating !== -1) continue;

    incrementRatingBucket(byNextMode, [trace.insight?.nextMode ?? "none"], rating);
    incrementRatingBucket(byContext, getTraceContextKeys(trace.insight), rating);
    incrementRatingBucket(bySource, getTraceSourceKeys(trace.insight), rating);
    incrementRatingBucket(byEvidence, getTraceEvidenceKeys(trace.insight), rating);
  }

  return {
    byNextMode: sortAndSliceBuckets(byNextMode),
    byContext: sortAndSliceBuckets(byContext),
    bySource: sortAndSliceBuckets(bySource),
    byEvidence: sortAndSliceBuckets(byEvidence),
  };
}

// ---------------------------------------------------------------------------
// Cost estimation (USD per 1M tokens)
// ---------------------------------------------------------------------------

const COST_PER_1M: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "claude-opus-4-6": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
  "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-1.5-pro": { input: 1.25, output: 5 },
};

function estimateCost(modelId: string, promptTokens: number, completionTokens: number): number {
  const rates = COST_PER_1M[modelId];
  if (!rates) return 0;
  return (promptTokens / 1_000_000) * rates.input + (completionTokens / 1_000_000) * rates.output;
}

function formatCost(usd: number): string {
  if (usd === 0) return "—";
  if (usd < 0.0001) return "<$0.0001";
  return `$${usd.toFixed(4)}`;
}

function TraceInsightBadges({ trace }: { trace: DebugTraceRow }) {
  const contextCount = getContextCount(trace.insight);
  const badges: Array<{
    key: string;
    variant: "muted" | "accent" | "success" | "error";
    label: string;
  }> = [];
  if (contextCount > 0) badges.push({ key: "ctx", variant: "muted", label: `ctx:${contextCount}` });
  if ((trace.insight?.toolCount ?? 0) > 0)
    badges.push({ key: "tools", variant: "muted", label: `tools:${trace.insight?.toolCount}` });
  if ((trace.insight?.evidenceRefCount ?? 0) > 0)
    badges.push({
      key: "refs",
      variant: "muted",
      label: `refs:${trace.insight?.evidenceRefCount}`,
    });
  if ((trace.insight?.memoryCount ?? 0) > 0)
    badges.push({ key: "mem", variant: "muted", label: `mem:${trace.insight?.memoryCount}` });
  if (trace.insight?.artifactTitle)
    badges.push({ key: "artifact", variant: "accent", label: "artifact" });
  if (trace.insight?.nextMode)
    badges.push({ key: "next", variant: "accent", label: `next:${trace.insight.nextMode}` });
  if (trace.insight?.feedbackRating === 1)
    badges.push({ key: "rated+", variant: "success", label: "rated:+1" });
  if (trace.insight?.feedbackRating === -1)
    badges.push({ key: "rated-", variant: "error", label: "rated:-1" });

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <DebugBadge key={b.key} variant={b.variant}>
          {b.label}
        </DebugBadge>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TracesSection() {
  const [traces, setTraces] = useState<DebugTraceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setActiveTab] = useQueryState("tab", parseAsString);
  const [, setEventsTrace] = useQueryState("eventsTrace", parseAsString);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(buildApiRoute(API_ROUTES.debugTraces, { limit: 200 }));
    const data = (await res.json()) as { traces: DebugTraceRow[] };
    setTraces(data.traces ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => {
      /* fire-and-forget */
    });
  }, [load]);

  const rate = async (id: string, rating: number | null) => {
    await fetch(API_ROUTES.debugTraces, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, rating }),
    });
    setTraces((prev) => prev.map((t) => (t.id === id ? { ...t, rating } : t)));
  };

  const openEventsForTrace = useCallback(
    (traceId: string) => {
      setActiveTab("events").catch(() => {
        /* fire-and-forget */
      });
      setEventsTrace(traceId).catch(() => {
        /* fire-and-forget */
      });
    },
    [setActiveTab, setEventsTrace]
  );

  const totalTokens = traces.reduce((s, t) => s + t.totalTokens, 0);
  const totalCost = traces.reduce(
    (s, t) => s + estimateCost(t.modelId, t.promptTokens, t.completionTokens),
    0
  );
  const avgLatency =
    traces.length > 0
      ? Math.round(traces.reduce((s, t) => s + t.durationMs, 0) / traces.length)
      : 0;
  const positiveRatings = traces.filter((t) => t.rating === 1).length;
  const negativeRatings = traces.filter((t) => t.rating === -1).length;
  const feedbackSummary = buildFeedbackSummary(traces);

  return (
    <DebugSection>
      <StatStrip
        stats={[
          { label: "Requests", value: traces.length.toString() },
          { label: "Total tokens", value: totalTokens.toLocaleString() },
          { label: "Est. cost", value: `$${totalCost.toFixed(4)}` },
          { label: "Avg latency", value: formatMs(avgLatency) },
          { label: "Ratings", value: `${positiveRatings}↑ ${negativeRatings}↓` },
        ]}
      />

      {(feedbackSummary.byNextMode.length > 0 ||
        feedbackSummary.byContext.length > 0 ||
        feedbackSummary.bySource.length > 0 ||
        feedbackSummary.byEvidence.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-item border border-border bg-surface p-3">
            <div className="mb-2 font-mono text-dim text-w-sm uppercase tracking-widest">
              Feedback By Next Step
            </div>
            <div className="flex flex-wrap gap-1.5">
              {feedbackSummary.byNextMode.map(([key, value]) => (
                <DebugBadge key={key} variant="muted">
                  {key}: +{value.positive} / -{value.negative}
                </DebugBadge>
              ))}
            </div>
          </div>
          <div className="rounded-item border border-border bg-surface p-3">
            <div className="mb-2 font-mono text-dim text-w-sm uppercase tracking-widest">
              Feedback By Context
            </div>
            <div className="flex flex-wrap gap-1.5">
              {feedbackSummary.byContext.map(([key, value]) => (
                <DebugBadge key={key} variant="muted">
                  {key}: +{value.positive} / -{value.negative}
                </DebugBadge>
              ))}
            </div>
          </div>
          <div className="rounded-item border border-border bg-surface p-3">
            <div className="mb-2 font-mono text-dim text-w-sm uppercase tracking-widest">
              Feedback By Source
            </div>
            <div className="flex flex-wrap gap-1.5">
              {feedbackSummary.bySource.map(([key, value]) => (
                <DebugBadge key={key} variant="muted">
                  {key}: +{value.positive} / -{value.negative}
                </DebugBadge>
              ))}
            </div>
          </div>
          <div className="rounded-item border border-border bg-surface p-3">
            <div className="mb-2 font-mono text-dim text-w-sm uppercase tracking-widest">
              Feedback By Evidence
            </div>
            <div className="flex flex-wrap gap-1.5">
              {feedbackSummary.byEvidence.map(([key, value]) => (
                <DebugBadge key={key} variant="muted">
                  {key}: +{value.positive} / -{value.negative}
                </DebugBadge>
              ))}
            </div>
          </div>
        </div>
      )}

      <SectionHeader label={`${traces.length} traces (last 200)`} onRefresh={load} />

      {Boolean(loading) && <LoadingState />}
      {!loading && traces.length === 0 && (
        <EmptyState message="No traces yet — send a chat message to record the first one." />
      )}
      {!loading && traces.length > 0 && (
        <DebugTable
          headers={[
            "Time",
            "Model",
            "Prompt ↑",
            "Completion ↓",
            "Total",
            "Latency",
            "Est. cost",
            "Why",
            "Inspect",
            "Rate",
          ]}
        >
          {traces.map((t) => {
            const cost = estimateCost(t.modelId, t.promptTokens, t.completionTokens);
            return (
              <DebugRow key={t.id}>
                <DebugCell className="text-dim/60">{relativeTime(t.createdAt)}</DebugCell>
                <DebugCell className="text-foreground-secondary/80">
                  <span className="text-dim/60">{t.providerId}/</span>
                  {t.modelId}
                </DebugCell>
                <DebugCell className="text-accent">{t.promptTokens.toLocaleString()}</DebugCell>
                <DebugCell className="text-success">
                  {t.completionTokens.toLocaleString()}
                </DebugCell>
                <DebugCell className="text-dim">{t.totalTokens.toLocaleString()}</DebugCell>
                <DebugCell className="text-dim">{formatMs(t.durationMs)}</DebugCell>
                <DebugCell className="text-dim">{formatCost(cost)}</DebugCell>
                <DebugCell>
                  <TraceInsightBadges trace={t} />
                </DebugCell>
                <DebugCell>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openEventsForTrace(t.id)}
                    className="uppercase-none h-auto px-2 py-1 font-mono text-dim text-w-sm hover:text-foreground-secondary"
                  >
                    Events
                  </Button>
                </DebugCell>
                <DebugCell>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            rate(t.id, t.rating === 1 ? null : 1).catch(() => {
                              /* fire-and-forget */
                            })
                          }
                          className={cn(
                            "uppercase-none h-7 w-7 p-0 transition-colors hover:bg-transparent",
                            t.rating === 1 ? "text-success" : "text-dim/40 hover:text-success"
                          )}
                        >
                          <ThumbsUpIcon className="icon-xs" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Good response</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            rate(t.id, t.rating === -1 ? null : -1).catch(() => {
                              /* fire-and-forget */
                            })
                          }
                          className={cn(
                            "uppercase-none h-7 w-7 p-0 transition-colors hover:bg-transparent",
                            t.rating === -1
                              ? "text-destructive"
                              : "text-dim/40 hover:text-destructive"
                          )}
                        >
                          <ThumbsDownIcon className="icon-xs" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Poor response</TooltipContent>
                    </Tooltip>
                  </div>
                </DebugCell>
              </DebugRow>
            );
          })}
        </DebugTable>
      )}
    </DebugSection>
  );
}
