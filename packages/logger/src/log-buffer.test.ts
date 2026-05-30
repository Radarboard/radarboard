import type { LogEntry } from "@radarboard/types/logs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logBuffer } from "./log-buffer";

function buildEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: "1",
    timestamp: 100,
    level: "info",
    source: "api/test",
    message: "request completed",
    metadata: {},
    ...overrides,
  };
}

describe("logBuffer", () => {
  beforeEach(() => {
    logBuffer.clear();
  });

  it("keeps only the latest 1000 entries", () => {
    for (let index = 0; index < 1_005; index += 1) {
      logBuffer.push(
        buildEntry({
          id: String(index),
          timestamp: index,
          message: `entry-${index}`,
        })
      );
    }

    const result = logBuffer.getEntries({ limit: 1_000 });

    expect(logBuffer.size).toBe(1_000);
    expect(result.total).toBe(1_000);
    expect(result.logs[0]?.id).toBe("5");
    expect(result.logs.at(-1)?.id).toBe("1004");
  });

  it("filters by level, partial source, search text, after cursor, and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = logBuffer.subscribe(listener);

    logBuffer.push(buildEntry({ id: "1", timestamp: 100, level: "info", source: "api/github" }));
    logBuffer.push(
      buildEntry({
        id: "2",
        timestamp: 200,
        level: "error",
        source: "worker/github",
        message: "timeout talking to upstream",
      })
    );
    unsubscribe();
    logBuffer.push(
      buildEntry({
        id: "3",
        timestamp: 300,
        level: "error",
        source: "worker/vercel",
        message: "timeout on deploy sync",
      })
    );

    const result = logBuffer.getEntries({
      level: "error",
      source: "github",
      search: "timeout",
      after: 150,
      limit: 10,
    });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      total: 1,
      hasMore: false,
    });
    expect(result.logs.map((entry) => entry.id)).toEqual(["2"]);
  });
});
