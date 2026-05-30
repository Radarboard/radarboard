export type BillingCycle = "monthly" | "annual" | "one-time";

export interface CategoryDefinition {
  id: string;
  label: string;
  color: string;
  builtIn: boolean;
  order: number;
}

export const BUILT_IN_CATEGORIES: CategoryDefinition[] = [
  { id: "hosting", label: "Hosting", color: "#38bdf8", builtIn: true, order: 0 },
  { id: "monitoring", label: "Monitoring", color: "#a78bfa", builtIn: true, order: 1 },
  { id: "analytics", label: "Analytics", color: "#fb923c", builtIn: true, order: 2 },
  { id: "development", label: "Development", color: "#34d399", builtIn: true, order: 3 },
  { id: "marketing", label: "Marketing", color: "#f472b6", builtIn: true, order: 4 },
  { id: "other", label: "Other", color: "#6b7280", builtIn: true, order: 5 },
];

/**
 * Merge built-in categories with user-created ones.
 * User categories with the same id as a built-in override it.
 */
export function mergeCategories(userCategories: CategoryDefinition[]): CategoryDefinition[] {
  const userIds = new Set(userCategories.map((c) => c.id));
  const builtIns = BUILT_IN_CATEGORIES.filter((c) => !userIds.has(c.id));
  return [...builtIns, ...userCategories].sort((a, b) => a.order - b.order);
}

export interface CostBreakdownItem {
  label: string;
  amount: number;
}

export interface ExpenseEntry {
  id: string;
  name: string;
  cost: number; // Raw cost in display currency
  billingCycle: BillingCycle;
  category: string;
  renewalDate?: string; // ISO 8601 date (YYYY-MM-DD)
  notes?: string;
  autoDetected?: boolean;
  tags: string[]; // Tag IDs
  deletedAt: string | null; // ISO 8601 soft-delete timestamp, null = active
  url?: string; // Service URL (pricing page, dashboard)
  integrationSource?: string; // e.g. "vercel", "github"
  costBreakdown?: CostBreakdownItem[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface ExpenseTag {
  id: string;
  name: string;
}

export interface Budget {
  totalMonthly?: number;
  byCategory?: Record<string, number>;
}

export interface BudgetAlertState {
  totalExceededAt?: string;
  totalApproachedAt?: string;
  byCategoryExceededAt?: Record<string, string>;
  byCategoryApproachedAt?: Record<string, string>;
}

export interface ExpensesSettings {
  currency: string;
  alertDaysAhead: number;
}

export const DEFAULT_EXPENSES_SETTINGS: ExpensesSettings = {
  currency: "USD",
  alertDaysAhead: 7,
};

/** @deprecated Use BUILT_IN_CATEGORIES instead */
export const EXPENSE_CATEGORIES: { value: string; label: string }[] = BUILT_IN_CATEGORIES.map(
  (c) => ({ value: c.id, label: c.label })
);

/** @deprecated Use string directly */
export type ExpenseCategory = string;
