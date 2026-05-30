import { describe, expect, it, vi } from "vitest";

// Mock the imports that format-value.ts depends on
vi.mock("@radarboard/utils/format-currency", () => ({
  formatCurrency: (value: number, currency?: string) =>
    `${currency === "EUR" ? "€" : "$"}${value.toFixed(2)}`,
}));

vi.mock("@radarboard/utils/format-date-time", () => ({
  formatDateTime: (value: unknown) => {
    if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return `formatted:${value}`;
    }
    return String(value);
  },
  isDateString: (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value),
}));

vi.mock("@radarboard/utils/format-number", () => ({
  formatNumber: (value: number, opts?: { compact?: boolean }) =>
    opts?.compact ? `${(value / 1000).toFixed(1)}K` : String(value),
}));

vi.mock("../../../components/compact-project-badge", () => ({
  resolveCompactProjectBadgeLabel: (value: unknown) =>
    typeof value === "string" ? `badge:${value}` : null,
}));

import { formatValue, getSiblingCurrencyField } from "../format-value";

describe("formatValue (widget-engine)", () => {
  describe("null/undefined", () => {
    it("returns dash for null", () => {
      expect(formatValue(null)).toBe("—");
    });

    it("returns dash for undefined", () => {
      expect(formatValue(undefined)).toBe("—");
    });
  });

  describe("currency format", () => {
    it("formats with default USD", () => {
      expect(formatValue(99.99, "currency")).toBe("$99.99");
    });

    it("formats with explicit currency", () => {
      expect(formatValue(49.99, "currency", { currency: "EUR" })).toBe("€49.99");
    });

    it("returns string for non-number", () => {
      expect(formatValue("free", "currency")).toBe("free");
    });
  });

  describe("number format", () => {
    it("formats with precision", () => {
      const result = formatValue(Math.PI, "number", { precision: 2 });
      expect(result).toBe("3.14");
    });

    it("delegates to formatNumber for default", () => {
      expect(formatValue(1234, "number")).toBe("1234");
    });

    it("supports compact mode", () => {
      expect(formatValue(5000, "number", { compact: true })).toBe("5.0K");
    });

    it("returns string for non-number", () => {
      expect(formatValue("abc", "number")).toBe("abc");
    });
  });

  describe("percent format", () => {
    it("formats with 0 decimals for large values", () => {
      expect(formatValue(85, "percent")).toBe("85%");
    });

    it("formats with 1 decimal for small values", () => {
      expect(formatValue(5.67, "percent")).toBe("5.7%");
    });

    it("respects explicit precision", () => {
      expect(formatValue(85.123, "percent", { precision: 2 })).toBe("85.12%");
    });
  });

  describe("duration-seconds format", () => {
    it("formats seconds only", () => {
      expect(formatValue(45, "duration-seconds")).toBe("45s");
    });

    it("formats minutes and seconds", () => {
      expect(formatValue(125, "duration-seconds")).toBe("2m 5s");
    });

    it("handles 0", () => {
      expect(formatValue(0, "duration-seconds")).toBe("0s");
    });

    it("rounds fractional values", () => {
      expect(formatValue(90.7, "duration-seconds")).toBe("1m 31s");
    });

    it("returns string for NaN", () => {
      expect(formatValue(NaN, "duration-seconds")).toBe("NaN");
    });
  });

  describe("relative-time format", () => {
    it("formats seconds ago", () => {
      const recent = Date.now() - 30_000;
      expect(formatValue(recent, "relative-time")).toMatch(/\d+s ago/);
    });

    it("formats minutes ago", () => {
      const fiveMin = Date.now() - 5 * 60_000;
      expect(formatValue(fiveMin, "relative-time")).toMatch(/5m ago/);
    });

    it("handles unix seconds (auto-converts to ms)", () => {
      const tenSecAgo = Math.floor(Date.now() / 1000) - 10;
      expect(formatValue(tenSecAgo, "relative-time")).toMatch(/\d+s ago/);
    });

    it("parses ISO date strings", () => {
      const recent = new Date(Date.now() - 120_000).toISOString();
      expect(formatValue(recent, "relative-time")).toMatch(/2m ago/);
    });

    it("returns original string for unparseable", () => {
      expect(formatValue("not-a-date", "relative-time")).toBe("not-a-date");
    });

    it("returns dash for NaN", () => {
      expect(formatValue(NaN, "relative-time")).toBe("—");
    });

    it("returns dash for boolean", () => {
      expect(formatValue(true, "relative-time")).toBe("—");
    });
  });

  describe("date format", () => {
    it("formats date string", () => {
      expect(formatValue("2026-03-28", "date")).toBe("formatted:2026-03-28");
    });
  });

  describe("no format (auto-detection)", () => {
    it("auto-detects date strings", () => {
      expect(formatValue("2026-03-28")).toBe("formatted:2026-03-28");
    });

    it("formats numbers", () => {
      expect(formatValue(42)).toBe("42");
    });

    it("returns string as-is for non-date strings", () => {
      expect(formatValue("hello")).toBe("hello");
    });
  });

  describe("normalize option", () => {
    it("compact-project delegates to resolveCompactProjectBadgeLabel", () => {
      expect(formatValue("my-project", "number", { normalize: "compact-project" })).toBe(
        "badge:my-project"
      );
    });

    it("returns dash when normalize returns null", () => {
      expect(formatValue(123, "number", { normalize: "compact-project" })).toBe("—");
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
