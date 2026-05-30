"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { LlmMemoryRow } from "@radarboard/types/database";
import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DebugBadge, DebugSection, LoadingState, relativeTime, SectionHeader } from "../../shared";

export function MemorySection() {
  const [memories, setMemories] = useState<LlmMemoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(API_ROUTES.debugMemories);
    const data = (await res.json()) as { memories: LlmMemoryRow[] };
    setMemories(data.memories ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => {
      /* fire-and-forget */
    });
  }, [load]);

  const deleteMemory = async (id: string) => {
    await fetch(API_ROUTES.debugMemories, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <DebugSection>
      <SectionHeader label={`${memories.length} memories stored`} onRefresh={load} />

      {Boolean(loading) && <LoadingState />}
      {!loading && memories.length === 0 && (
        <EmptyState message="No memories yet — the AI will store facts here during conversations." />
      )}
      {!loading && memories.length > 0 && (
        <div className="flex flex-col gap-2">
          {memories.map((m) => (
            <div
              key={m.id}
              className="group flex items-start gap-3 border border-border bg-surface px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <DebugBadge variant="accent">{m.key}</DebugBadge>
                  {Boolean(m.projectSlug) && (
                    <DebugBadge variant="muted">{m.projectSlug}</DebugBadge>
                  )}
                  <span className="ml-auto font-mono text-dim text-w-sm">
                    {relativeTime(m.updatedAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap font-mono text-foreground-secondary text-w-base leading-relaxed">
                  {m.value}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      deleteMemory(m.id).catch(() => {
                        /* fire-and-forget */
                      })
                    }
                    className="uppercase-none icon-lg p-0 text-dim opacity-0 transition-opacity hover:bg-transparent hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2Icon className="icon-xs" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete memory</TooltipContent>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </DebugSection>
  );
}
