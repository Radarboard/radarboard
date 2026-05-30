import { describe, expect, it } from "vitest";
import { computeStatus } from "./index";

describe("computeStatus", () => {
  it("returns fresh when data is within expected age", () => {
    const now = Date.now();
    expect(computeStatus(now - 60_000, 300)).toBe("fresh"); // 1 min old, 5 min max
  });

  it("returns delayed when data is between 1x and 2x expected age", () => {
    const now = Date.now();
    expect(computeStatus(now - 450_000, 300)).toBe("delayed"); // 7.5 min old, 5 min max
  });

  it("returns stale when data is older than 2x expected age", () => {
    const now = Date.now();
    expect(computeStatus(now - 700_000, 300)).toBe("stale"); // 11.6 min old, 5 min max
  });

  it("returns stale when fetchedAt is null", () => {
    expect(computeStatus(null, 300)).toBe("stale");
  });

  it("returns fresh at exact boundary", () => {
    const now = Date.now();
    expect(computeStatus(now - 300_000, 300)).toBe("fresh"); // exactly 5 min
  });

  it("returns delayed at exact 2x boundary", () => {
    const now = Date.now();
    expect(computeStatus(now - 600_000, 300)).toBe("delayed"); // exactly 10 min
  });
});
