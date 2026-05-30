"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import type React from "react";
import { lazy, Suspense } from "react";
import { DEBUG_SECTIONS, type DebugSectionId } from "../registry";
import { LoadingState } from "../shared";

// ---------------------------------------------------------------------------
// Lazy-load section components so each tab is code-split
// ---------------------------------------------------------------------------

const SECTION_COMPONENTS: Record<string, React.ComponentType> = {
  traces: lazy(() => import("../sections/traces").then((m) => ({ default: m.TracesSection }))),
  memory: lazy(() => import("../sections/memory").then((m) => ({ default: m.MemorySection }))),
  conversations: lazy(() =>
    import("../sections/conversations").then((m) => ({ default: m.ConversationsSection }))
  ),
  reports: lazy(() => import("../sections/reports").then((m) => ({ default: m.ReportsSection }))),
  health: lazy(() => import("../sections/health").then((m) => ({ default: m.HealthSection }))),
  spans: lazy(() => import("../sections/spans").then((m) => ({ default: m.SpansSection }))),
  cache: lazy(() => import("../sections/cache").then((m) => ({ default: m.CacheSection }))),
  events: lazy(() => import("../sections/events").then((m) => ({ default: m.EventsSection }))),
  "client-issues": lazy(() =>
    import("../sections/client-issues").then((m) => ({ default: m.ClientIssuesSection }))
  ),
  "webhook-relay": lazy(() =>
    import("../sections/webhook-relay").then((m) => ({ default: m.WebhookRelaySection }))
  ),
  "extension-health": lazy(() =>
    import("../sections/extension-health").then((m) => ({ default: m.ExtensionHealthSection }))
  ),
};

const DEFAULT_SECTION = "traces";

// ---------------------------------------------------------------------------
// Sidebar navigation
// ---------------------------------------------------------------------------

const GROUP_LABELS: Record<string, string> = {
  ai: "AI",
  system: "System",
};

function DebugSidebar({
  active,
  onSelect,
}: {
  active: DebugSectionId;
  onSelect: (id: DebugSectionId) => void;
}) {
  // Group sections
  const groups = [...new Set(DEBUG_SECTIONS.map((s) => s.group))];

  return (
    <nav className="scrollbar-thin w-[180px] flex-shrink-0 overflow-y-auto border-border border-r py-2">
      {groups.map((group) => (
        <div key={group}>
          <div className="px-4 py-2 font-mono text-dim text-w-sm uppercase tracking-widest">
            {GROUP_LABELS[group] ?? group}
          </div>
          {DEBUG_SECTIONS.filter((s) => s.group === group).map((section) => {
            const Icon = section.icon;
            const isActive = active === section.id;
            return (
              <Button
                key={section.id}
                type="button"
                variant="ghost"
                onClick={() => onSelect(section.id as DebugSectionId)}
                className={cn(
                  "uppercase-none flex h-auto w-full items-center gap-2 rounded-none border-l-2 px-4 py-2 text-left font-mono font-normal text-w-sm transition-colors",
                  isActive
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-transparent text-dim hover:bg-muted hover:text-foreground-secondary"
                )}
              >
                <Icon className="icon-xs flex-shrink-0" />
                {section.label}
              </Button>
            );
          })}
        </div>
      ))}
      {/* Dev sandboxes — standalone pages */}
      <div>
        <div className="px-4 py-2 font-mono text-dim text-w-sm uppercase tracking-widest">
          Dev Sandboxes
        </div>
        <Link
          href="/debug/widget-sandbox"
          className="flex h-auto w-full items-center gap-2 border-transparent border-l-2 px-4 py-2 text-left font-mono text-dim text-w-sm transition-colors hover:bg-muted hover:text-foreground-secondary"
        >
          Widget Sandbox
        </Link>
        <Link
          href="/debug/plugin-sandbox"
          className="flex h-auto w-full items-center gap-2 border-transparent border-l-2 px-4 py-2 text-left font-mono text-dim text-w-sm transition-colors hover:bg-muted hover:text-foreground-secondary"
        >
          Plugin Sandbox
        </Link>
        <Link
          href="/debug/integration-sandbox"
          className="flex h-auto w-full items-center gap-2 border-transparent border-l-2 px-4 py-2 text-left font-mono text-dim text-w-sm transition-colors hover:bg-muted hover:text-foreground-secondary"
        >
          Integration Sandbox
        </Link>
        <Link
          href="/debug/widget-composition"
          className="flex h-auto w-full items-center gap-2 border-transparent border-l-2 px-4 py-2 text-left font-mono text-dim text-w-sm transition-colors hover:bg-muted hover:text-foreground-secondary"
        >
          Composition Lab
        </Link>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Root dashboard
// ---------------------------------------------------------------------------

export function DebugDashboard() {
  const [activeSection, setActiveSection] = useQueryState(
    "tab",
    parseAsString.withDefault(DEFAULT_SECTION)
  );

  const sectionId = (activeSection ?? DEFAULT_SECTION) as DebugSectionId;
  const SectionComponent = SECTION_COMPONENTS[sectionId];
  const descriptor = DEBUG_SECTIONS.find((s) => s.id === sectionId);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background font-mono text-muted-foreground">
      {/* Top bar */}
      <div className="flex flex-shrink-0 items-center gap-3 border-border border-b px-4 py-2">
        <Link
          href="/"
          className="text-dim text-w-sm uppercase tracking-wider transition-colors hover:text-foreground-secondary"
        >
          ← Dashboard
        </Link>
        <span className="text-border">/</span>
        <span className="text-dim text-w-sm uppercase tracking-wider">Debug</span>
        {descriptor && (
          <>
            <span className="text-border">/</span>
            <span className="text-foreground-secondary text-w-sm uppercase tracking-wider">
              {descriptor.label}
            </span>
          </>
        )}
      </div>

      {/* Body: sidebar + content */}
      <div className="flex min-h-0 flex-1">
        <DebugSidebar active={sectionId} onSelect={setActiveSection} />

        <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
          {SectionComponent ? (
            <Suspense fallback={<LoadingState />}>
              <SectionComponent />
            </Suspense>
          ) : (
            <div className="py-8 text-center font-mono text-dim text-w-sm">
              Section not found: {sectionId}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
