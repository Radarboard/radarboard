import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addClient,
  broadcast,
  emit,
  emitCacheInvalidation,
  getClientCount,
  removeClient,
} from "../event-gateway";

// Reset gateway state between tests
afterEach(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.__radarboard_event_gateway__;
});

function createMockController() {
  const enqueued: Uint8Array[] = [];
  return {
    enqueued,
    controller: {
      enqueue: vi.fn((chunk: Uint8Array) => enqueued.push(chunk)),
      close: vi.fn(),
      error: vi.fn(),
      desiredSize: 1,
    } as unknown as ReadableStreamDefaultController,
  };
}

describe("event-gateway", () => {
  it("tracks connected clients", () => {
    const { controller } = createMockController();
    expect(getClientCount()).toBe(0);

    addClient("c1", controller);
    expect(getClientCount()).toBe(1);

    removeClient("c1");
    expect(getClientCount()).toBe(0);
  });

  it("broadcasts to subscribed clients", () => {
    const mock1 = createMockController();
    const mock2 = createMockController();

    addClient("c1", mock1.controller, ["notifications"]);
    addClient("c2", mock2.controller, ["health"]);

    broadcast({
      channel: "notifications",
      type: "webhook.received",
      data: { source: "github" },
      timestamp: Date.now(),
    });

    // c1 subscribed to notifications — should receive
    expect(mock1.controller.enqueue).toHaveBeenCalledOnce();
    // c2 subscribed to health only — should not receive
    expect(mock2.controller.enqueue).not.toHaveBeenCalled();
  });

  it("broadcasts to all channels when subscribed to all", () => {
    const mock = createMockController();
    addClient("c1", mock.controller); // default: all channels

    emit("health", "status.changed", { status: "degraded" });
    emit("notifications", "alert", { title: "test" });

    expect(mock.controller.enqueue).toHaveBeenCalledTimes(2);
  });

  it("removes disconnected clients on broadcast error", () => {
    const controller = {
      enqueue: vi.fn(() => {
        throw new Error("Client disconnected");
      }),
      close: vi.fn(),
      error: vi.fn(),
      desiredSize: 1,
    } as unknown as ReadableStreamDefaultController;

    addClient("c1", controller);
    expect(getClientCount()).toBe(1);

    // Broadcast should catch the error and remove the client
    broadcast({
      channel: "notifications",
      type: "test",
      data: {},
      timestamp: Date.now(),
    });

    expect(getClientCount()).toBe(0);
  });

  it("emits events with correct format", () => {
    const mock = createMockController();
    addClient("c1", mock.controller, ["invalidation"]);

    emit("invalidation", "widget.refresh", { widgetId: "analytics" });

    expect(mock.enqueued).toHaveLength(1);
    const text = new TextDecoder().decode(mock.enqueued[0]);
    expect(text).toMatch(/^data: /);
    expect(text).toMatch(/\n\n$/);

    const parsed = JSON.parse(text.replace("data: ", "").trim());
    expect(parsed.channel).toBe("invalidation");
    expect(parsed.type).toBe("widget.refresh");
    expect(parsed.data).toEqual({ widgetId: "analytics" });
    expect(parsed.timestamp).toBeGreaterThan(0);
  });

  it("emitCacheInvalidation sends invalidation event with prefixes", () => {
    const mock = createMockController();
    addClient("c1", mock.controller, ["invalidation"]);

    emitCacheInvalidation(["github:", "vercel:"], "webhook");

    expect(mock.enqueued).toHaveLength(1);
    const text = new TextDecoder().decode(mock.enqueued[0]);
    const parsed = JSON.parse(text.replace("data: ", "").trim());
    expect(parsed.channel).toBe("invalidation");
    expect(parsed.type).toBe("cache:invalidate");
    expect(parsed.data).toEqual({
      prefixes: ["github:", "vercel:"],
      source: "webhook",
    });
  });

  it("emitCacheInvalidation only reaches invalidation subscribers", () => {
    const notifMock = createMockController();
    const invalidMock = createMockController();
    addClient("c1", notifMock.controller, ["notifications"]);
    addClient("c2", invalidMock.controller, ["invalidation"]);

    emitCacheInvalidation(["sentry:"]);

    expect(notifMock.controller.enqueue).not.toHaveBeenCalled();
    expect(invalidMock.controller.enqueue).toHaveBeenCalledOnce();
  });
});
