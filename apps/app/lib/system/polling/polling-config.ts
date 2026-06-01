/**
 * Register polling source definitions.
 *
 * This is an app-level concern — the polling intervals and widget groupings
 * are configured here rather than in `packages/types` to keep shared types
 * free of integration-specific knowledge.
 *
 * Import this as a side effect after integrations-init.ts:
 *   import "@/lib/polling-config";
 */

import {
  type PollingDataSourceRef,
  type PollingSourceDefinition,
  registerPollingSource,
} from "@radarboard/types/polling";

function definePollingSource(
  id: string,
  definition: Omit<PollingSourceDefinition, "category" | "dataSources" | "widgetIds"> & {
    category: PollingSourceDefinition["category"];
    dataSources?: PollingDataSourceRef[];
    widgetIds?: string[];
  }
) {
  registerPollingSource(id, {
    ...definition,
    widgetIds: definition.widgetIds ?? [],
    dataSources: definition.dataSources ?? [],
  });
}

definePollingSource("analytics", {
  label: "Analytics",
  description: "Refreshes analytics widgets backed by installed provider extensions.",
  category: "widget",
  defaultIntervalMs: 60_000,
  allowedIntervalsMs: [15_000, 30_000, 60_000, 300_000],
  widgetIds: ["analytics"],
});

definePollingSource("health", {
  label: "Health Monitors",
  description: "Refreshes health checks in observability surfaces.",
  category: "widget",
  defaultIntervalMs: 60_000,
  allowedIntervalsMs: [15_000, 30_000, 60_000, 120_000, 300_000],
  widgetIds: ["observability"],
});

definePollingSource("logs", {
  label: "Logs",
  description: "Refreshes structured application log streams when live mode is off.",
  category: "widget",
  defaultIntervalMs: 5_000,
  allowedIntervalsMs: [5_000, 15_000, 30_000, 60_000],
  widgetIds: ["logs"],
});

definePollingSource("notifications-badge", {
  label: "Notification Badge",
  description: "Refreshes unread notification counts when streaming is unavailable.",
  category: "app",
  defaultIntervalMs: 10_000,
  allowedIntervalsMs: [5_000, 10_000, 30_000, 60_000],
});

definePollingSource("notifications-feed", {
  label: "Notification Feed",
  description: "Refreshes notification center content when live updates are disabled.",
  category: "app",
  defaultIntervalMs: 30_000,
  allowedIntervalsMs: [10_000, 30_000, 60_000, 300_000],
});

definePollingSource("plugin-bookmarks", {
  label: "Bookmarks Plugin",
  description: "Refreshes the bookmarks plugin widget surfaces.",
  category: "plugin",
  defaultIntervalMs: 30_000,
  allowedIntervalsMs: [15_000, 30_000, 60_000, 300_000],
  widgetIds: ["bookmarks__quick-access"],
});

definePollingSource("plugin-notes", {
  label: "Notes Plugin",
  description: "Refreshes recent note summaries in plugin widgets.",
  category: "plugin",
  defaultIntervalMs: 30_000,
  allowedIntervalsMs: [15_000, 30_000, 60_000, 300_000],
  widgetIds: ["notes__recent"],
});

definePollingSource("plugin-tasks", {
  label: "Tasks Plugin",
  description: "Refreshes task summaries and the current Pomodoro session.",
  category: "plugin",
  defaultIntervalMs: 30_000,
  allowedIntervalsMs: [15_000, 30_000, 60_000, 300_000],
  widgetIds: ["tasks__today"],
});

definePollingSource("bookmarks", {
  label: "Bookmarks",
  description: "Refreshes bookmark widgets backed by installed provider extensions.",
  category: "widget",
  defaultIntervalMs: 300_000,
  allowedIntervalsMs: [60_000, 300_000, 600_000, 900_000],
  widgetIds: ["bookmarks"],
});

definePollingSource("revenue", {
  label: "Revenue",
  description: "Refreshes revenue widgets backed by installed provider extensions.",
  category: "widget",
  defaultIntervalMs: 300_000,
  allowedIntervalsMs: [60_000, 300_000, 600_000, 900_000],
  widgetIds: ["revenue"],
});

definePollingSource("roadmap", {
  label: "Roadmap",
  description: "Refreshes roadmap widgets backed by installed provider extensions.",
  category: "widget",
  defaultIntervalMs: 120_000,
  allowedIntervalsMs: [60_000, 120_000, 300_000, 600_000],
  widgetIds: ["roadmap"],
});

definePollingSource("sentry", {
  label: "Error Tracking",
  description: "Refreshes error and observability widgets backed by installed provider extensions.",
  category: "widget",
  defaultIntervalMs: 120_000,
  allowedIntervalsMs: [60_000, 120_000, 300_000, 600_000],
  widgetIds: ["observability"],
});

definePollingSource("seo", {
  label: "SEO",
  description: "Refreshes SEO widgets backed by installed provider extensions.",
  category: "widget",
  defaultIntervalMs: 300_000,
  allowedIntervalsMs: [60_000, 300_000, 600_000, 900_000],
  widgetIds: ["seo"],
});

definePollingSource("shipping", {
  label: "Shipping",
  description: "Refreshes shipping and release readiness widgets.",
  category: "widget",
  defaultIntervalMs: 120_000,
  allowedIntervalsMs: [60_000, 120_000, 300_000, 600_000],
  widgetIds: ["shipping"],
  dataSources: [{ integration: "shipping", action: "data" }],
});

definePollingSource("sponsorship", {
  label: "Sponsorship",
  description: "Refreshes sponsorship widgets backed by installed provider extensions.",
  category: "widget",
  defaultIntervalMs: 300_000,
  allowedIntervalsMs: [60_000, 300_000, 600_000, 900_000],
  widgetIds: ["sponsorship"],
});
