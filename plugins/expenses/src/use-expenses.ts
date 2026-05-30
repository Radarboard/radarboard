"use client";

import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { integrationRoute } from "@radarboard/utils/api-routes";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calculateMonthlyEquivalent,
  generateId,
  normalizeExpense,
  normalizeExpenses,
  now,
  restoreExpense as restoreExpenseOp,
  softDelete,
  syncBillingData,
} from "./expense-operations";
import {
  type BillingCycle,
  BUILT_IN_CATEGORIES,
  type Budget,
  type BudgetAlertState,
  type CategoryDefinition,
  type CostBreakdownItem,
  DEFAULT_EXPENSES_SETTINGS,
  type ExpenseEntry,
  type ExpensesSettings,
  type ExpenseTag,
  mergeCategories,
} from "./types";

const DB_KEYS = {
  expenses: "expenses:list",
  settings: "expenses:settings",
  tags: "expenses:tags",
  budget: "expenses:budget",
  budgetAlertState: "expenses:budget-alert-state",
  categories: "expenses:categories",
} as const;

export function useExpenses(api: PluginAPI) {
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [settings, setSettings] = useState<ExpensesSettings>(DEFAULT_EXPENSES_SETTINGS);
  const [tags, setTags] = useState<ExpenseTag[]>([]);
  const [budget, setBudgetState] = useState<Budget | null>(null);
  const [_budgetAlertState, _setBudgetAlertState] = useState<BudgetAlertState>({});
  const [userCategories, setUserCategories] = useState<CategoryDefinition[]>([]);
  const [loaded, setLoaded] = useState(false);

  const categories = useMemo(() => mergeCategories(userCategories), [userCategories]);

  const applyState = useCallback((state: Awaited<ReturnType<typeof loadExpenseState>>) => {
    if (state.expenses) setExpenses(state.expenses);
    if (state.settings) setSettings(state.settings);
    if (state.tags) setTags(state.tags);
    if (state.budget) setBudgetState(state.budget);
    if (state.budgetAlertState) _setBudgetAlertState(state.budgetAlertState);
    if (state.categories) setUserCategories(state.categories);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadExpenseState(api)
      .then((state) => {
        if (!cancelled) applyState(state);
      })
      .catch(() => {
        /* fire-and-forget */
      });
    return () => {
      cancelled = true;
    };
  }, [api, applyState]);

  const persistExpenses = useCallback(
    async (updated: ExpenseEntry[]) => {
      setExpenses(updated);
      await api.db.set(DB_KEYS.expenses, updated);
    },
    [api]
  );

  const persistTags = useCallback(
    async (updated: ExpenseTag[]) => {
      setTags(updated);
      await api.db.set(DB_KEYS.tags, updated);
    },
    [api]
  );

  const getOrCreateTag = useCallback(
    async (name: string): Promise<ExpenseTag> => {
      const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (existing) return existing;
      const tag: ExpenseTag = { id: generateId(), name };
      await persistTags([...tags, tag]);
      return tag;
    },
    [tags, persistTags]
  );

  const resolveTagNames = useCallback(
    async (names: string[]): Promise<string[]> => {
      const ids: string[] = [];
      for (const name of names) {
        const tag = await getOrCreateTag(name);
        ids.push(tag.id);
      }
      return ids;
    },
    [getOrCreateTag]
  );

  const persistCategories = useCallback(
    async (updated: CategoryDefinition[]) => {
      setUserCategories(updated);
      await api.db.set(DB_KEYS.categories, updated);
    },
    [api]
  );

  const addCategory = useCallback(
    async (input: { label: string; color: string }) => {
      const id = input.label.toLowerCase().replace(/\s+/g, "-");
      const existing = mergeCategories(userCategories);
      if (existing.some((c) => c.id === id)) return;
      const cat: CategoryDefinition = {
        id,
        label: input.label,
        color: input.color,
        builtIn: false,
        order: existing.length,
      };
      await persistCategories([...userCategories, cat]);
    },
    [userCategories, persistCategories]
  );

  const updateCategory = useCallback(
    async (id: string, changes: Partial<Pick<CategoryDefinition, "label" | "color" | "order">>) => {
      const builtin = BUILT_IN_CATEGORIES.find((c) => c.id === id);
      if (!builtin) {
        const updated = userCategories.map((c) => (c.id === id ? { ...c, ...changes } : c));
        await persistCategories(updated);
        return;
      }
      const existing = userCategories.find((c) => c.id === id);
      const override: CategoryDefinition = {
        ...builtin,
        ...existing,
        ...changes,
        id,
        builtIn: false,
      };
      const updated = existing
        ? userCategories.map((c) => (c.id === id ? override : c))
        : [...userCategories, override];
      await persistCategories(updated);
    },
    [userCategories, persistCategories]
  );

  const removeCategory = useCallback(
    async (id: string) => {
      const updated = userCategories.filter((c) => c.id !== id);
      await persistCategories(updated);
    },
    [userCategories, persistCategories]
  );

  const addExpense = useCallback(
    async (input: {
      name: string;
      cost: number;
      billingCycle: BillingCycle;
      category: string;
      renewalDate?: string;
      notes?: string;
      tags?: string[];
      url?: string;
    }) => {
      const tagIds = input.tags ? await resolveTagNames(input.tags) : [];
      const entry: ExpenseEntry = normalizeExpense({
        id: generateId(),
        name: input.name,
        cost: input.cost,
        billingCycle: input.billingCycle,
        category: input.category,
        renewalDate: input.renewalDate,
        notes: input.notes,
        url: input.url,
        tags: tagIds,
        deletedAt: null,
        createdAt: now(),
        updatedAt: now(),
      } as Record<string, unknown> & { id: string });
      const updated = [...expenses, entry];
      await persistExpenses(updated);
      return entry;
    },
    [expenses, persistExpenses, resolveTagNames]
  );

  const updateExpense = useCallback(
    async (
      id: string,
      changes: Partial<
        Pick<
          ExpenseEntry,
          | "name"
          | "cost"
          | "billingCycle"
          | "category"
          | "renewalDate"
          | "notes"
          | "tags"
          | "url"
          | "costBreakdown"
          | "integrationSource"
          | "deletedAt"
        >
      >
    ) => {
      const updated = expenses.map((e) =>
        e.id === id ? { ...e, ...changes, updatedAt: now() } : e
      );
      await persistExpenses(updated);
    },
    [expenses, persistExpenses]
  );

  const softDeleteExpense = useCallback(
    async (id: string) => {
      const updated = expenses.map((e) => (e.id === id ? softDelete(e) : e));
      await persistExpenses(updated);
    },
    [expenses, persistExpenses]
  );

  const permanentDeleteExpense = useCallback(
    async (id: string) => {
      const updated = expenses.filter((e) => e.id !== id);
      await persistExpenses(updated);
    },
    [expenses, persistExpenses]
  );

  const restoreExpense = useCallback(
    async (id: string) => {
      const expense = expenses.find((e) => e.id === id);
      if (!expense) return;
      const restored = restoreExpenseOp(expense);
      const updated = expenses.map((e) => (e.id === id ? restored : e));
      await persistExpenses(updated);
    },
    [expenses, persistExpenses]
  );

  const setBudget = useCallback(
    async (newBudget: Budget) => {
      setBudgetState(newBudget);
      await api.db.set(DB_KEYS.budget, newBudget);
    },
    [api]
  );

  const syncBilling = useCallback(
    async (integration?: string) => {
      const integrations = integration ? [integration] : ["vercel", "github"];
      let current = expenses;
      const synced: string[] = [];

      for (const id of integrations) {
        const result = await fetchBillingForIntegration(api, id);
        if (!result) continue;
        current = syncBillingData(current, id, result);
        synced.push(id);
      }

      if (synced.length > 0) {
        await persistExpenses(current);
      }
      return { synced, expensesUpdated: synced.length };
    },
    [expenses, persistExpenses, api]
  );

  const activeExpenses = useMemo(() => {
    return expenses.filter((e) => e.deletedAt === null);
  }, [expenses]);

  const monthlySummary = useMemo(() => {
    const byCategory = new Map<string, number>();
    let total = 0;

    for (const expense of activeExpenses) {
      const monthly = calculateMonthlyEquivalent(expense.cost, expense.billingCycle);
      total += monthly;
      byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + monthly);
    }

    return {
      total,
      byCategory: Array.from(byCategory.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [activeExpenses]);

  const budgetStatus = useMemo(() => {
    if (!budget) return null;
    const totalStatus = budget.totalMonthly
      ? {
          current: monthlySummary.total,
          limit: budget.totalMonthly,
          percentage: (monthlySummary.total / budget.totalMonthly) * 100,
        }
      : null;

    const byCategoryStatus = budget.byCategory
      ? Object.entries(budget.byCategory).map(([category, limit]) => {
          const current =
            monthlySummary.byCategory.find((c) => c.category === category)?.amount ?? 0;
          return {
            category,
            current,
            limit: limit as number,
            percentage: ((limit as number) > 0 ? current / (limit as number) : 0) * 100,
          };
        })
      : [];

    return { total: totalStatus, byCategory: byCategoryStatus };
  }, [budget, monthlySummary]);

  const upcomingRenewals = useMemo(() => {
    const nowDate = new Date();
    const cutoff = new Date(nowDate.getTime() + settings.alertDaysAhead * 24 * 60 * 60 * 1000);
    const todayStr = nowDate.toISOString().split("T")[0] ?? "";
    const cutoffStr = cutoff.toISOString().split("T")[0] ?? "";

    return activeExpenses
      .filter((e) => e.renewalDate && e.renewalDate >= todayStr && e.renewalDate <= cutoffStr)
      .sort((a, b) => (a.renewalDate ?? "").localeCompare(b.renewalDate ?? ""));
  }, [activeExpenses, settings.alertDaysAhead]);

  return {
    expenses,
    activeExpenses,
    settings,
    tags,
    categories,
    budget,
    budgetStatus,
    loaded,
    monthlySummary,
    upcomingRenewals,
    addExpense,
    updateExpense,
    softDeleteExpense,
    permanentDeleteExpense,
    restoreExpense,
    getOrCreateTag,
    setBudget,
    syncBilling,
    addCategory,
    updateCategory,
    removeCategory,
  };
}

async function loadExpenseState(api: PluginAPI) {
  const [expenses, settings, tags, budget, budgetAlertState, categories] = await Promise.all([
    api.db.get<Array<Record<string, unknown> & { id: string }>>(DB_KEYS.expenses),
    api.db.get<ExpensesSettings>(DB_KEYS.settings),
    api.db.get<ExpenseTag[]>(DB_KEYS.tags),
    api.db.get<Budget>(DB_KEYS.budget),
    api.db.get<BudgetAlertState>(DB_KEYS.budgetAlertState),
    api.db.get<CategoryDefinition[]>(DB_KEYS.categories),
  ]);
  return {
    expenses: expenses ? normalizeExpenses(expenses) : null,
    settings,
    tags,
    budget,
    budgetAlertState,
    categories,
  };
}

async function fetchBillingForIntegration(
  api: PluginAPI,
  id: string
): Promise<{ total: number; breakdown: CostBreakdownItem[] } | null> {
  const dsId = `${id}-billing`;
  const connected = await api.dataSources.isConnected(dsId);
  if (!connected) return null;

  try {
    const res = await fetch(integrationRoute(id, "billing"));
    if (!res.ok) return null;
    const data = (await res.json()) as {
      total?: number | null;
      breakdown?: CostBreakdownItem[];
    };
    if (data.total == null) return null;
    return { total: data.total, breakdown: data.breakdown ?? [] };
  } catch {
    return null;
  }
}
