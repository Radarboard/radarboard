import { describe, expect, it } from "vitest";
import { getSeverity } from "./index";

describe("getSeverity", () => {
  it("returns warning for 1-2 anomalies with low z-score", () => {
    expect(getSeverity(1)).toBe("warning");
    expect(getSeverity(2, 2.5)).toBe("warning");
  });

  it("returns critical for 3+ anomalies", () => {
    expect(getSeverity(3)).toBe("critical");
    expect(getSeverity(5, 2.0)).toBe("critical");
  });

  it("returns critical for high z-score even with few anomalies", () => {
    expect(getSeverity(1, 3.5)).toBe("critical");
    expect(getSeverity(1, -4.0)).toBe("critical"); // abs value
  });

  it("returns warning when z-score is undefined", () => {
    expect(getSeverity(2)).toBe("warning");
  });
});
