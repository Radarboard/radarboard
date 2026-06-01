"use client";

import { parseAsString, useQueryState } from "nuqs";
import type React from "react";
import { lazy, Suspense } from "react";
import { DEFAULT_DEBUG_SECTION, type DebugSectionId } from "../registry";
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

// ---------------------------------------------------------------------------
// Root section content
// ---------------------------------------------------------------------------

export function DebugDashboard() {
  const [activeSection] = useQueryState("tab", parseAsString.withDefault(DEFAULT_DEBUG_SECTION));

  const sectionId = (activeSection ?? DEFAULT_DEBUG_SECTION) as DebugSectionId;
  const SectionComponent = SECTION_COMPONENTS[sectionId];

  if (!SectionComponent) {
    return (
      <div className="py-8 text-center font-mono text-dim text-w-sm">
        Section not found: {sectionId}
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingState />}>
      <SectionComponent />
    </Suspense>
  );
}
