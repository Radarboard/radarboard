"use client";

import { getAssistantModeLabel } from "@radarboard/assistant-core/assistant-workflows";
import { API_ROUTES } from "@radarboard/types/api-routes";
import type { AssistantArtifactRow } from "@radarboard/types/database";
import { Button } from "@radarboard/ui/button";
import { ChevronDownIcon, FileTextIcon, Loader2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { ChatArtifactPreview } from "./chat-artifact-preview";
import { useChatContext } from "./chat-context";

async function fetchArtifacts(url: string): Promise<AssistantArtifactRow[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load artifacts: ${res.status}`);
  }
  return (await res.json()) as AssistantArtifactRow[];
}

function statusClass(status: AssistantArtifactRow["status"]): string {
  switch (status) {
    case "completed":
      return "text-green-400 border-green-500/20 bg-green-500/5";
    case "blocked":
      return "text-red-400 border-red-500/20 bg-red-500/5";
    case "needs_input":
      return "text-yellow-400 border-yellow-500/20 bg-yellow-500/5";
    case "failed":
      return "text-red-400 border-red-500/20 bg-red-500/5";
    default:
      return "text-[var(--color-text-muted)] border-[var(--color-border)] bg-[var(--color-surface)]";
  }
}

export function ChatArtifacts() {
  const { activeThreadId, pinnedProject, threads, selectedMode, session } = useChatContext();
  const [isExpanded, setIsExpanded] = useState(false);

  const activeProject = useMemo(() => {
    const activeThread = threads.find((thread) => thread.id === activeThreadId);
    return pinnedProject ?? activeThread?.projectSlug ?? null;
  }, [threads, activeThreadId, pinnedProject]);
  const artifactsUrl = useMemo(() => {
    if (!activeThreadId && !activeProject) return null;
    const params = new URLSearchParams({ limit: "6" });
    if (activeProject) params.set("projectSlug", activeProject);
    else if (activeThreadId) params.set("sourceConversationId", activeThreadId);
    return `${API_ROUTES.chatArtifacts}?${params.toString()}`;
  }, [activeProject, activeThreadId]);
  const {
    data: artifacts = [],
    isLoading,
    isValidating,
    mutate,
  } = useSWR<AssistantArtifactRow[]>(artifactsUrl, fetchArtifacts, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const latestArtifact = artifacts[0] ?? null;
  const isRefreshing = isLoading || isValidating;
  const shouldRender = artifacts.length > 0 || isRefreshing || selectedMode !== "default";

  useEffect(() => {
    if (session.status !== "ready" || artifactsUrl === null) return;
    const delayed = window.setTimeout(() => {
      mutate().catch(() => {
        /* fire-and-forget */
      });
    }, 1200);
    return () => {
      window.clearTimeout(delayed);
    };
  }, [artifactsUrl, mutate, session.status]);

  if (!shouldRender) return null;

  const getCollapsedSummary = () => {
    if (latestArtifact)
      return `${getAssistantModeLabel(latestArtifact.mode)} · ${latestArtifact.title}`;
    if (isRefreshing) return "Loading latest artifact…";
    return `${getAssistantModeLabel(selectedMode)} artifacts will appear here after the run completes.`;
  };
  const collapsedSummary = getCollapsedSummary();

  return (
    <div className="border-[var(--color-border)] border-b px-3 py-1.5">
      <Button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        variant="ghost"
        uppercase={false}
        fullWidth
        className="h-auto px-1.5 py-1.5 text-left hover:bg-[var(--color-hover)]/40"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2 font-mono text-[var(--color-text-muted)] text-w-sm uppercase tracking-widest">
          <ChevronDownIcon
            size={12}
            className={`shrink-0 transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`}
          />
          <FileTextIcon size={11} className="shrink-0" />
          <span className="truncate">Workflow Artifacts</span>
          {Boolean(isRefreshing) && <Loader2Icon size={11} className="shrink-0 animate-spin" />}
          {artifacts.length > 0 && (
            <span className="ml-auto shrink-0 rounded-item border border-[var(--color-border)] px-1.5 py-0.5 text-[var(--color-text-muted)] text-w-sm">
              {artifacts.length}
            </span>
          )}
        </div>

        <div className="mt-1 pl-6">
          {latestArtifact ? (
            <>
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-w-sm ${statusClass(latestArtifact.status)}`}
                >
                  {latestArtifact.status}
                </span>
                <span className="shrink-0 font-mono text-[var(--color-text-muted)] text-w-sm uppercase">
                  {getAssistantModeLabel(latestArtifact.mode)}
                </span>
                <span className="truncate font-mono text-[var(--color-text)] text-w-sm">
                  {latestArtifact.title}
                </span>
              </div>
              <p className="mt-1 truncate font-mono text-[var(--color-text-muted)] text-w-sm">
                {latestArtifact.summary}
              </p>
            </>
          ) : (
            <p className="truncate font-mono text-[var(--color-text-muted)] text-w-sm">
              {collapsedSummary}
            </p>
          )}
        </div>
      </Button>

      {isExpanded && artifacts.length > 0 && (
        <div className="scrollbar-thin mt-1 max-h-[220px] overflow-y-auto overflow-x-hidden px-1.5 pb-1">
          <div className="space-y-2">
            {artifacts.map((artifact) => (
              <details
                key={artifact.id}
                className="rounded-card border border-[var(--color-border)] bg-[var(--color-surface)]/80"
              >
                <summary className="cursor-pointer list-none px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-w-sm ${statusClass(artifact.status)}`}
                    >
                      {artifact.status}
                    </span>
                    <span className="shrink-0 font-mono text-[var(--color-text-muted)] text-w-sm uppercase">
                      {getAssistantModeLabel(artifact.mode)}
                    </span>
                    <span className="truncate font-mono text-[var(--color-text)] text-w-sm">
                      {artifact.title}
                    </span>
                    {artifact.evidenceRefs.length > 0 && (
                      <span className="shrink-0 rounded-item border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[var(--color-text-muted)] text-w-sm uppercase tracking-widest">
                        refs {artifact.evidenceRefs.length}
                      </span>
                    )}
                    {artifact.contentType !== "markdown" && (
                      <span className="shrink-0 rounded-item border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[var(--color-text-muted)] text-w-sm uppercase tracking-widest">
                        {artifact.contentType}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 overflow-x-hidden font-mono text-[var(--color-text-muted)] text-w-sm">
                    {artifact.summary}
                  </p>
                  {artifact.nextMode && artifact.nextReason ? (
                    <p className="mt-1 font-mono text-[var(--color-accent)]/80 text-w-sm">
                      Next: {getAssistantModeLabel(artifact.nextMode)}. {artifact.nextReason}
                    </p>
                  ) : null}
                </summary>
                <div className="space-y-3 border-[var(--color-border)] border-t px-3 py-2">
                  <ChatArtifactPreview artifact={artifact} />
                  {artifact.contentType !== "markdown" && (
                    <details className="rounded-item border border-[var(--color-border)] bg-[#0b0d10]">
                      <summary className="cursor-pointer px-3 py-2 font-mono text-[var(--color-text-muted)] text-w-sm uppercase tracking-widest">
                        Source
                      </summary>
                      <pre className="overflow-x-hidden whitespace-pre-wrap break-words border-[var(--color-border)] border-t px-3 py-2 font-mono text-[var(--color-text-muted)] text-w-sm">
                        {artifact.body}
                      </pre>
                    </details>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
