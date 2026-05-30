import { describe, expect, it } from "vitest";
import { getByPath } from "./get-by-path";

describe("getByPath", () => {
  it("reads nested object and array values using dot and bracket paths", () => {
    const value = {
      metrics: {
        visitors: 42,
        topPages: [{ path: "/docs" }, { path: "/pricing" }],
      },
    };

    expect(getByPath(value, "metrics.visitors")).toBe(42);
    expect(getByPath(value, "metrics.topPages[1].path")).toBe("/pricing");
  });

  it("returns the input for an empty path and undefined for missing segments", () => {
    const value = { a: [{ b: "ok" }] };

    expect(getByPath(value, "")).toEqual(value);
    expect(getByPath(value, "a[2].b")).toBeUndefined();
    expect(getByPath(value, "a[0].missing")).toBeUndefined();
    expect(getByPath("plain-text", "a.b")).toBeUndefined();
  });
});
