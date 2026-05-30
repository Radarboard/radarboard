import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCurrentSpanId,
  getCurrentTraceId,
  getSpanStats,
  getSpans,
  getSpansByTraceId,
  resetCollector,
  withSpan,
  withSpanSync,
} from "./index";

afterEach(() => {
  resetCollector();
});

describe("withSpan", () => {
  it("records a span with correct name and duration", async () => {
    vi.useFakeTimers();

    try {
      const spanPromise = withSpan("test.operation", async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      await vi.advanceTimersByTimeAsync(10);
      await spanPromise;
    } finally {
      vi.useRealTimers();
    }

    const spans = getSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]?.name).toBe("test.operation");
    expect(spans[0]?.durationMs).toBe(10);
    expect(spans[0]?.status).toBe("ok");
  });

  it("returns the function result", async () => {
    const result = await withSpan("compute", async () => 42);
    expect(result).toBe(42);
  });

  it("records error status on exception", async () => {
    await expect(
      withSpan("failing", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    const spans = getSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]?.status).toBe("error");
    expect(spans[0]?.errorMessage).toBe("boom");
  });

  it("supports attributes", async () => {
    await withSpan("fetch", async (span) => {
      span.setAttribute("integration", "github");
      span.setAttribute("action", "pulls");
      span.setAttribute("cached", false);
    });

    const spans = getSpans();
    expect(spans[0]?.attributes).toEqual({
      integration: "github",
      action: "pulls",
      cached: false,
    });
  });

  it("supports setAttributes for bulk assignment", async () => {
    await withSpan("bulk", async (span) => {
      span.setAttributes({ a: "1", b: 2, c: true });
    });

    expect(getSpans()[0]?.attributes).toEqual({ a: "1", b: 2, c: true });
  });

  it("creates parent-child relationships for nested spans", async () => {
    await withSpan("parent", async () => {
      await withSpan("child", async () => {
        await withSpan("grandchild", async () => {});
      });
    });

    const spans = getSpans();
    expect(spans).toHaveLength(3);

    const parent = spans.find((s) => s.name === "parent")!;
    const child = spans.find((s) => s.name === "child")!;
    const grandchild = spans.find((s) => s.name === "grandchild")!;

    // All share the same trace ID
    expect(child.traceId).toBe(parent.traceId);
    expect(grandchild.traceId).toBe(parent.traceId);

    // Parent-child chain
    expect(parent.parentSpanId).toBeNull();
    expect(child.parentSpanId).toBe(parent.spanId);
    expect(grandchild.parentSpanId).toBe(child.spanId);
  });

  it("creates separate trace IDs for independent spans", async () => {
    await withSpan("span-a", async () => {});
    await withSpan("span-b", async () => {});

    const spans = getSpans();
    expect(spans[0]?.traceId).not.toBe(spans[1]?.traceId);
  });

  it("generates valid hex IDs", async () => {
    await withSpan("id-test", async () => {});

    const span = getSpans()[0]!;
    expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(span.traceId).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("withSpanSync", () => {
  it("records a synchronous span", () => {
    const result = withSpanSync("sync-op", () => "hello");

    expect(result).toBe("hello");
    const spans = getSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]?.name).toBe("sync-op");
    expect(spans[0]?.status).toBe("ok");
  });

  it("records error on sync throw", () => {
    expect(() =>
      withSpanSync("sync-fail", () => {
        throw new Error("sync boom");
      })
    ).toThrow("sync boom");

    expect(getSpans()[0]?.status).toBe("error");
    expect(getSpans()[0]?.errorMessage).toBe("sync boom");
  });
});

describe("getCurrentTraceId / getCurrentSpanId", () => {
  it("returns null outside a span", () => {
    expect(getCurrentTraceId()).toBeNull();
    expect(getCurrentSpanId()).toBeNull();
  });

  it("returns IDs inside a span", async () => {
    let capturedTraceId: string | null = null;
    let capturedSpanId: string | null = null;

    await withSpan("context-test", async () => {
      capturedTraceId = getCurrentTraceId();
      capturedSpanId = getCurrentSpanId();
    });

    expect(capturedTraceId).toMatch(/^[0-9a-f]{32}$/);
    expect(capturedSpanId).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("getSpansByTraceId", () => {
  it("filters spans by trace ID", async () => {
    let targetTraceId = "";
    await withSpan("target-parent", async (span) => {
      targetTraceId = span.traceId;
      await withSpan("target-child", async () => {});
    });
    await withSpan("other", async () => {});

    const filtered = getSpansByTraceId(targetTraceId);
    expect(filtered).toHaveLength(2);
    expect(filtered.every((s) => s.traceId === targetTraceId)).toBe(true);
  });
});

describe("getSpanStats", () => {
  it("computes correct statistics", async () => {
    await withSpan("integration.fetch/github", async () => {});
    await withSpan("integration.fetch/github", async () => {});
    await withSpan("plugin.lifecycle/tasks", async () => {});
    await expect(
      withSpan("integration.fetch/sentry", async () => {
        throw new Error("timeout");
      })
    ).rejects.toThrow();

    const stats = getSpanStats();
    expect(stats.totalSpans).toBe(4);
    expect(stats.errorCount).toBe(1);
    expect(stats.sources["integration.fetch"]).toBe(3);
    expect(stats.sources["plugin.lifecycle"]).toBe(1);
  });
});

describe("collector ring buffer", () => {
  it("caps at buffer size", async () => {
    // Record 210 spans (buffer size is 200)
    for (let i = 0; i < 210; i++) {
      await withSpan(`span-${i}`, async () => {});
    }

    const spans = getSpans();
    expect(spans.length).toBeLessThanOrEqual(200);
  });
});
