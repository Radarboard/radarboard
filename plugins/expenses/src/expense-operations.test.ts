import { describe, expect, it } from "vitest";
import {
  calculateMonthlyEquivalent,
  formatCurrency,
  normalizeExpense,
  normalizeExpenses,
  restoreExpense,
  softDelete,
  syncBillingData,
} from "./expense-operations";
import type { ExpenseEntry } from "./types";

function makeExpense(overrides: Partial<ExpenseEntry> = {}): ExpenseEntry {
  return {
    id: "test-1",
    name: "Test Service",
    cost: 10,
    billingCycle: "monthly",
    category: "hosting",
    tags: [],
    deletedAt: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("normalizeExpense", () => {
  it("fills defaults for missing new fields", () => {
    const legacy = {
      id: "1",
      name: "Old",
      cost: 10,
      billingCycle: "monthly",
      category: "hosting",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    } as Record<string, unknown> & { id: string };
    const result = normalizeExpense(legacy);
    expect(result.tags).toEqual([]);
    expect(result.deletedAt).toBeNull();
  });

  it("preserves existing new fields", () => {
    const expense = {
      id: "1",
      name: "New",
      cost: 20,
      billingCycle: "annual",
      category: "development",
      tags: ["tag-1"],
      deletedAt: "2026-03-15T00:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    } as Record<string, unknown> & { id: string };
    const result = normalizeExpense(expense);
    expect(result.tags).toEqual(["tag-1"]);
    expect(result.deletedAt).toBe("2026-03-15T00:00:00Z");
  });
});

describe("normalizeExpenses", () => {
  it("purges expenses in trash older than 30 days", () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const expenses = [
      {
        id: "1",
        name: "Old deleted",
        cost: 10,
        billingCycle: "monthly",
        category: "hosting",
        deletedAt: old,
        createdAt: old,
        updatedAt: old,
      },
      {
        id: "2",
        name: "Recent deleted",
        cost: 20,
        billingCycle: "monthly",
        category: "hosting",
        deletedAt: recent,
        createdAt: recent,
        updatedAt: recent,
      },
      {
        id: "3",
        name: "Active",
        cost: 30,
        billingCycle: "monthly",
        category: "hosting",
        createdAt: recent,
        updatedAt: recent,
      },
    ] as Array<Record<string, unknown> & { id: string }>;

    const result = normalizeExpenses(expenses);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(["2", "3"]);
  });
});

describe("softDelete", () => {
  it("sets deletedAt to ISO string", () => {
    const expense = makeExpense();
    const deleted = softDelete(expense);
    expect(deleted.deletedAt).toBeTruthy();
    expect(new Date(deleted.deletedAt as string).getTime()).toBeGreaterThan(0);
    expect(deleted.id).toBe(expense.id);
  });
});

describe("restoreExpense", () => {
  it("clears deletedAt for trashed expenses", () => {
    const expense = makeExpense({ deletedAt: "2026-03-15T00:00:00Z" });
    const restored = restoreExpense(expense);
    expect(restored.deletedAt).toBeNull();
  });

  it("returns expense unchanged if not trashed", () => {
    const expense = makeExpense({ deletedAt: null });
    const restored = restoreExpense(expense);
    expect(restored).toEqual(expense);
  });
});

describe("formatCurrency", () => {
  it("formats USD", () => {
    const result = formatCurrency(1234.5, "USD");
    expect(result).toContain("1,234.5");
    expect(result).toContain("$");
  });

  it("formats EUR", () => {
    const result = formatCurrency(1234.5, "EUR");
    expect(result).toContain("\u20AC");
  });

  it("formats GBP", () => {
    const result = formatCurrency(1234.5, "GBP");
    expect(result).toContain("\u00A3");
  });

  it("formats BRL", () => {
    const result = formatCurrency(1234.5, "BRL");
    expect(result).toContain("R$");
  });

  it("handles zero", () => {
    const result = formatCurrency(0, "USD");
    expect(result).toContain("$");
    expect(result).toContain("0");
  });
});

describe("calculateMonthlyEquivalent", () => {
  it("returns monthly cost as-is", () => {
    expect(calculateMonthlyEquivalent(100, "monthly")).toBe(100);
  });

  it("divides annual cost by 12", () => {
    expect(calculateMonthlyEquivalent(120, "annual")).toBe(10);
  });

  it("returns 0 for one-time costs", () => {
    expect(calculateMonthlyEquivalent(500, "one-time")).toBe(0);
  });
});

describe("syncBillingData", () => {
  it("creates new expense when none exists for integration", () => {
    const expenses = [makeExpense({ id: "manual-1" })];
    const result = syncBillingData(expenses, "vercel", {
      total: 42.5,
      breakdown: [
        { label: "Bandwidth", amount: 30 },
        { label: "Serverless", amount: 12.5 },
      ],
    });

    expect(result).toHaveLength(2);
    const synced = result.find((e) => e.integrationSource === "vercel");
    expect(synced).toBeDefined();
    expect(synced?.name).toBe("Vercel");
    expect(synced?.cost).toBe(42.5);
    expect(synced?.billingCycle).toBe("monthly");
    expect(synced?.autoDetected).toBe(true);
    expect(synced?.costBreakdown).toHaveLength(2);
  });

  it("updates existing expense for integration", () => {
    const expenses = [
      makeExpense({
        id: "synced-1",
        name: "Vercel",
        cost: 30,
        integrationSource: "vercel",
        autoDetected: true,
        category: "development",
        tags: ["tag-1"],
        notes: "My notes",
      }),
    ];
    const result = syncBillingData(expenses, "vercel", {
      total: 55,
      breakdown: [{ label: "Bandwidth", amount: 55 }],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.cost).toBe(55);
    expect(result[0]?.costBreakdown).toEqual([{ label: "Bandwidth", amount: 55 }]);
    // Preserves user-edited fields
    expect(result[0]?.category).toBe("development");
    expect(result[0]?.tags).toEqual(["tag-1"]);
    expect(result[0]?.notes).toBe("My notes");
  });

  it("skips soft-deleted expenses when looking for existing", () => {
    const expenses = [
      makeExpense({
        id: "deleted-synced",
        integrationSource: "vercel",
        autoDetected: true,
        deletedAt: "2026-03-15T00:00:00Z",
      }),
    ];
    const result = syncBillingData(expenses, "vercel", {
      total: 10,
      breakdown: [],
    });

    // Should create a new one, not update the deleted one
    expect(result).toHaveLength(2);
    expect(result[1]?.integrationSource).toBe("vercel");
    expect(result[1]?.deletedAt).toBeNull();
  });
});
