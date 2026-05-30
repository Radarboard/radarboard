import type { NotificationEventRow } from "@radarboard/types/notifications";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DigestAccumulator } from "./accumulator";

function buildEvent(overrides: Partial<NotificationEventRow> = {}): NotificationEventRow {
  return {
    id: "event-1",
    source: "status-page",
    sourceEventId: "source-event-1",
    type: "service.outage",
    severity: "warning",
    projectSlug: "radarboard",
    title: "Service degraded",
    body: "Latency is elevated",
    metadata: {},
    occurredAt: 1_000,
    ingestedAt: 1_000,
    batchId: null,
    ...overrides,
  };
}

describe("DigestAccumulator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-27T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushes grouped events after the window and deduplicates channels", () => {
    const flushed: Array<Parameters<ConstructorParameters<typeof DigestAccumulator>[0]>[0]> = [];
    const accumulator = new DigestAccumulator((payload) => {
      flushed.push(payload);
    });

    accumulator.add(buildEvent(), 5_000, ["email", "desktop"], "rule-a");
    accumulator.add(
      buildEvent({ id: "event-2", body: "Still degraded", occurredAt: 1_100, ingestedAt: 1_100 }),
      5_000,
      ["desktop", "in_app"],
      "rule-a"
    );

    vi.setSystemTime(new Date("2026-03-27T10:00:05.000Z"));
    accumulator.tick();

    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toMatchObject({
      key: "status-page:service.outage:radarboard:rule-a",
      source: "status-page",
      type: "service.outage",
      projectSlug: "radarboard",
    });
    expect(flushed[0]?.events.map((event) => event.id)).toEqual(["event-1", "event-2"]);
    expect(flushed[0]?.channels).toEqual(["email", "desktop", "in_app"]);
    expect(accumulator.pendingWindowCount()).toBe(0);
  });

  it("keeps distinct routing keys in separate windows and flushes all on demand", () => {
    const flushed: Array<Parameters<ConstructorParameters<typeof DigestAccumulator>[0]>[0]> = [];
    const accumulator = new DigestAccumulator((payload) => {
      flushed.push(payload);
    });

    accumulator.add(buildEvent(), 30_000, ["email"], "rule-a");
    accumulator.add(buildEvent({ id: "event-2" }), 30_000, ["desktop"], "rule-b");

    accumulator.flushAll();

    expect(accumulator.pendingWindowCount()).toBe(0);
    expect(flushed).toHaveLength(2);
    expect(flushed.map((entry) => entry.key)).toEqual([
      "status-page:service.outage:radarboard:rule-a",
      "status-page:service.outage:radarboard:rule-b",
    ]);
  });
});
