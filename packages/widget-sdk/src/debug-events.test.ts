import { API_ROUTES } from "@radarboard/types/api-routes";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emitWidgetDebugEvent } from "./debug-events";

describe("emitWidgetDebugEvent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips sending debug events in e2e mode", async () => {
    vi.stubGlobal("document", {
      documentElement: {
        dataset: {
          radarboardE2e: "1",
        },
      },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await emitWidgetDebugEvent({
      level: "info",
      source: "widget.analytics",
      eventType: "rendered",
      message: "Rendered analytics widget",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts debug events and swallows network failures", async () => {
    vi.stubGlobal("document", {
      documentElement: {
        dataset: {},
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      emitWidgetDebugEvent({
        level: "warn",
        source: "widget.analytics",
        eventType: "fetch.failed",
        message: "Fetch failed",
        metadata: { retry: true },
      })
    ).resolves.toBeUndefined();

    await expect(
      emitWidgetDebugEvent({
        level: "warn",
        source: "widget.analytics",
        eventType: "fetch.failed",
        message: "Fetch failed again",
      })
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      API_ROUTES.debugEvents,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });
});
