"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";

type WidgetDebugEventInput = {
  level: "debug" | "info" | "warn" | "error";
  source: string;
  eventType: string;
  message: string;
  projectSlug?: string | null;
  traceId?: string | null;
  requestId?: string | null;
  sessionId?: string | null;
  conversationId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  status?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
};

/** Track an extension mount for usage analytics. Best-effort, never throws. */
export async function trackExtensionUsage(
  extensionId: string,
  extensionType: "integration" | "plugin" | "widget",
  event: "mount" | "error" = "mount"
): Promise<void> {
  if (typeof document !== "undefined" && document.documentElement.dataset.radarboardE2e === "1") {
    return;
  }

  try {
    await fetch(API_ROUTES.extensionsUsage, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extensionId, extensionType, event }),
    });
  } catch {
    // Best-effort only
  }
}

/** Emits a debug event to the server for widget development tooling. Best-effort, never throws. */
export async function emitWidgetDebugEvent(input: WidgetDebugEventInput): Promise<void> {
  if (typeof document !== "undefined" && document.documentElement.dataset.radarboardE2e === "1") {
    return;
  }

  try {
    await fetch(API_ROUTES.debugEvents, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    // Best-effort only — widget UI must never fail due to debug logging
  }
}
