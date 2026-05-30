import type { NotificationEventRow } from "@radarboard/types/notifications";
import { describe, expect, it, vi } from "vitest";
import { notificationEventBus } from "./event-bus";

function buildEvent(overrides: Partial<NotificationEventRow> = {}): NotificationEventRow {
  return {
    id: "event-1",
    source: "status-page",
    sourceEventId: "source-event-1",
    type: "service.outage",
    severity: "critical",
    projectSlug: "radarboard",
    title: "Status changed",
    body: null,
    metadata: {},
    occurredAt: 1_000,
    ingestedAt: 1_000,
    batchId: null,
    ...overrides,
  };
}

describe("notificationEventBus", () => {
  it("delivers only matching events and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = notificationEventBus.on(
      { source: "status-page", severity: "critical" },
      listener
    );

    notificationEventBus.emit(buildEvent());
    notificationEventBus.emit(buildEvent({ severity: "warning" }));
    unsubscribe();
    notificationEventBus.emit(buildEvent({ id: "event-3" }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ id: "event-1", severity: "critical" })
    );
  });
});
