import { afterEach, describe, expect, it } from "vitest";
import { getActiveLockCount, resetLocks, withSessionLock } from "../session-mutex";

afterEach(() => {
  resetLocks();
});

describe("withSessionLock", () => {
  it("executes the function and returns its result", async () => {
    const result = await withSessionLock("key1", async () => 42);
    expect(result).toBe(42);
  });

  it("serializes concurrent calls with the same key", async () => {
    const order: number[] = [];

    const p1 = withSessionLock("settings", async () => {
      await new Promise((r) => setTimeout(r, 50));
      order.push(1);
    });

    const p2 = withSessionLock("settings", async () => {
      order.push(2);
    });

    const p3 = withSessionLock("settings", async () => {
      order.push(3);
    });

    await Promise.all([p1, p2, p3]);

    // Must execute in order despite p2 and p3 starting before p1 finishes
    expect(order).toEqual([1, 2, 3]);
  });

  it("allows concurrent execution for different keys", async () => {
    const order: string[] = [];

    const p1 = withSessionLock("key-a", async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push("a");
    });

    const p2 = withSessionLock("key-b", async () => {
      order.push("b");
    });

    await Promise.all([p1, p2]);

    // b should complete before a since they're independent
    expect(order[0]).toBe("b");
    expect(order[1]).toBe("a");
  });

  it("releases the lock even if the function throws", async () => {
    await expect(
      withSessionLock("err-key", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    // Lock should be released — next call should succeed immediately
    const result = await withSessionLock("err-key", async () => "ok");
    expect(result).toBe("ok");
  });

  it("cleans up lock entries after all queued operations complete", async () => {
    await withSessionLock("cleanup-key", async () => {});
    expect(getActiveLockCount()).toBe(0);
  });

  it("handles rapid-fire mutations correctly", async () => {
    let counter = 0;

    const mutations = Array.from({ length: 10 }, () =>
      withSessionLock("counter", async () => {
        const current = counter;
        // Simulate async read-modify-write
        await new Promise((r) => setTimeout(r, 1));
        counter = current + 1;
      })
    );

    await Promise.all(mutations);

    // Without the mutex, this would be less than 10 due to race conditions
    expect(counter).toBe(10);
  });
});
