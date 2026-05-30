import { describe, expect, it } from "vitest";
import { formatValue, getSiblingCurrencyField } from "../format-value";

describe("formatValue", () => {
  describe("null/undefined handling", () => {
    it("returns dash for null", () => {
      expect(formatValue(null)).toBe("—");
    });

    it("returns dash for undefined", () => {
      expect(formatValue(undefined)).toBe("—");
    });
  });

  describe("number format", () => {
    it("formats integers", () => {
      const result = formatValue(1234, "number");
      expect(result).toMatch(/1[,.]?234/);
    });

    it("formats with precision", () => {
      const result = formatValue(Math.PI, "number", { precision: 2 });
      expect(result).toBe("3.14");
    });

    it("returns string representation for non-numbers", () => {
      expect(formatValue("abc", "number")).toBe("abc");
    });
  });

  describe("percent format", () => {
    it("formats percentages", () => {
      expect(formatValue(85, "percent")).toBe("85%");
    });

    it("uses 1 decimal for small values (<10)", () => {
      expect(formatValue(5.67, "percent")).toBe("5.7%");
    });

    it("uses 0 decimals for values >=10", () => {
      expect(formatValue(15.67, "percent")).toBe("16%");
    });

    it("respects explicit precision", () => {
      expect(formatValue(85.123, "percent", { precision: 2 })).toBe("85.12%");
    });

    it("handles negative percentages", () => {
      // Math.abs(-5) < 10, so 1 decimal
      expect(formatValue(-5.67, "percent")).toBe("-5.7%");
    });

    it("returns string for non-numbers", () => {
      expect(formatValue("n/a", "percent")).toBe("n/a");
    });
  });

  describe("duration-seconds format", () => {
    it("formats seconds only", () => {
      expect(formatValue(45, "duration-seconds")).toBe("45s");
    });

    it("formats minutes and seconds", () => {
      expect(formatValue(125, "duration-seconds")).toBe("2m 5s");
    });

    it("handles zero seconds", () => {
      expect(formatValue(0, "duration-seconds")).toBe("0s");
    });

    it("rounds fractional seconds", () => {
      expect(formatValue(90.7, "duration-seconds")).toBe("1m 31s");
    });

    it("returns string for NaN", () => {
      expect(formatValue(NaN, "duration-seconds")).toBe("NaN");
    });

    it("returns string for non-numbers", () => {
      expect(formatValue("fast", "duration-seconds")).toBe("fast");
    });
  });

  describe("relative-time format", () => {
    it("formats seconds ago", () => {
      const nowMs = Date.now();
      const result = formatValue(nowMs - 30000, "relative-time");
      expect(result).toMatch(/\d+s ago/);
    });

    it("formats minutes ago", () => {
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      expect(formatValue(fiveMinAgo, "relative-time")).toMatch(/5m ago/);
    });

    it("formats hours ago", () => {
      const twoHoursAgo = Date.now() - 2 * 3600 * 1000;
      expect(formatValue(twoHoursAgo, "relative-time")).toMatch(/2h ago/);
    });

    it("formats days ago", () => {
      const threeDaysAgo = Date.now() - 3 * 86400 * 1000;
      expect(formatValue(threeDaysAgo, "relative-time")).toMatch(/3d ago/);
    });

    it("handles unix timestamps (seconds) by converting to ms", () => {
      // Timestamps < 1_000_000_000_000 are treated as seconds
      const tenSecondsAgo = Math.floor(Date.now() / 1000) - 10;
      const result = formatValue(tenSecondsAgo, "relative-time");
      expect(result).toMatch(/\d+s ago/);
    });

    it("parses ISO date strings", () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatValue(fiveMinAgo, "relative-time")).toMatch(/5m ago/);
    });

    it("returns original string for unparseable dates", () => {
      expect(formatValue("not-a-date", "relative-time")).toBe("not-a-date");
    });

    it("returns dash for NaN", () => {
      expect(formatValue(NaN, "relative-time")).toBe("—");
    });

    it("returns dash for non-string non-number", () => {
      expect(formatValue(true, "relative-time")).toBe("—");
    });
  });

  describe("currency format", () => {
    it("formats with default USD", () => {
      const result = formatValue(99.99, "currency");
      expect(result).toMatch(/\$99\.99/);
    });

    it("formats with explicit currency", () => {
      const result = formatValue(99.99, "currency", { currency: "EUR" });
      expect(result).toContain("99.99");
    });

    it("returns string for non-numbers", () => {
      expect(formatValue("free", "currency")).toBe("free");
    });
  });

  describe("no format (auto-detection)", () => {
    it("formats numbers", () => {
      const result = formatValue(42);
      expect(result).toBe("42");
    });

    it("formats strings that look like dates", () => {
      const result = formatValue("2026-03-28");
      // Should attempt date formatting
      expect(result).not.toBe("—");
    });

    it("returns string representation for plain strings", () => {
      expect(formatValue("hello")).toBe("hello");
    });
  });
});

describe("getSiblingCurrencyField", () => {
  it("returns 'currency' for top-level field", () => {
    expect(getSiblingCurrencyField("amount")).toBe("currency");
  });

  it("returns sibling path for nested field", () => {
    expect(getSiblingCurrencyField("data.amount")).toBe("data.currency");
  });

  it("handles deeply nested paths", () => {
    expect(getSiblingCurrencyField("a.b.c.amount")).toBe("a.b.c.currency");
  });
});
