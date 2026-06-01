"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type {
  KnowledgeHealthItem,
  KnowledgeHealthItemDetailResponse,
  KnowledgeHealthItemsResponse,
  KnowledgeHealthProjectResponse,
  KnowledgeHealthProjectSummary,
  KnowledgeHealthSummaryResponse,
} from "@radarboard/types/assistant";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@radarboard/ui/select";
import { cn } from "@radarboard/utils/cn";
import {
  AlertTriangleIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import useSWR from "swr";

const GLOBAL_PROJECT_FILTER = "global";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

function buildUrl(base: string, params: Record<string, string | null | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "" || value === "all") continue;
    searchParams.set(key, value);
  }
  const query = searchParams.toString();
  return query ? `${base}?${query}` : base;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "No retained usage";
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return iso;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatNullableCount(value: number | null): string {
  return value == null ? "Unknown" : value.toLocaleString();
}

function getProjectLabel(projectSlug: string | null): string {
  return projectSlug ?? "Global";
}

function getFeedbackLabel(item: KnowledgeHealthItem): string {
  const positive = item.positiveFeedbackCount ?? 0;
  const negative = item.negativeFeedbackCount ?? 0;
  if (positive === 0 && negative === 0) return "No ratings";
  return `+${positive} / -${negative}`;
}

function getTypeBadgeClassName(item: KnowledgeHealthItem): string {
  if (item.type === "artifact") {
    return "border-accent/30 bg-accent/10 text-accent";
  }
  if (item.stale) {
    return "border-warning/30 bg-warning/10 text-warning";
  }
  return "border-border bg-secondary text-dim";
}

function getActionReason(item: KnowledgeHealthItem): string {
  if (item.stale) return "Stale";
  if (item.attributionQuality === "inferred") return "Attribution";
  if ((item.negativeFeedbackCount ?? 0) > 0) return "Negative feedback";
  return "Review";
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function HeaderStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "accent";
}) {
  return (
    <div className="border-border border-l pl-3">
      <div className="font-mono text-dim text-w-sm uppercase tracking-[0.18em]">{label}</div>
      <div
        className={cn(
          "mt-1 font-mono text-w-base",
          tone === "warning" && "text-warning",
          tone === "accent" && "text-accent",
          tone === "neutral" && "text-foreground-secondary"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ProjectScopeButton({
  project,
  active,
  onSelect,
}: {
  project: KnowledgeHealthProjectSummary;
  active: boolean;
  onSelect: (project: string) => void;
}) {
  const projectKey = project.projectSlug ?? GLOBAL_PROJECT_FILTER;
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => onSelect(projectKey)}
      className={cn(
        "uppercase-none h-auto min-w-0 flex-col items-start rounded-none border px-3 py-2 text-left font-sans transition-colors",
        active
          ? "border-accent bg-accent/10 text-foreground"
          : "border-border bg-surface text-dim hover:text-foreground-secondary"
      )}
    >
      <div className="truncate font-mono text-w-sm uppercase tracking-[0.18em]">
        {project.projectSlug ? "Project" : "Global"}
      </div>
      <div className="mt-1 truncate text-w-base">{project.projectName}</div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-dim text-w-sm">
        <span>{project.itemCount} items</span>
        <span>{project.staleCount} stale</span>
        <span>{project.knowledgeBackedRunCount} runs</span>
      </div>
    </Button>
  );
}

function PanelHeader({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count?: string;
}) {
  return (
    <div className="border-border border-b px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-dim text-w-sm uppercase tracking-[0.18em]">{title}</div>
          <div className="mt-1 text-muted-foreground text-w-sm">{subtitle}</div>
        </div>
        {count ? (
          <div className="shrink-0 font-mono text-muted-foreground text-w-sm">{count}</div>
        ) : null}
      </div>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return <div className="px-3 py-4 text-dim text-w-sm">{message}</div>;
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border px-3 py-2">
      <div className="font-mono text-dim text-w-sm uppercase tracking-[0.18em]">{label}</div>
      <div className="mt-2 text-foreground-secondary text-w-base">{value}</div>
    </div>
  );
}

function getItemGuidance(item: KnowledgeHealthItem): string {
  if (item.stale)
    return "Review and refresh this item. It is stale inside the retained history window.";
  if (item.attributionQuality === "inferred")
    return "Check whether this memory is too ambiguous. Usage attribution is inferred, not exact.";
  if ((item.negativeFeedbackCount ?? 0) > 0)
    return "Inspect linked traces and decide whether to edit or remove this item.";
  return "Inspect linked traces before changing this item. It may still be useful.";
}

function KnowledgeDetailSection({
  selectedListItem,
  selectedDetail,
  detailError,
  deletingMemoryId,
  onDeleteMemory,
}: {
  selectedListItem: KnowledgeHealthItem | null;
  selectedDetail: KnowledgeHealthItemDetailResponse["item"] | null;
  detailError: string | null;
  deletingMemoryId: string | null;
  onDeleteMemory: () => void;
}) {
  return (
    <section className="min-h-0">
      <PanelHeader
        title="What To Do"
        subtitle="Inspect why this item matters, then act."
        count={selectedListItem ? getActionReason(selectedListItem) : undefined}
      />
      <div className="scrollbar-thin max-h-[calc(100vh-270px)] overflow-y-auto overflow-x-hidden p-3">
        {Boolean(detailError) && <EmptyPanel message={detailError!} />}
        {!detailError && selectedDetail == null && (
          <EmptyPanel message="Select an item from the action queue or inventory." />
        )}
        {!detailError && selectedDetail != null && (
          <div className="space-y-3">
            <div className="border border-border px-3 py-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "border px-1.5 py-0.5 font-mono text-w-sm uppercase tracking-[0.16em]",
                    getTypeBadgeClassName(selectedDetail.item)
                  )}
                >
                  {selectedDetail.item.type}
                </span>
                <span className="border border-border px-1.5 py-0.5 font-mono text-dim text-w-sm uppercase tracking-[0.16em]">
                  {selectedDetail.item.attributionQuality}
                </span>
              </div>
              <div className="mt-3 text-foreground text-w-lg">{selectedDetail.item.title}</div>
              <div className="mt-2 text-muted-foreground text-w-base leading-6">
                {selectedDetail.item.summary || "No summary available."}
              </div>
              <div className="mt-3 border-accent border-l-2 pl-3 text-foreground-secondary text-w-sm leading-5">
                {getItemGuidance(selectedDetail.item)}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <DetailStat label="Uses" value={formatNullableCount(selectedDetail.item.useCount)} />
              <DetailStat label="Feedback" value={getFeedbackLabel(selectedDetail.item)} />
              <DetailStat
                label="Last used"
                value={formatRelativeTime(selectedDetail.item.lastUsedAt)}
              />
              <DetailStat
                label="Evidence refs"
                value={selectedDetail.item.evidenceRefCount.toLocaleString()}
              />
            </div>

            <div className="border border-border px-3 py-2">
              <div className="font-mono text-dim text-w-sm uppercase tracking-[0.18em]">
                Attribution Notes
              </div>
              <ul className="mt-2 space-y-1 text-foreground-secondary text-w-sm leading-5">
                {selectedDetail.attributionNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>

            <div className="border border-border px-3 py-2">
              <div className="mb-2 flex items-center gap-2 font-mono text-dim text-w-sm uppercase tracking-[0.18em]">
                <SparklesIcon className="icon-xs" /> Linked Traces
              </div>
              {selectedDetail.linkedTraces.length > 0 ? (
                <div className="space-y-2">
                  {selectedDetail.linkedTraces.slice(0, 6).map((trace) => (
                    <div
                      key={trace.id}
                      className="border border-border px-2 py-2 text-foreground-secondary text-w-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{trace.id}</span>
                        <span className="shrink-0 font-mono text-dim text-w-sm">
                          {formatRelativeTime(trace.createdAt)}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-dim text-w-sm">
                        {getProjectLabel(trace.projectSlug)} · next {trace.nextMode ?? "none"} ·
                        refs {trace.evidenceRefCount}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-dim text-w-sm">No linked traces in retained history.</div>
              )}
            </div>

            <div className="border border-border px-3 py-2">
              <div className="mb-2 flex items-center gap-2 font-mono text-dim text-w-sm uppercase tracking-[0.18em]">
                <AlertTriangleIcon className="icon-xs" /> Actions
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedDetail.record.type === "memory" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onDeleteMemory}
                    disabled={deletingMemoryId === selectedDetail.record.id}
                    className="uppercase-none gap-2"
                  >
                    <Trash2Icon className="icon-xs" />
                    {deletingMemoryId === selectedDetail.record.id
                      ? "Deleting\u2026"
                      : "Delete memory"}
                  </Button>
                )}
                {Boolean(selectedDetail.linkedTraces[0]) && (
                  <Button asChild variant="outline" size="sm" className="uppercase-none gap-2">
                    <Link
                      href={`/debug?tab=events&eventsTrace=${encodeURIComponent(selectedDetail.linkedTraces[0]?.id ?? "")}`}
                    >
                      <ExternalLinkIcon className="icon-xs" /> Inspect trace
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function computeActionPriority(item: KnowledgeHealthItem): number {
  return (
    (item.stale ? 3 : 0) +
    (item.attributionQuality === "inferred" ? 2 : 0) +
    ((item.negativeFeedbackCount ?? 0) > 0 ? 1 : 0)
  );
}

function useKnowledgeHealthData(filters: {
  selectedProject: string;
  selectedType: string;
  selectedStale: string;
  selectedFeedback: string;
  selectedEvidence: string;
  deferredSearchQuery: string;
}) {
  const summary = useSWR<KnowledgeHealthSummaryResponse>(
    API_ROUTES.knowledgeHealthSummary,
    fetchJson,
    { revalidateOnFocus: false }
  );

  const itemsUrl = useMemo(
    () =>
      buildUrl(API_ROUTES.knowledgeHealthItems, {
        project: filters.selectedProject,
        type: filters.selectedType,
        stale: filters.selectedStale,
        feedback: filters.selectedFeedback,
        evidence: filters.selectedEvidence,
        query: filters.deferredSearchQuery.trim() || null,
        limit: "50",
      }),
    [
      filters.deferredSearchQuery,
      filters.selectedEvidence,
      filters.selectedFeedback,
      filters.selectedProject,
      filters.selectedStale,
      filters.selectedType,
    ]
  );
  const items = useSWR<KnowledgeHealthItemsResponse>(itemsUrl, fetchJson, {
    revalidateOnFocus: false,
  });

  const projectUrl = useMemo(() => {
    if (filters.selectedProject === "all") return null;
    return `${API_ROUTES.knowledgeHealthProjectsBase}/${encodeURIComponent(filters.selectedProject)}`;
  }, [filters.selectedProject]);
  const project = useSWR<KnowledgeHealthProjectResponse>(projectUrl, fetchJson, {
    revalidateOnFocus: false,
  });

  return { summary, items, project };
}

function ActionQueuePanel({
  actionItems,
  selectedItemId,
  setSelectedItemId,
  error,
}: {
  actionItems: KnowledgeHealthItem[];
  selectedItemId: string | null;
  setSelectedItemId: (id: string) => void;
  error: string | null;
}) {
  return (
    <section className="min-h-0 border-border border-r">
      <PanelHeader
        title="Needs Action"
        subtitle="Start here. These are the items most likely to need review."
        count={`${actionItems.length} queued`}
      />
      <div className="scrollbar-thin max-h-[calc(100vh-270px)] overflow-y-auto overflow-x-hidden">
        {Boolean(error) && <EmptyPanel message={error!} />}
        {!error && actionItems.length === 0 && (
          <EmptyPanel message="No immediate action items for the current filters." />
        )}
        {!error &&
          actionItems.length > 0 &&
          actionItems.map((item) => (
            <Button
              key={`action-${item.id}`}
              type="button"
              variant="ghost"
              onClick={() => setSelectedItemId(item.id)}
              className={cn(
                "uppercase-none flex h-auto w-full flex-col items-start gap-2 rounded-none border-border border-b px-3 py-2 text-left font-sans transition-colors hover:bg-muted",
                selectedItemId === item.id && "bg-accent/10"
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="font-mono text-dim text-w-sm uppercase tracking-[0.16em]">
                  {getActionReason(item)}
                </span>
                <span className="font-mono text-dim text-w-sm">
                  {formatRelativeTime(item.lastUsedAt)}
                </span>
              </div>
              <div className="truncate text-foreground text-w-base">{item.title}</div>
              <div className="text-muted-foreground text-w-sm">
                {getProjectLabel(item.projectSlug)} · {item.type} · {getFeedbackLabel(item)}
              </div>
            </Button>
          ))}
      </div>
    </section>
  );
}

function InventoryPanel({
  itemRows,
  itemCount,
  selectedItemId,
  setSelectedItemId,
  error,
}: {
  itemRows: KnowledgeHealthItem[];
  itemCount: number;
  selectedItemId: string | null;
  setSelectedItemId: (id: string) => void;
  error: string | null;
}) {
  return (
    <section className="min-h-0 border-border border-r">
      <PanelHeader
        title="Knowledge Inventory"
        subtitle="Operational list of memories and artifacts in the current scope."
        count={`${compactNumber(itemCount)} in scope`}
      />
      <div className="scrollbar-thin max-h-[calc(100vh-270px)] overflow-y-auto overflow-x-hidden">
        {Boolean(error) && <EmptyPanel message={error!} />}
        {!error && itemRows.length === 0 && (
          <EmptyPanel message="No knowledge items match the current filters." />
        )}
        {!error &&
          itemRows.length > 0 &&
          itemRows.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              onClick={() => setSelectedItemId(item.id)}
              className={cn(
                "uppercase-none flex h-auto w-full flex-col items-start gap-2 rounded-none border-border border-b px-3 py-2 text-left font-sans transition-colors hover:bg-muted",
                selectedItemId === item.id && "bg-accent/10"
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "border px-1.5 py-0.5 font-mono text-w-sm uppercase tracking-[0.16em]",
                      getTypeBadgeClassName(item)
                    )}
                  >
                    {item.type}
                  </span>
                  <span className="truncate text-foreground text-w-base">{item.title}</span>
                </div>
                <span className="shrink-0 font-mono text-dim text-w-sm">
                  {formatRelativeTime(item.lastUsedAt)}
                </span>
              </div>
              <div className="line-clamp-2 text-muted-foreground text-w-sm leading-5">
                {item.summary || "No summary available."}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-dim text-w-sm">
                <span>{getProjectLabel(item.projectSlug)}</span>
                <span>uses {formatNullableCount(item.useCount)}</span>
                <span>{getFeedbackLabel(item)}</span>
                <span>{item.evidenceRefCount} refs</span>
              </div>
            </Button>
          ))}
      </div>
    </section>
  );
}

function KnowledgeFilterBar({
  filters,
  projectOptions,
}: {
  filters: ReturnType<typeof useFilterState>;
  projectOptions: Array<{ projectSlug: string | null; projectName: string }>;
}) {
  const {
    searchQuery,
    setSearchQuery,
    selectedProject,
    setSelectedProject,
    selectedType,
    setSelectedType,
    selectedStale,
    setSelectedStale,
    selectedFeedback,
    setSelectedFeedback,
    selectedEvidence,
    setSelectedEvidence,
  } = filters;

  return (
    <div className="border-border border-b px-4 py-2">
      <div className="grid gap-2 lg:grid-cols-[1.15fr_1.15fr_1fr_1fr_1fr]">
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projectOptions.map((projectOption) => (
              <SelectItem
                key={projectOption.projectSlug ?? GLOBAL_PROJECT_FILTER}
                value={projectOption.projectSlug ?? GLOBAL_PROJECT_FILTER}
              >
                {projectOption.projectName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedType}
          onValueChange={(v) => setSelectedType(v as typeof selectedType)}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All item types</SelectItem>
            <SelectItem value="memory">Memory</SelectItem>
            <SelectItem value="artifact">Artifact</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={selectedStale}
          onValueChange={(v) => setSelectedStale(v as typeof selectedStale)}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Fresh + stale</SelectItem>
            <SelectItem value="true">Stale only</SelectItem>
            <SelectItem value="false">Recently used</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={selectedFeedback}
          onValueChange={(v) => setSelectedFeedback(v as typeof selectedFeedback)}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any feedback</SelectItem>
            <SelectItem value="positive">Positive only</SelectItem>
            <SelectItem value="negative">Negative only</SelectItem>
            <SelectItem value="mixed">Mixed ratings</SelectItem>
            <SelectItem value="any">Rated items</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={selectedEvidence}
          onValueChange={(v) => setSelectedEvidence(v as typeof selectedEvidence)}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any evidence</SelectItem>
            <SelectItem value="present">Evidence-backed</SelectItem>
            <SelectItem value="none">No evidence</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-2">
        <Input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search memories and artifacts..."
          size="sm"
          className="w-full"
        />
      </div>
    </div>
  );
}

function useFilterState() {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedType, setSelectedType] = useState<"all" | "memory" | "artifact">("all");
  const [selectedStale, setSelectedStale] = useState<"all" | "true" | "false">("all");
  const [selectedFeedback, setSelectedFeedback] = useState<
    "all" | "positive" | "negative" | "mixed" | "any"
  >("all");
  const [selectedEvidence, setSelectedEvidence] = useState<"all" | "present" | "none">("all");
  return {
    searchQuery,
    setSearchQuery,
    deferredSearchQuery,
    selectedProject,
    setSelectedProject,
    selectedType,
    setSelectedType,
    selectedStale,
    setSelectedStale,
    selectedFeedback,
    setSelectedFeedback,
    selectedEvidence,
    setSelectedEvidence,
  };
}

function useItemSelection(itemRows: KnowledgeHealthItem[], actionItems: KnowledgeHealthItem[]) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    const currentIds = new Set(itemRows.map((item) => item.id));
    if (selectedItemId && currentIds.has(selectedItemId)) return;
    setSelectedItemId(actionItems[0]?.id ?? itemRows[0]?.id ?? null);
  }, [actionItems, itemRows, selectedItemId]);

  const selectedListItem =
    itemRows.find((item) => item.id === selectedItemId) ??
    actionItems.find((item) => item.id === selectedItemId) ??
    null;

  return { selectedItemId, setSelectedItemId, selectedListItem };
}

export function KnowledgeHealthDashboard() {
  const filters = useFilterState();
  const [deletingMemoryId, setDeletingMemoryId] = useState<string | null>(null);

  const { summary, items, project } = useKnowledgeHealthData({
    selectedProject: filters.selectedProject,
    selectedType: filters.selectedType,
    selectedStale: filters.selectedStale,
    selectedFeedback: filters.selectedFeedback,
    selectedEvidence: filters.selectedEvidence,
    deferredSearchQuery: filters.deferredSearchQuery,
  });

  const summaryData = summary.data?.summary ?? null;
  const projectData = project.data?.project ?? null;
  const itemRows = items.data?.items ?? [];

  const actionItems = useMemo(
    () =>
      itemRows
        .filter((item) => computeActionPriority(item) > 0)
        .sort((left, right) => {
          const diff = computeActionPriority(right) - computeActionPriority(left);
          return diff !== 0 ? diff : left.title.localeCompare(right.title);
        })
        .slice(0, 12),
    [itemRows]
  );

  const { selectedItemId, setSelectedItemId, selectedListItem } = useItemSelection(
    itemRows,
    actionItems
  );

  const detailUrl = useMemo(() => {
    if (!selectedItemId) return null;
    return `${API_ROUTES.knowledgeHealthItemBase}/${encodeURIComponent(selectedItemId)}`;
  }, [selectedItemId]);

  const detail = useSWR<KnowledgeHealthItemDetailResponse>(detailUrl, fetchJson, {
    revalidateOnFocus: false,
  });
  const selectedDetail = detail.data?.item ?? null;

  const handleRefresh = async () => {
    await Promise.all([summary.mutate(), items.mutate(), project.mutate(), detail.mutate()]);
  };

  const handleDeleteMemory = async () => {
    if (!selectedDetail || selectedDetail.record.type !== "memory") return;
    try {
      setDeletingMemoryId(selectedDetail.record.id);
      const response = await fetch(API_ROUTES.chatMemory, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedDetail.record.id }),
      });
      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`);
      }
      setSelectedItemId(null);
      await Promise.all([summary.mutate(), items.mutate(), project.mutate(), detail.mutate()]);
    } finally {
      setDeletingMemoryId(null);
    }
  };

  const projectOptions = summaryData?.projects ?? [];
  const staleCount = projectData?.staleCount ?? summaryData?.totals.staleCount ?? 0;
  const knowledgeBackedCount =
    projectData?.knowledgeBackedRunCount ?? summaryData?.totals.knowledgeBackedRunCount ?? 0;
  const itemCount = projectData?.itemCount ?? summaryData?.totals.itemCount ?? 0;
  const recentlyUsedCount =
    projectData?.recentlyUsedCount ?? summaryData?.totals.recentlyUsedCount ?? 0;

  const { selectedProject, setSelectedProject } = filters;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex items-center gap-4 border-border border-b px-4 py-2">
        <Link
          href="/"
          className="text-dim text-w-sm uppercase tracking-wider transition-colors hover:text-foreground-secondary"
        >
          ← Dashboard
        </Link>
        <span className="text-border">/</span>
        <span className="text-foreground-secondary text-w-sm uppercase tracking-wider">
          Knowledge Health
        </span>
        <div className="ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="uppercase-none gap-2"
          >
            <RefreshCwIcon className="icon-xs" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="border-border border-b px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="font-mono text-dim text-w-sm uppercase tracking-[0.18em]">
                Knowledge Health
              </div>
              <div className="mt-1 max-w-[760px] text-muted-foreground text-w-base leading-5">
                Start with the action queue. Review stale or inferred items, inspect trace usage,
                then prune low-signal memories.
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <HeaderStat
                label="Needs review"
                value={compactNumber(actionItems.length)}
                tone={actionItems.length > 0 ? "warning" : "neutral"}
              />
              <HeaderStat
                label="Stale"
                value={compactNumber(staleCount)}
                tone={staleCount > 0 ? "warning" : "neutral"}
              />
              <HeaderStat
                label="Used recently"
                value={compactNumber(recentlyUsedCount)}
                tone="accent"
              />
              <HeaderStat
                label="Knowledge-backed"
                value={compactNumber(knowledgeBackedCount)}
                tone="accent"
              />
            </div>
          </div>
        </div>

        <KnowledgeFilterBar filters={filters} projectOptions={projectOptions} />

        <div className="border-border border-b px-4 py-2">
          <div className="flex flex-wrap gap-2">
            {projectOptions.map((projectSummary) => (
              <ProjectScopeButton
                key={projectSummary.projectSlug ?? GLOBAL_PROJECT_FILTER}
                project={projectSummary}
                active={(projectSummary.projectSlug ?? GLOBAL_PROJECT_FILTER) === selectedProject}
                onSelect={setSelectedProject}
              />
            ))}
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-1 border-border border-b xl:grid-cols-[320px_minmax(0,1fr)_420px]">
          <ActionQueuePanel
            actionItems={actionItems}
            selectedItemId={selectedItemId}
            setSelectedItemId={setSelectedItemId}
            error={summary.error?.message ?? null}
          />

          <InventoryPanel
            itemRows={itemRows}
            itemCount={itemCount}
            selectedItemId={selectedItemId}
            setSelectedItemId={setSelectedItemId}
            error={items.error?.message ?? null}
          />

          <KnowledgeDetailSection
            selectedListItem={selectedListItem}
            selectedDetail={selectedDetail}
            detailError={detail.error?.message ?? null}
            deletingMemoryId={deletingMemoryId}
            onDeleteMemory={handleDeleteMemory}
          />
        </div>
      </div>
    </div>
  );
}
