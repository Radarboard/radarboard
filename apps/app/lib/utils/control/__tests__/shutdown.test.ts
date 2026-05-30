import { afterEach, describe, expect, it, vi } from "vitest";
import {
  executeShutdown,
  getShutdownCallbackCount,
  onShutdown,
  resetShutdownCallbacks,
} from "../shutdown";

afterEach(() => {
  resetShutdownCallbacks();
});

describe("shutdown coordinator", () => {
  it("registers callbacks", () => {
    onShutdown("test", () => {});
    onShutdown("test2", () => {});
    expect(getShutdownCallbackCount()).toBe(2);
  });

  it("executes all callbacks on shutdown", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});

    const order: string[] = [];
    onShutdown("db", async () => {
      order.push("db");
    });
    onShutdown("cache", async () => {
      order.push("cache");
    });
    onShutdown("sse", async () => {
      order.push("sse");
    });

    await executeShutdown();

    expect(order).toHaveLength(3);
    expect(order).toContain("db");
    expect(order).toContain("cache");
    expect(order).toContain("sse");
    vi.restoreAllMocks();
  });

  it("continues if a callback fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});

    const completed: string[] = [];
    onShutdown("failing", async () => {
      throw new Error("boom");
    });
    onShutdown("succeeding", async () => {
      completed.push("ok");
    });

    await executeShutdown();

    expect(completed).toEqual(["ok"]);
    vi.restoreAllMocks();
  });

  it("times out slow callbacks", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});

    const completed: string[] = [];
    onShutdown("slow", async () => {
      await new Promise((r) => setTimeout(r, 5000));
      completed.push("slow");
    });
    onShutdown("fast", async () => {
      completed.push("fast");
    });

    await executeShutdown(50); // 50ms timeout

    expect(completed).toContain("fast");
    expect(completed).not.toContain("slow");
    vi.restoreAllMocks();
  });

  it("only runs once (idempotent)", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});

    let count = 0;
    onShutdown("counter", async () => {
      count++;
    });

    await executeShutdown();
    await executeShutdown(); // second call should no-op

    expect(count).toBe(1);
    vi.restoreAllMocks();
  });

  it("resets for testing", () => {
    onShutdown("test", () => {});
    expect(getShutdownCallbackCount()).toBe(1);

    resetShutdownCallbacks();
    expect(getShutdownCallbackCount()).toBe(0);
  });
});
