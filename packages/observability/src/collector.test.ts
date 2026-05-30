import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpanRecord } from "./collector";

type RuntimeGlobals = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

function buildSpan(overrides: Partial<SpanRecord> = {}): SpanRecord {
  return {
    spanId: "0123456789abcdef",
    parentSpanId: null,
    traceId: "0123456789abcdef0123456789abcdef",
    name: "integration.fetch/github",
    startTimeMs: 1000,
    endTimeMs: 1250,
    durationMs: 250,
    status: "ok",
    attributes: {
      repo: "radarboard",
      attempts: 2,
      cached: false,
    },
    ...overrides,
  };
}

function getProcessEnv(): Record<string, string | undefined> {
  const runtime = globalThis as RuntimeGlobals;
  runtime.process ??= {};
  runtime.process.env ??= {};
  return runtime.process.env;
}

describe("collector OTLP export", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    delete getProcessEnv().OTEL_EXPORTER_OTLP_ENDPOINT;
  });

  afterEach(async () => {
    const collector = await import("./collector");
    collector.resetCollector();
    delete getProcessEnv().OTEL_EXPORTER_OTLP_ENDPOINT;
  });

  it("exports spans to OTLP when an endpoint is configured", async () => {
    let requestInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestInit = init;
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    getProcessEnv().OTEL_EXPORTER_OTLP_ENDPOINT = "https://otel.example.com";

    const collector = await import("./collector");
    collector.recordSpan(
      buildSpan({
        status: "error",
        errorMessage: "timeout",
      })
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://otel.example.com/v1/traces",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    if (
      !requestInit ||
      typeof requestInit !== "object" ||
      !("body" in requestInit) ||
      typeof requestInit.body !== "string"
    ) {
      throw new Error("Expected OTLP export payload");
    }

    const payload = JSON.parse(requestInit.body) as {
      resourceSpans: Array<{
        scopeSpans: Array<{
          spans: Array<{
            parentSpanId?: string;
            status: { code: number; message?: string };
            attributes: Array<{ key: string; value: Record<string, string | boolean> }>;
          }>;
        }>;
      }>;
    };

    const exportedSpan = payload.resourceSpans[0]?.scopeSpans[0]?.spans[0];
    expect(exportedSpan?.status).toEqual({ code: 2, message: "timeout" });
    expect(exportedSpan?.parentSpanId).toBeUndefined();
    expect(exportedSpan?.attributes).toEqual([
      { key: "repo", value: { stringValue: "radarboard" } },
      { key: "attempts", value: { intValue: "2" } },
      { key: "cached", value: { boolValue: false } },
    ]);
  });

  it("swallows OTLP export failures", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);
    getProcessEnv().OTEL_EXPORTER_OTLP_ENDPOINT = "https://otel.example.com";

    const collector = await import("./collector");

    expect(() => collector.recordSpan(buildSpan())).not.toThrow();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
