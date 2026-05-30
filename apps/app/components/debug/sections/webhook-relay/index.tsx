"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import { Input } from "@radarboard/ui/input";
import { cn } from "@radarboard/utils/cn";
import { useHotkey } from "@tanstack/react-hotkeys";
import { SearchIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DebugBadge, DebugSection, LoadingState, relativeTime, StatStrip } from "../../shared";

interface WebhookRelayEvent {
  id: string;
  externalId: string | null;
  source: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: string;
  error: string | null;
  occurredAt: string;
}

const STATUS_TONE: Record<string, "success" | "error" | "muted" | "warning"> = {
  success: "success",
  failed: "error",
  pending: "muted",
  retrying: "warning",
};

export function WebhookRelaySection() {
  const [liveParam, setLiveParam] = useQueryState("relayLive", parseAsString);
  const [sourceParam, setSourceParam] = useQueryState("relaySource", parseAsString);
  const [searchParam, setSearchParam] = useQueryState("relaySearch", parseAsString);
  const [relayUi, setRelayUi] = useState<{
    events: WebhookRelayEvent[];
    loading: boolean;
    loadingMore: boolean;
    nextBefore: string | null;
    selectedEventId: string | null;
  }>({
    events: [],
    loading: true,
    loadingMore: false,
    nextBefore: null,
    selectedEventId: null,
  });
  const { events, loading, loadingMore, nextBefore, selectedEventId } = relayUi;
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const live = liveParam === "1";
  const source = sourceParam ?? "";
  const search = searchParam ?? "";

  const buildParams = useCallback(
    (before?: string | null, after?: string | null) => {
      const params = new URLSearchParams({ limit: "100" });
      if (source.trim()) params.set("source", source.trim());
      if (search.trim()) params.set("search", search.trim());
      if (before) params.set("before", before);
      if (after) params.set("after", after);
      return params;
    },
    [search, source]
  );

  const load = useCallback(async () => {
    setRelayUi((current) => ({ ...current, loading: true }));
    try {
      const res = await fetch(`${API_ROUTES.debugWebhookRelay}?${buildParams().toString()}`);
      const data = (await res.json()) as {
        events?: WebhookRelayEvent[];
        nextBefore?: string | null;
      };
      setRelayUi((current) => ({
        ...current,
        events: data.events ?? [],
        nextBefore: data.nextBefore ?? null,
      }));
    } catch (_error) {
      // Failed to load — silent fail for now
    } finally {
      setRelayUi((current) => ({ ...current, loading: false }));
    }
  }, [buildParams]);

  const loadMore = useCallback(async () => {
    if (!nextBefore || loadingMore) return;
    setRelayUi((current) => ({ ...current, loadingMore: true }));
    try {
      const res = await fetch(
        `${API_ROUTES.debugWebhookRelay}?${buildParams(nextBefore).toString()}`
      );
      const data = (await res.json()) as {
        events?: WebhookRelayEvent[];
        nextBefore?: string | null;
      };
      setRelayUi((current) => {
        const existingIds = new Set(current.events.map((event) => event.id));
        const next = (data.events ?? []).filter((e) => !existingIds.has(e.id));
        return {
          ...current,
          events: [...current.events, ...next],
          nextBefore: data.nextBefore ?? null,
        };
      });
    } catch (_error) {
      // Failed to load — silent fail for now
    } finally {
      setRelayUi((current) => ({ ...current, loadingMore: false }));
    }
  }, [buildParams, loadingMore, nextBefore]);

  useEffect(() => {
    load().catch(() => {
      /* fire-and-forget */
    });
  }, [load]);

  const stats = useMemo(() => {
    const errorCount = events.filter((e) => e.status === "failed").length;
    const sources = new Set(events.map((e) => e.source)).size;
    return [
      { label: "Total Events", value: events.length.toString() },
      { label: "Failed", value: errorCount.toString() },
      { label: "Sources", value: sources.toString() },
    ];
  }, [events]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? events[0] ?? null,
    [events, selectedEventId]
  );

  useHotkey("/", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
      return;
    event.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  });

  return (
    <DebugSection className="h-full min-h-0">
      <StatStrip stats={stats} />

      <div className="flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface">
        <div className="sticky top-0 z-10 flex-shrink-0 border-border border-b bg-surface-raised/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={source}
              onChange={(e) =>
                setSourceParam(e.target.value || null).catch(() => {
                  /* fire-and-forget */
                })
              }
              placeholder="Source (e.g. github)"
              className="h-9 w-[200px]"
              aria-label="Filter by source"
            />
            <div className="relative min-w-[240px] flex-1">
              <SearchIcon className="icon-xs absolute top-1/2 left-3 -translate-y-1/2 text-dim" />
              <Input
                ref={searchInputRef}
                value={search}
                onChange={(e) =>
                  setSearchParam(e.target.value || null).catch(() => {
                    /* fire-and-forget */
                  })
                }
                placeholder="Search payloads, event types, external IDs..."
                className="h-9 w-full pl-9"
                aria-label="Search payloads"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={load}
              className="uppercase-none h-9 px-3 font-mono text-dim text-w-sm transition-colors hover:text-foreground"
            >
              Refresh
            </Button>
            <Button
              type="button"
              variant={live ? "default" : "outline"}
              onClick={() =>
                setLiveParam(live ? null : "1").catch(() => {
                  /* fire-and-forget */
                })
              }
              className={cn(
                "uppercase-none h-9 px-3 font-mono text-w-sm transition-colors",
                live
                  ? "border-accent/30 bg-accent/20 text-accent"
                  : "text-dim hover:text-foreground"
              )}
            >
              {live ? "Live on" : "Live off"}
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            {Boolean(loading) && <LoadingState />}
            {!loading && events.length === 0 && <EmptyState message="No relay events found." />}
            {!loading && events.length > 0 && (
              <div className="flex min-h-full flex-col">
                {events.map((event) => (
                  <Button
                    key={event.id}
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setRelayUi((current) => ({ ...current, selectedEventId: event.id }))
                    }
                    className={cn(
                      "uppercase-none h-auto w-full items-center justify-start rounded-none border-secondary border-b px-4 py-3 text-left font-sans transition-colors",
                      selectedEvent?.id === event.id ? "bg-accent/10" : "hover:bg-muted"
                    )}
                  >
                    <div className="grid w-full grid-cols-[80px_160px_minmax(0,1fr)_120px] items-center gap-4">
                      <div className="font-mono text-dim text-w-sm">
                        {relativeTime(event.occurredAt)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-mono text-accent text-w-sm">
                          {event.source}
                        </div>
                        <div className="truncate font-mono text-dim text-w-sm">
                          {event.eventType}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-mono text-foreground text-w-base">
                          {event.externalId ?? "no external id"}
                        </div>
                        <div className="truncate font-mono text-dim text-w-sm">
                          {JSON.stringify(event.payload).slice(0, 120)}...
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <DebugBadge variant={STATUS_TONE[event.status] ?? "default"}>
                          {event.status}
                        </DebugBadge>
                      </div>
                    </div>
                  </Button>
                ))}

                {Boolean(nextBefore) && (
                  <div className="flex justify-center p-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="uppercase-none h-9 px-4 font-mono text-dim text-w-sm transition-colors hover:text-foreground disabled:opacity-50"
                    >
                      {loadingMore ? "Loading more..." : "Load more"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="scrollbar-thin hidden w-[500px] overflow-y-auto border-border border-l bg-surface lg:block">
            {selectedEvent ? (
              <div className="space-y-6 p-5">
                <div>
                  <div className="mb-2 font-mono text-dim text-w-sm uppercase tracking-widest">
                    Event Details
                  </div>
                  <div className="space-y-2 font-mono text-w-sm">
                    <DetailRow label="Internal ID" value={selectedEvent.id} />
                    <DetailRow label="External ID" value={selectedEvent.externalId ?? "—"} />
                    <DetailRow label="Source" value={selectedEvent.source} />
                    <DetailRow label="Type" value={selectedEvent.eventType} />
                    <DetailRow label="Status" value={selectedEvent.status} />
                    <DetailRow
                      label="Time"
                      value={new Date(selectedEvent.occurredAt).toLocaleString()}
                    />
                  </div>
                </div>

                {Boolean(selectedEvent.error) && (
                  <div>
                    <div className="mb-2 font-mono text-destructive text-w-sm uppercase tracking-widest">
                      Error Message
                    </div>
                    <div className="break-words rounded-item border border-destructive/20 bg-destructive/5 p-3 font-mono text-destructive text-w-sm">
                      {selectedEvent.error}
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-2 font-mono text-dim text-w-sm uppercase tracking-widest">
                    Payload
                  </div>
                  <div className="overflow-hidden rounded-card border border-border bg-background">
                    <pre className="scrollbar-thin max-h-[600px] overflow-auto whitespace-pre-wrap break-words px-4 py-4 font-mono text-muted-foreground text-w-sm">
                      {JSON.stringify(selectedEvent.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center px-6 font-mono text-dim text-w-sm">
                Select an event to inspect its payload.
              </div>
            )}
          </div>
        </div>
      </div>
    </DebugSection>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3">
      <div className="text-dim">{label}</div>
      <div className="break-all text-foreground-secondary">{value}</div>
    </div>
  );
}
