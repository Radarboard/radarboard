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
  icon: LucideIcon;
  /** Short description shown in the sidebar (optional). */
  description?: string;
  /** Group heading in the sidebar nav. */
  group: "ai" | "system";
}

export const DEBUG_SECTIONS: DebugSectionDescriptor[] = [
  // AI group
  {
    id: "traces",
    label: "Traces",
    icon: ActivityIcon,
    description: "LLM request logs with token counts and latency",
    group: "ai",
  },
  {
    id: "memory",
    label: "Memory",
    icon: BrainIcon,
    description: "Persistent facts stored by the AI across conversations",
    group: "ai",
  },
  {
    id: "conversations",
    label: "Conversations",
    icon: MessageSquareIcon,
    description: "Chat conversation history",
    group: "ai",
  },
  {
    id: "reports",
    label: "Reports",
    icon: FileTextIcon,
    description: "Exported analysis reports from AI conversations",
    group: "ai",
  },
  // System group
  {
    id: "health",
    label: "Health",
    icon: HeartPulseIcon,
    description: "Integration data source availability, latency, and error rates",
    group: "system",
  },
  {
    id: "spans",
    label: "Spans",
    icon: GaugeIcon,
    description: "Performance traces across API routes, integrations, and plugin lifecycle",
    group: "system",
  },
  {
    id: "cache",
    label: "Cache",
    icon: DatabaseIcon,
    description: "API response cache entries and TTL status",
    group: "system",
  },
  {
    id: "events",
    label: "Events",
    icon: LogsIcon,
    description: "Durable debug events across chat, plugins, and MCP tools",
    group: "system",
  },
  {
    id: "client-issues",
    label: "Client Issues",
    icon: BugIcon,
    description: "Grouped browser runtime, API, and React client failures",
    group: "system",
  },
  {
    id: "webhook-relay",
    label: "Webhook Relay",
    icon: WebhookIcon,
    description: "Inbound webhook events, payload inspection, and relay health",
    group: "system",
  },
  {
    id: "extension-health",
    label: "Extension Health",
    icon: PuzzleIcon,
    description: "Usage stats, error rates, and performance metrics per extension",
    group: "system",
  },
];

export type DebugSectionId = (typeof DEBUG_SECTIONS)[number]["id"];

export const DEBUG_SECTION_MAP = new Map(DEBUG_SECTIONS.map((s) => [s.id, s]));
