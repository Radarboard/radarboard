import { afterEach, describe, expect, it } from "vitest";
import { getInflightCount, resetCoalesce, withCoalesce } from "../coalesce";

afterEach(() => {
  resetCoalesce();
});

describe("withCoalesce", () => {
  it("executes fn and returns result", async () => {
    const result = await withCoalesce("key", async () => 42);
    expect(result).toBe(42);
  });

  it("deduplicates concurrent calls with same key", async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 20));
      return "data";
    };

    const [a, b, c] = await Promise.all([
      withCoalesce("same", fn),
      withCoalesce("same", fn),
      withCoalesce("same", fn),
    ]);

    expect(callCount).toBe(1);
    expect(a).toBe("data");
    expect(b).toBe("data");
    expect(c).toBe("data");
  });

  it("allows independent execution for different keys", async () => {
    let countA = 0;
    let countB = 0;

    await Promise.all([
      withCoalesce("a", async () => {
        countA++;
      }),
      withCoalesce("b", async () => {
        countB++;
      }),
    ]);

    expect(countA).toBe(1);
    expect(countB).toBe(1);
  });

  it("cleans up after promise resolves", async () => {
    await withCoalesce("cleanup", async () => "ok");
    expect(getInflightCount()).toBe(0);
  });

  it("cleans up after promise rejects", async () => {
    await expect(
      withCoalesce("error", async () => {
        throw new Error("fail");
      })
    ).rejects.toThrow("fail");

    expect(getInflightCount()).toBe(0);
  });

  it("shares rejection across coalesced callers", async () => {
    const fn = async () => {
      await new Promise((r) => setTimeout(r, 10));
      throw new Error("shared failure");
    };

    const results = await Promise.allSettled([
      withCoalesce("fail-shared", fn),
      withCoalesce("fail-shared", fn),
    ]);

    expect(results[0]?.status).toBe("rejected");
    expect(results[1]?.status).toBe("rejected");
  });

  it("allows new execution after previous settles", async () => {
    let callCount = 0;
    const fn = async () => ++callCount;

    const first = await withCoalesce("sequential", fn);
    const second = await withCoalesce("sequential", fn);

    expect(first).toBe(1);
    expect(second).toBe(2);
    expect(callCount).toBe(2);
  });
});
