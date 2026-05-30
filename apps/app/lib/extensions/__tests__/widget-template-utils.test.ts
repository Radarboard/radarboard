import { describe, expect, it } from "vitest";
import { evaluateCondition } from "../../../../../packages/widget-engine/src/templates/utils/evaluate-condition";
import {
  formatValue,
  getSiblingCurrencyField,
} from "../../../../../packages/widget-engine/src/templates/utils/format-value";
import { getByPath } from "../../../../../packages/widget-engine/src/templates/utils/get-by-path";
import {
  encodeSelectionValue,
  parseSelectionValue,
} from "../../../../../packages/widget-engine/src/templates/utils/selection";

describe("widget template utils", () => {
  it("resolves nested object and array paths", () => {
    const input = {
      revenue: {
        payments: [{ amount: 12.5, currency: "CAD" }],
      },
    };

    expect(getByPath(input, "revenue.payments[0].amount")).toBe(12.5);
    expect(getByPath(input, "revenue.payments[0].currency")).toBe("CAD");
    expect(getByPath(input, "revenue.payments[1].amount")).toBeUndefined();
  });

  it("formats values for template sections", () => {
    expect(formatValue(12.5, "currency", { currency: "CAD" })).toBe("CA$12.50");
    expect(formatValue(42, "number")).toBe("42");
    expect(formatValue(12.4, "percent")).toBe("12%");
    expect(formatValue("2h ago", "relative-time")).toBe("2h ago");
    expect(formatValue("2026-03-27T12:30:00.000Z")).not.toBe("2026-03-27T12:30:00.000Z");
  });

  it("derives sibling currency field paths", () => {
    expect(getSiblingCurrencyField("grossRevenue.value")).toBe("grossRevenue.currency");
    expect(getSiblingCurrencyField("amount")).toBe("currency");
  });

  it("evaluates supported alert operators", () => {
    expect(evaluateCondition(-12, "lt", 0)).toBe(true);
    expect(evaluateCondition(12, "gt", 0)).toBe(true);
    expect(evaluateCondition("ok", "eq", "ok")).toBe(true);
    expect(evaluateCondition(false, "neq", true)).toBe(true);
    expect(evaluateCondition(5, "lte", 5)).toBe(true);
    expect(evaluateCondition(5, "gte", 5)).toBe(true);
  });

  it("encodes and parses namespaced selection values", () => {
    const encoded = encodeSelectionValue("page", "/docs::main");

    expect(encoded).toBe("page:/docs::main");
    expect(parseSelectionValue(encoded)).toEqual({
      selectionId: "page",
      itemKey: "/docs::main",
    });
    expect(parseSelectionValue("invalid")).toBeNull();
  });
});
