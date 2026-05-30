import { describe, expect, it } from "vitest";
import {
  buildEventListRows,
  type DebugEvent,
  durationBadgeVariant,
  getEventFingerprint,
} from "../";

function makeEvent(id: string, overrides: Partial<DebugEvent> = {}): DebugEvent {
  return {
    id,
    occurredAt: "2026-03-19T20:00:00Z",
    ingestedAt: "2026-03-19T20:00:00Z",
    level: "error",
    source: "client/runtime",
    eventType: "client.error",
    message: "boom",
    projectSlug: null,
    traceId: null,
    requestId: null,
    sessionId: null,
    conversationId: null,
    entityType: null,
    entityId: null,
    status: "failed",
    durationMs: null,
    metadata: {},
    ...overrides,
  };
}

describe("getEventFingerprint", () => {
  it("returns fingerprint from metadata when present", () => {
    expect(getEventFingerprint(makeEvent("e1", { metadata: { fingerprint: "abc" } }))).toBe("abc");
  });

  it("returns null when fingerprint is absent", () => {
    expect(getEventFingerprint(makeEvent("e1"))).toBeNull();
  });
});

describe("buildEventListRows", () => {
  it("keeps one row per event when grouping is off", () => {
    const rows = buildEventListRows([makeEvent("e1"), makeEvent("e2")], false);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.count).toBe(1);
    expect(rows[1]?.count).toBe(1);
  });

  it("groups rows by fingerprint when grouping is on", () => {
    const rows = buildEventListRows(
      [
        makeEvent("e1", { metadata: { fingerprint: "fp:one" }, message: "same" }),
        makeEvent("e2", { metadata: { fingerprint: "fp:one" }, message: "same" }),
        makeEvent("e3", { metadata: { fingerprint: "fp:two" }, message: "other" }),
      ],
      true
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]?.count).toBe(2);
    expect(rows[0]?.fingerprint).toBe("fp:one");
    expect(rows[0]?.relatedIds).toEqual(["e1", "e2"]);
    expect(rows[1]?.count).toBe(1);
  });
});

describe("durationBadgeVariant", () => {
  it("classifies latency by thresholds", () => {
    expect(durationBadgeVariant(200)).toBe("muted");
    expect(durationBadgeVariant(1200)).toBe("accent");
    expect(durationBadgeVariant(5000)).toBe("warning");
    expect(durationBadgeVariant(12_000)).toBe("error");
  });
});
