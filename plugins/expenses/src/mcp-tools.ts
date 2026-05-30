import type { McpToolDefinition, PluginAPI } from "@radarboard/plugin-sdk/types";
import { integrationRoute } from "@radarboard/utils/api-routes";
import { z } from "zod";
import {
  calculateMonthlyEquivalent,
  generateId,
  normalizeExpenses,
  now,
  restoreExpense as restoreExpenseOp,
  softDelete,
  syncBillingData,
} from "./expense-operations";
import type { BillingCycle, Budget, CostBreakdownItem, ExpenseEntry, ExpenseTag } from "./types";

const DB_KEYS = {
  expenses: "expenses:list",
  tags: "expenses:tags",
  budget: "expenses:budget",
} as const;

async function getExpenses(api: PluginAPI): Promise<ExpenseEntry[]> {
  const raw =
    (await api.db.get<Array<Record<string, unknown> & { id: string }>>(DB_KEYS.expenses)) ?? [];
  return normalizeExpenses(raw);
}

async function saveExpenses(api: PluginAPI, expenses: ExpenseEntry[]): Promise<void> {
  await api.db.set(DB_KEYS.expenses, expenses);
}

async function getTags(api: PluginAPI): Promise<ExpenseTag[]> {
  return (await api.db.get<ExpenseTag[]>(DB_KEYS.tags)) ?? [];
}

async function saveTags(api: PluginAPI, tags: ExpenseTag[]): Promise<void> {
  await api.db.set(DB_KEYS.tags, tags);
}

async function resolveTagNames(api: PluginAPI, names: string[]): Promise<string[]> {
  const tags = await getTags(api);
  const ids: string[] = [];
  const newTags: ExpenseTag[] = [];

  for (const name of names) {
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      ids.push(existing.id);
    } else {
      const tag: ExpenseTag = { id: generateId(), name };
      newTags.push(tag);
      ids.push(tag.id);
    }
  }

  if (newTags.length > 0) {
    await saveTags(api, [...tags, ...newTags]);
  }
  return ids;
}

export const expensesMcpTools: McpToolDefinition[] = [
  {
    name: "list_services",
    description:
      "List tracked service expenses with optional filters. By default excludes trashed expenses. Supports filtering by category and tag.",
    parameters: z.object({
      category: z
        .enum(["hosting", "monitoring", "analytics", "development", "marketing", "other"])
        .optional()
        .describe("Filter by category"),
      tags: z.array(z.string()).optional().describe("Filter by tag names (AND logic)"),
      include_deleted: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include trashed expenses (default: false)"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const filters = params as {
        category?: string;
        tags?: string[];
        include_deleted?: boolean;
      };
      let expenses = await getExpenses(api);

      if (!filters.include_deleted) expenses = expenses.filter((e) => e.deletedAt === null);
      if (filters.category) expenses = expenses.filter((e) => e.category === filters.category);
      if (filters.tags && filters.tags.length > 0) {
        const allTags = await getTags(api);
        const tagIds = filters.tags
          .map((name) => allTags.find((t) => t.name.toLowerCase() === name.toLowerCase())?.id)
          .filter(Boolean) as string[];
        expenses = expenses.filter((e) => tagIds.every((id) => e.tags.includes(id)));
      }

      return { services: expenses, count: expenses.length };
    },
  },

  {
    name: "add_expense",
    description: "Add a new service expense. Optionally include tags and service URL.",
    parameters: z.object({
      name: z.string().describe("Service name"),
      cost: z.number().describe("Cost amount"),
      billing_cycle: z.enum(["monthly", "annual", "one-time"]).describe("Billing cycle"),
      category: z
        .enum(["hosting", "monitoring", "analytics", "development", "marketing", "other"])
        .describe("Expense category"),
      renewal_date: z.string().optional().describe("Renewal date in YYYY-MM-DD format"),
      notes: z.string().optional().describe("Optional notes"),
      tags: z.array(z.string()).optional().describe("Tag names (created if they don't exist)"),
      url: z.string().optional().describe("Service URL"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const input = params as {
        name: string;
        cost: number;
        billing_cycle: BillingCycle;
        category: string;
        renewal_date?: string;
        notes?: string;
        tags?: string[];
        url?: string;
      };
      const expenses = await getExpenses(api);
      const tagIds = input.tags ? await resolveTagNames(api, input.tags) : [];
      const entry: ExpenseEntry = {
        id: generateId(),
        name: input.name,
        cost: input.cost,
        billingCycle: input.billing_cycle,
        category: input.category,
        renewalDate: input.renewal_date,
        notes: input.notes,
        url: input.url,
        tags: tagIds,
        deletedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      expenses.push(entry);
      await saveExpenses(api, expenses);
      return { success: true, expense: entry };
    },
  },

  {
    name: "update_expense",
    description:
      "Update cost, billing info, category, tags, or URL for an existing service expense.",
    parameters: z.object({
      expense_id: z.string().describe("The expense ID to update"),
      name: z.string().optional().describe("New name"),
      cost: z.number().optional().describe("New cost"),
      billing_cycle: z
        .enum(["monthly", "annual", "one-time"])
        .optional()
        .describe("New billing cycle"),
      category: z
        .enum(["hosting", "monitoring", "analytics", "development", "marketing", "other"])
        .optional()
        .describe("New category"),
      renewal_date: z.string().optional().describe("New renewal date"),
      notes: z.string().optional().describe("New notes"),
      tags: z.array(z.string()).optional().describe("Replace tag list (by name)"),
      url: z.string().optional().describe("New service URL"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { expense_id, ...changes } = params as {
        expense_id: string;
        name?: string;
        cost?: number;
        billing_cycle?: BillingCycle;
        category?: string;
        renewal_date?: string;
        notes?: string;
        tags?: string[];
        url?: string;
      };
      const expenses = await getExpenses(api);
      const expense = expenses.find((e) => e.id === expense_id);
      if (!expense) return { success: false, error: "Expense not found" };

      if (changes.name !== undefined) expense.name = changes.name;
      if (changes.cost !== undefined) expense.cost = changes.cost;
      if (changes.billing_cycle !== undefined) expense.billingCycle = changes.billing_cycle;
      if (changes.category !== undefined) expense.category = changes.category;
      if (changes.renewal_date !== undefined) expense.renewalDate = changes.renewal_date;
      if (changes.notes !== undefined) expense.notes = changes.notes;
      if (changes.url !== undefined) expense.url = changes.url;
      if (changes.tags !== undefined) {
        expense.tags = await resolveTagNames(api, changes.tags);
      }
      expense.updatedAt = now();

      await saveExpenses(api, expenses);
      return { success: true, expense };
    },
  },

  {
    name: "delete_expense",
    description:
      "Soft-delete an expense (moves to trash, recoverable for 30 days). Use restore_expense to recover.",
    parameters: z.object({
      expense_id: z.string().describe("The expense ID to delete"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { expense_id } = params as { expense_id: string };
      const expenses = await getExpenses(api);
      const expense = expenses.find((e) => e.id === expense_id);
      if (!expense) return { success: false, error: "Expense not found" };

      const updated = expenses.map((e) => (e.id === expense_id ? softDelete(e) : e));
      await saveExpenses(api, updated);
      return { success: true };
    },
  },

  {
    name: "get_expense",
    description:
      "Get full details of a single expense including tags, cost breakdown, and integration source.",
    parameters: z.object({
      expense_id: z.string().describe("The expense ID to retrieve"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { expense_id } = params as { expense_id: string };
      const expenses = await getExpenses(api);
      const expense = expenses.find((e) => e.id === expense_id);
      if (!expense) return { success: false, error: "Expense not found" };
      return { success: true, expense };
    },
  },

  {
    name: "restore_expense",
    description: "Restore a soft-deleted expense from trash.",
    parameters: z.object({
      expense_id: z.string().describe("The expense ID to restore"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { expense_id } = params as { expense_id: string };
      const expenses = await getExpenses(api);
      const expense = expenses.find((e) => e.id === expense_id);
      if (!expense) return { success: false, error: "Expense not found" };

      const restored = restoreExpenseOp(expense);
      const updated = expenses.map((e) => (e.id === expense_id ? restored : e));
      await saveExpenses(api, updated);
      return { success: true, expense: restored };
    },
  },

  {
    name: "get_monthly_summary",
    description: "Get total monthly spend, breakdown by category, and budget status.",
    parameters: z.object({}),
    execute: async (_params: unknown, api: PluginAPI) => {
      const expenses = await getExpenses(api);
      const active = expenses.filter((e) => e.deletedAt === null);
      const budget = await api.db.get<Budget>(DB_KEYS.budget);

      const byCategory = new Map<string, number>();
      let total = 0;

      for (const e of active) {
        const monthly = calculateMonthlyEquivalent(e.cost, e.billingCycle);
        total += monthly;
        byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + monthly);
      }

      return {
        total_monthly: total,
        budget_limit: budget?.totalMonthly ?? null,
        over_budget: budget?.totalMonthly ? total > budget.totalMonthly : false,
        breakdown: Array.from(byCategory.entries())
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount),
        service_count: active.length,
      };
    },
  },

  {
    name: "get_upcoming_renewals",
    description: "Get services renewing within the next N days.",
    parameters: z.object({
      days: z.number().optional().default(7).describe("Number of days to look ahead"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { days } = params as { days: number };
      const expenses = await getExpenses(api);
      const active = expenses.filter((e) => e.deletedAt === null);
      const nowDate = new Date();
      const cutoff = new Date(nowDate.getTime() + days * 24 * 60 * 60 * 1000);
      const todayStr = nowDate.toISOString().split("T")[0] ?? "";
      const cutoffStr = cutoff.toISOString().split("T")[0] ?? "";

      const renewals = active
        .filter((e) => e.renewalDate && e.renewalDate >= todayStr && e.renewalDate <= cutoffStr)
        .sort((a, b) => (a.renewalDate ?? "").localeCompare(b.renewalDate ?? ""));

      return { renewals, count: renewals.length };
    },
  },

  {
    name: "sync_billing",
    description:
      "Sync billing data from connected integrations (Vercel, GitHub). Auto-creates or updates expense entries with current costs.",
    parameters: z.object({
      integration: z
        .string()
        .optional()
        .describe("Specific integration to sync (e.g. 'vercel', 'github'). Omit to sync all."),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { integration } = params as { integration?: string };
      const integrations = integration ? [integration] : ["vercel", "github"];
      let expenses = await getExpenses(api);
      const synced: string[] = [];

      for (const id of integrations) {
        const dsId = `${id}-billing`;
        const connected = await api.dataSources.isConnected(dsId);
        if (!connected) continue;

        try {
          const res = await fetch(integrationRoute(id, "billing"));
          if (!res.ok) continue;
          const data = (await res.json()) as {
            total?: number | null;
            breakdown?: CostBreakdownItem[];
          };
          if (data.total == null) continue;
          expenses = syncBillingData(expenses, id, {
            total: data.total,
            breakdown: data.breakdown ?? [],
          });
          synced.push(id);
        } catch {
          // Network failure — skip silently
        }
      }

      if (synced.length > 0) {
        await saveExpenses(api, expenses);
      }

      return {
        success: true,
        synced,
        expenses_updated: synced.length,
      };
    },
  },

  {
    name: "set_budget",
    description: "Set or clear monthly budget limits (total and/or per-category).",
    parameters: z.object({
      total_monthly: z.number().optional().describe("Total monthly budget limit"),
      category_budgets: z
        .record(z.string(), z.number())
        .optional()
        .describe("Per-category budget limits (e.g. { hosting: 200, development: 100 })"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const input = params as {
        total_monthly?: number;
        category_budgets?: Record<string, number>;
      };
      const budget: Budget = {
        totalMonthly: input.total_monthly,
        byCategory: input.category_budgets as Budget["byCategory"],
      };
      await api.db.set(DB_KEYS.budget, budget);
      return { success: true, budget };
    },
  },

  {
    name: "get_budget_status",
    description: "Get current spend vs budget limits.",
    parameters: z.object({}),
    execute: async (_params: unknown, api: PluginAPI) => {
      const expenses = await getExpenses(api);
      const active = expenses.filter((e) => e.deletedAt === null);
      const budget = await api.db.get<Budget>(DB_KEYS.budget);

      if (!budget) return { budget: null, message: "No budget configured" };

      const byCategory = new Map<string, number>();
      let total = 0;
      for (const e of active) {
        const monthly = calculateMonthlyEquivalent(e.cost, e.billingCycle);
        total += monthly;
        byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + monthly);
      }

      const totalStatus = budget.totalMonthly
        ? {
            current: total,
            limit: budget.totalMonthly,
            percentage: Math.round((total / budget.totalMonthly) * 100),
          }
        : null;

      const categoryStatus = budget.byCategory
        ? Object.entries(budget.byCategory).map(([cat, limit]) => ({
            category: cat,
            current: byCategory.get(cat) ?? 0,
            limit: limit as number,
            percentage: Math.round(((byCategory.get(cat) ?? 0) / (limit as number)) * 100),
          }))
        : [];

      return {
        total: totalStatus,
        by_category: categoryStatus,
      };
    },
  },
];
