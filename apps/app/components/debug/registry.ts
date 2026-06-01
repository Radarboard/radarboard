import type { LucideIcon } from "lucide-react";
import {
  ActivityIcon,
  BrainIcon,
  BugIcon,
  DatabaseIcon,
  FileTextIcon,
  GaugeIcon,
  HeartPulseIcon,
  LogsIcon,
  MessageSquareIcon,
  PuzzleIcon,
  WebhookIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Debug section registry
//
// To add a new section:
//   1. Create `apps/app/components/debug/sections/<id>.tsx`
//   2. Add one entry to DEBUG_SECTIONS below.
//   Nothing else needs to change.
// ---------------------------------------------------------------------------

export interface DebugSectionDescriptor {
  id: string;
  label: string;
  title: string;
  icon: LucideIcon;
  /** Short description shown in the page header. */
  description: string;
  /** Public documentation URL for this debug surface. */
  docsHref: string;
  /** Group heading in the sidebar nav. */
  group: DebugSectionGroupId;
}

export interface DebugSandboxDescriptor {
  id: string;
  label: string;
  title: string;
  description: string;
  docsHref: string;
  href: string;
  icon: LucideIcon;
}

export type DebugSectionGroupId = "overview" | "assistant" | "runtime";

export const DEBUG_SECTION_GROUPS: Array<{ id: DebugSectionGroupId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "assistant", label: "Assistant" },
  { id: "runtime", label: "Runtime" },
];

export const DEFAULT_DEBUG_SECTION = "extension-health";

export const DEBUG_SECTIONS: DebugSectionDescriptor[] = [
  // Overview group
  {
    id: "extension-health",
    label: "Extension Health",
    title: "Extension Health",
    icon: PuzzleIcon,
    description:
      "Audit registered widgets, plugins, integrations, data sources, and extension issues.",
    docsHref: "https://docs.radarboard.app/developer-guide/debug-panels#extension-health",
    group: "overview",
  },
  {
    id: "health",
    label: "Service Health",
    title: "Service Health",
    icon: HeartPulseIcon,
    description: "Monitor integration availability, data source latency, and recent failures.",
    docsHref: "https://docs.radarboard.app/developer-guide/debug-panels#service-health",
    group: "overview",
  },
  {
    id: "cache",
    label: "Response Cache",
    title: "Response Cache",
    icon: DatabaseIcon,
    description: "Review cached API responses, fetch times, TTLs, and expiration status.",
    docsHref: "https://docs.radarboard.app/developer-guide/debug-panels#response-cache",
    group: "overview",
  },

  // Assistant group
  {
    id: "conversations",
    label: "Conversations",
    title: "Conversations",
    icon: MessageSquareIcon,
    description: "Browse saved assistant conversations and the project context attached to them.",
    docsHref: "https://docs.radarboard.app/developer-guide/debug-panels#conversations",
    group: "assistant",
  },
  {
    id: "traces",
    label: "LLM Traces",
    title: "LLM Traces",
    icon: ActivityIcon,
    description: "Inspect AI requests, token usage, model latency, costs, and trace details.",
    docsHref: "https://docs.radarboard.app/developer-guide/debug-panels#llm-traces",
    group: "assistant",
  },
  {
    id: "memory",
    label: "AI Memory",
    title: "AI Memory",
    icon: BrainIcon,
    description:
      "Review persistent facts the assistant has stored across projects and conversations.",
    docsHref: "https://docs.radarboard.app/developer-guide/debug-panels#ai-memory",
    group: "assistant",
  },
  {
    id: "reports",
    label: "Reports",
    title: "Reports",
    icon: FileTextIcon,
    description: "Find generated analysis reports and exports created from assistant workflows.",
    docsHref: "https://docs.radarboard.app/developer-guide/debug-panels#reports",
    group: "assistant",
  },

  // Runtime group
  {
    id: "events",
    label: "Debug Events",
    title: "Debug Events",
    icon: LogsIcon,
    description:
      "Search durable debug events emitted by chat, plugins, integrations, and MCP tools.",
    docsHref: "https://docs.radarboard.app/developer-guide/debug-panels#debug-events",
    group: "runtime",
  },
  {
    id: "spans",
    label: "Performance Spans",
    title: "Performance Spans",
    icon: GaugeIcon,
    description:
      "Inspect timed spans across API routes, integrations, plugins, and background work.",
    docsHref: "https://docs.radarboard.app/developer-guide/debug-panels#performance-spans",
    group: "runtime",
  },
  {
    id: "client-issues",
    label: "Client Issues",
    title: "Client Issues",
    icon: BugIcon,
    description: "Inspect grouped browser runtime errors, API failures, and React client issues.",
    docsHref: "https://docs.radarboard.app/developer-guide/debug-panels#client-issues",
    group: "runtime",
  },
  {
    id: "webhook-relay",
    label: "Webhook Relay",
    title: "Webhook Relay",
    icon: WebhookIcon,
    description: "Inspect inbound webhook relay events, payload summaries, and delivery outcomes.",
    docsHref: "https://docs.radarboard.app/developer-guide/debug-panels#webhook-relay",
    group: "runtime",
  },
];

export const DEBUG_SANDBOXES: DebugSandboxDescriptor[] = [
  {
    id: "integration-sandbox",
    label: "Integration Sandbox",
    title: "Integration Sandbox",
    description:
      "Inspect integration descriptors, credential fields, data sources, MCP tools, and mock fetches.",
    docsHref: "https://docs.radarboard.app/developer-guide/debug-sandboxes#integration-sandbox",
    href: "/debug/integration-sandbox",
    icon: DatabaseIcon,
  },
  {
    id: "widget-sandbox",
    label: "Widget Sandbox",
    title: "Widget Sandbox",
    description: "Render every registered widget with happy, empty, loading, and error states.",
    docsHref: "https://docs.radarboard.app/developer-guide/debug-sandboxes#widget-sandbox",
    href: "/debug/widget-sandbox",
    icon: PuzzleIcon,
  },
  {
    id: "widget-composition",
    label: "Widget Composition",
    title: "Widget Composition Lab",
    description:
      "Review deterministic template recipe examples for composition and visual coverage.",
    docsHref: "https://docs.radarboard.app/developer-guide/debug-sandboxes#widget-composition",
    href: "/debug/widget-composition",
    icon: GaugeIcon,
  },
  {
    id: "plugin-sandbox",
    label: "Plugin Sandbox",
    title: "Plugin Sandbox",
    description: "Preview every registered plugin across runtime states and presentation modes.",
    docsHref: "https://docs.radarboard.app/developer-guide/debug-sandboxes#plugin-sandbox",
    href: "/debug/plugin-sandbox",
    icon: ActivityIcon,
  },
];

export type DebugSectionId = (typeof DEBUG_SECTIONS)[number]["id"];
export type DebugSandboxId = (typeof DEBUG_SANDBOXES)[number]["id"];

export const DEBUG_SECTION_MAP = new Map(DEBUG_SECTIONS.map((s) => [s.id, s]));
export const DEBUG_SANDBOX_MAP = new Map(DEBUG_SANDBOXES.map((s) => [s.id, s]));
