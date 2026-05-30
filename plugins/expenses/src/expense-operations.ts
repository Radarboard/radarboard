import { generateId, now, TRASH_RETENTION_DAYS } from "@radarboard/plugin-sdk/utils";
import type { BillingCycle, CostBreakdownItem, ExpenseEntry } from "./types";

export { generateId, now };

const CURRENCY_LOCALES = new Map([
  ["USD", "en-US"],
  ["EUR", "de-DE"],
  ["GBP", "en-GB"],
  ["CAD", "en-CA"],
  ["BRL", "pt-BR"],
]);

/**
 * Normalize a single expense — fills defaults for fields added after initial release.
 */
export function normalizeExpense(expense: Record<string, unknown> & { id: string }): ExpenseEntry {
  return {
    ...(expense as unknown as ExpenseEntry),
    tags: (expense.tags as string[] | undefined) ?? [],
    deletedAt: (expense.deletedAt as string | null | undefined) ?? null,
  };
}

/**
 * Normalize an array of expenses and purge trashed expenses older than 30 days.
 */
export function normalizeExpenses(
  expenses: Array<Record<string, unknown> & { id: string }>
): ExpenseEntry[] {
  const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return expenses.map(normalizeExpense).filter((e) => {
    if (e.deletedAt === null) return true;
    return new Date(e.deletedAt).getTime() > cutoff;
  });
}

/**
 * Soft-delete an expense by setting deletedAt.
 */
export function softDelete(expense: ExpenseEntry): ExpenseEntry {
  return { ...expense, deletedAt: now(), updatedAt: now() };
}

/**
 * Restore a soft-deleted expense by clearing deletedAt.
 */
export function restoreExpense(expense: ExpenseEntry): ExpenseEntry {
  if (expense.deletedAt !== null) {
    return { ...expense, deletedAt: null, updatedAt: now() };
  }
  return expense;
}

/**
 * Format a currency amount using Intl.NumberFormat with locale derived from currency code.
 */
export function formatCurrency(amount: number, currency: string): string {
  const locale = CURRENCY_LOCALES.get(currency) ?? "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Convert a cost to its monthly equivalent based on billing cycle.
 */
export function calculateMonthlyEquivalent(cost: number, billingCycle: BillingCycle): number {
  switch (billingCycle) {
    case "monthly":
      return cost;
    case "annual":
      return cost / 12;
    case "one-time":
      return 0;
    default:
      return cost;
  }
}

/**
 * Upsert an auto-detected expense from integration billing data.
 * Matches by integrationSource. Creates new if not found, updates if found.
 * Preserves user-edited fields (category, tags, notes, url) on update.
 */
export function syncBillingData(
  expenses: ExpenseEntry[],
  integration: string,
  billingData: { total: number; breakdown: CostBreakdownItem[] }
): ExpenseEntry[] {
  const existing = expenses.find(
    (e) => e.integrationSource === integration && e.deletedAt === null
  );

  if (existing) {
    return expenses.map((e) =>
      e.id === existing.id
        ? {
            ...e,
            cost: billingData.total,
            costBreakdown: billingData.breakdown,
            updatedAt: now(),
          }
        : e
    );
  }

  const integrationNames: Record<string, string> = {
    vercel: "Vercel",
    github: "GitHub",
  };

  const newExpense: ExpenseEntry = {
    id: generateId(),
    name: integrationNames[integration] ?? integration,
    cost: billingData.total,
    billingCycle: "monthly",
    category: "hosting",
    tags: [],
    deletedAt: null,
    autoDetected: true,
    integrationSource: integration,
    costBreakdown: billingData.breakdown,
    createdAt: now(),
    updatedAt: now(),
  };

  return [...expenses, newExpense];
}
