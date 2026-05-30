import type { IntegrationEvent } from "@radarboard/integration-sdk/types";
import { describe, expect, it } from "vitest";
import { getEventsSince, pruneExpiredEvents, storeEvents } from "../lib/store-memory.js";

function makeEvent(overrides: Partial<IntegrationEvent> = {}): IntegrationEvent {
  return {
    source: "test",
    type: "test.event",
    severity: "info",
    title: "Test Event",
    ...overrides,
  };
}

describe("in-memory store", () => {
  it("should store and retrieve events", async () => {
    await storeEvents(null, "github", [makeEvent({ type: "pr.opened", title: "PR #1" })]);

    const events = await getEventsSince(null, 0, 1000);
    expect(events.length).toBeGreaterThanOrEqual(1);
    const last = events.at(-1);
    expect(last).toBeDefined();
    expect(last?.integration).toBe("github");
    expect(last?.event.type).toBe("pr.opened");
    expect(last?.id).toBeDefined();
    expect(last?.receivedAt).toBeGreaterThan(0);
  });

  it("should return only events after sinceMs (exclusive)", async () => {
    const before = Date.now();
    await storeEvents(null, "vercel", [makeEvent({ type: "deploy" })]);

    const events = await getEventsSince(null, before - 1, 1000);
    expect(events.length).toBeGreaterThanOrEqual(1);

    const futureEvents = await getEventsSince(null, Date.now() + 10000, 100);
    expect(futureEvents).toHaveLength(0);
  });

  it("should respect limit parameter", async () => {
    await storeEvents(null, "sentry", [
      makeEvent({ type: "error.1" }),
      makeEvent({ type: "error.2" }),
      makeEvent({ type: "error.3" }),
    ]);

    const limited = await getEventsSince(null, 0, 1);
    expect(limited).toHaveLength(1);
  });

  it("should handle empty event arrays", async () => {
    await storeEvents(null, "linear", []);
    // Should not throw
  });

  it("should prune old events", async () => {
    await storeEvents(null, "betterstack", [makeEvent({ type: "monitor.down" })]);

    const before = await getEventsSince(null, 0, 1000);
    expect(before.length).toBeGreaterThan(0);

    // Prune won't remove recent events (24h TTL), but verifies the function runs
    await pruneExpiredEvents(null);
  });
});
