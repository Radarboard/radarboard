import { createMockPluginAPI } from "@radarboard/plugin-sdk/testing";
import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { beforeEach, describe, expect, it } from "vitest";
import { expensesMcpTools } from "./mcp-tools";
import type { Budget, ExpenseEntry } from "./types";

function findTool(name: string) {
  const tool = expensesMcpTools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

describe("Expenses MCP Tools", () => {
  let api: PluginAPI;

  beforeEach(() => {
    api = createMockPluginAPI();
  });

  describe("add_expense", () => {
    it("adds a service expense", async () => {
      const tool = findTool("add_expense");
      const result = (await tool.execute(
        {
          name: "Vercel",
          cost: 20,
          billing_cycle: "monthly",
          category: "hosting",
        },
        api
      )) as { success: boolean; expense: ExpenseEntry };

      expect(result.success).toBe(true);
      expect(result.expense.name).toBe("Vercel");
      expect(result.expense.cost).toBe(20);
      expect(result.expense.billingCycle).toBe("monthly");
      expect(result.expense.category).toBe("hosting");
    });

    it("supports optional renewal date and notes", async () => {
      const tool = findTool("add_expense");
      const result = (await tool.execute(
        {
          name: "GitHub",
          cost: 4,
          billing_cycle: "monthly",
          category: "development",
          renewal_date: "2026-04-15",
          notes: "Team plan",
        },
        api
      )) as { success: boolean; expense: ExpenseEntry };

      expect(result.expense.renewalDate).toBe("2026-04-15");
      expect(result.expense.notes).toBe("Team plan");
    });
  });

  describe("list_services", () => {
    it("returns empty list initially", async () => {
      const tool = findTool("list_services");
      const result = (await tool.execute({}, api)) as {
        services: ExpenseEntry[];
        count: number;
      };
      expect(result.services).toEqual([]);
      expect(result.count).toBe(0);
    });

    it("lists all added services", async () => {
      const add = findTool("add_expense");
      const list = findTool("list_services");

      await add.execute(
        { name: "Vercel", cost: 20, billing_cycle: "monthly", category: "hosting" },
        api
      );
      await add.execute(
        { name: "Sentry", cost: 26, billing_cycle: "monthly", category: "monitoring" },
        api
      );

      const result = (await list.execute({}, api)) as {
        services: ExpenseEntry[];
        count: number;
      };
      expect(result.count).toBe(2);
      expect(result.services.map((s) => s.name)).toEqual(["Vercel", "Sentry"]);
    });
  });

  describe("update_expense", () => {
    it("updates expense fields", async () => {
      const add = findTool("add_expense");
      const update = findTool("update_expense");

      const { expense } = (await add.execute(
        { name: "Old Name", cost: 10, billing_cycle: "monthly", category: "other" },
        api
      )) as { expense: ExpenseEntry };

      const result = (await update.execute(
        { expense_id: expense.id, name: "New Name", cost: 25, category: "hosting" },
        api
      )) as { success: boolean; expense: ExpenseEntry };

      expect(result.success).toBe(true);
      expect(result.expense.name).toBe("New Name");
      expect(result.expense.cost).toBe(25);
      expect(result.expense.category).toBe("hosting");
    });

    it("returns error for nonexistent expense", async () => {
      const tool = findTool("update_expense");
      const result = (await tool.execute({ expense_id: "fake" }, api)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
    });
  });

  describe("delete_expense", () => {
    it("removes an expense", async () => {
      const add = findTool("add_expense");
      const del = findTool("delete_expense");
      const list = findTool("list_services");

      const { expense } = (await add.execute(
        { name: "Remove me", cost: 5, billing_cycle: "monthly", category: "other" },
        api
      )) as { expense: ExpenseEntry };

      const result = (await del.execute({ expense_id: expense.id }, api)) as {
        success: boolean;
      };
      expect(result.success).toBe(true);

      const remaining = (await list.execute({}, api)) as { count: number };
      expect(remaining.count).toBe(0);
    });
  });

  describe("get_monthly_summary", () => {
    it("calculates monthly totals with category breakdown", async () => {
      const add = findTool("add_expense");
      const summary = findTool("get_monthly_summary");

      await add.execute(
        { name: "Vercel", cost: 20, billing_cycle: "monthly", category: "hosting" },
        api
      );
      await add.execute(
        { name: "Sentry", cost: 26, billing_cycle: "monthly", category: "monitoring" },
        api
      );
      await add.execute(
        { name: "AWS", cost: 120, billing_cycle: "annual", category: "hosting" },
        api
      );

      const result = (await summary.execute({}, api)) as {
        total_monthly: number;
        breakdown: { category: string; amount: number }[];
        service_count: number;
      };

      expect(result.service_count).toBe(3);
      // 20 + 26 + (120/12) = 56
      expect(result.total_monthly).toBe(56);
      // Hosting: 20 + 10 = 30, Monitoring: 26
      expect(result.breakdown).toHaveLength(2);
      expect(result.breakdown[0]?.category).toBe("hosting");
      expect(result.breakdown[0]?.amount).toBe(30);
      expect(result.breakdown[1]?.category).toBe("monitoring");
      expect(result.breakdown[1]?.amount).toBe(26);
    });

    it("ignores one-time costs in monthly total", async () => {
      const add = findTool("add_expense");
      const summary = findTool("get_monthly_summary");

      await add.execute(
        { name: "Domain", cost: 15, billing_cycle: "one-time", category: "hosting" },
        api
      );
      await add.execute(
        { name: "Server", cost: 50, billing_cycle: "monthly", category: "hosting" },
        api
      );

      const result = (await summary.execute({}, api)) as {
        total_monthly: number;
      };
      expect(result.total_monthly).toBe(50);
    });
  });

  describe("get_upcoming_renewals", () => {
    it("returns services renewing within N days", async () => {
      const add = findTool("add_expense");
      const renewals = findTool("get_upcoming_renewals");

      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

      await add.execute(
        {
          name: "Soon",
          cost: 10,
          billing_cycle: "monthly",
          category: "hosting",
          renewal_date: tomorrow,
        },
        api
      );
      await add.execute(
        {
          name: "Later",
          cost: 20,
          billing_cycle: "monthly",
          category: "hosting",
          renewal_date: nextMonth,
        },
        api
      );

      const result = (await renewals.execute({ days: 7 }, api)) as {
        renewals: ExpenseEntry[];
        count: number;
      };

      expect(result.count).toBe(1);
      expect(result.renewals[0]?.name).toBe("Soon");
    });

    it("excludes trashed expenses from renewals", async () => {
      const add = findTool("add_expense");
      const del = findTool("delete_expense");
      const renewals = findTool("get_upcoming_renewals");

      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

      const { expense } = (await add.execute(
        {
          name: "Trashed",
          cost: 10,
          billing_cycle: "monthly",
          category: "hosting",
          renewal_date: tomorrow,
        },
        api
      )) as { expense: ExpenseEntry };

      await del.execute({ expense_id: expense.id }, api);

      const result = (await renewals.execute({ days: 7 }, api)) as { count: number };
      expect(result.count).toBe(0);
    });
  });

  describe("get_expense", () => {
    it("returns full expense detail", async () => {
      const add = findTool("add_expense");
      const get = findTool("get_expense");

      const { expense } = (await add.execute(
        {
          name: "Vercel",
          cost: 20,
          billing_cycle: "monthly",
          category: "hosting",
          url: "https://vercel.com",
          tags: ["infra"],
        },
        api
      )) as { expense: ExpenseEntry };

      const result = (await get.execute({ expense_id: expense.id }, api)) as {
        success: boolean;
        expense: ExpenseEntry;
      };

      expect(result.success).toBe(true);
      expect(result.expense.name).toBe("Vercel");
      expect(result.expense.url).toBe("https://vercel.com");
      expect(result.expense.tags).toHaveLength(1);
    });

    it("returns error for nonexistent expense", async () => {
      const get = findTool("get_expense");
      const result = (await get.execute({ expense_id: "fake" }, api)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
      expect(result.error).toBe("Expense not found");
    });
  });

  describe("delete_expense (soft delete)", () => {
    it("soft-deletes an expense", async () => {
      const add = findTool("add_expense");
      const del = findTool("delete_expense");
      const list = findTool("list_services");
      const get = findTool("get_expense");

      const { expense } = (await add.execute(
        { name: "Delete me", cost: 5, billing_cycle: "monthly", category: "other" },
        api
      )) as { expense: ExpenseEntry };

      await del.execute({ expense_id: expense.id }, api);

      // Default list excludes deleted
      const active = (await list.execute({}, api)) as { count: number };
      expect(active.count).toBe(0);

      // include_deleted shows it
      const all = (await list.execute({ include_deleted: true }, api)) as {
        services: ExpenseEntry[];
        count: number;
      };
      expect(all.count).toBe(1);
      expect(all.services[0]?.deletedAt).toBeTruthy();

      // get_expense still finds it
      const detail = (await get.execute({ expense_id: expense.id }, api)) as {
        success: boolean;
        expense: ExpenseEntry;
      };
      expect(detail.success).toBe(true);
      expect(detail.expense.deletedAt).toBeTruthy();
    });
  });

  describe("restore_expense", () => {
    it("restores a soft-deleted expense", async () => {
      const add = findTool("add_expense");
      const del = findTool("delete_expense");
      const restore = findTool("restore_expense");
      const list = findTool("list_services");

      const { expense } = (await add.execute(
        { name: "Restore me", cost: 10, billing_cycle: "monthly", category: "other" },
        api
      )) as { expense: ExpenseEntry };

      await del.execute({ expense_id: expense.id }, api);
      const afterDel = (await list.execute({}, api)) as { count: number };
      expect(afterDel.count).toBe(0);

      const result = (await restore.execute({ expense_id: expense.id }, api)) as {
        success: boolean;
        expense: ExpenseEntry;
      };
      expect(result.success).toBe(true);
      expect(result.expense.deletedAt).toBeNull();

      const afterRestore = (await list.execute({}, api)) as { count: number };
      expect(afterRestore.count).toBe(1);
    });

    it("returns error for nonexistent expense", async () => {
      const restore = findTool("restore_expense");
      const result = (await restore.execute({ expense_id: "fake" }, api)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
    });
  });

  describe("list_services filters", () => {
    it("filters by category", async () => {
      const add = findTool("add_expense");
      const list = findTool("list_services");

      await add.execute(
        { name: "Vercel", cost: 20, billing_cycle: "monthly", category: "hosting" },
        api
      );
      await add.execute(
        { name: "Sentry", cost: 26, billing_cycle: "monthly", category: "monitoring" },
        api
      );

      const result = (await list.execute({ category: "hosting" }, api)) as {
        services: ExpenseEntry[];
        count: number;
      };
      expect(result.count).toBe(1);
      expect(result.services[0]?.name).toBe("Vercel");
    });

    it("filters by tags", async () => {
      const add = findTool("add_expense");
      const list = findTool("list_services");

      await add.execute(
        {
          name: "Vercel",
          cost: 20,
          billing_cycle: "monthly",
          category: "hosting",
          tags: ["infra"],
        },
        api
      );
      await add.execute(
        {
          name: "Sentry",
          cost: 26,
          billing_cycle: "monthly",
          category: "monitoring",
          tags: ["observability"],
        },
        api
      );

      const result = (await list.execute({ tags: ["infra"] }, api)) as {
        services: ExpenseEntry[];
        count: number;
      };
      expect(result.count).toBe(1);
      expect(result.services[0]?.name).toBe("Vercel");
    });
  });

  describe("add_expense with tags and url", () => {
    it("creates tags and assigns them", async () => {
      const add = findTool("add_expense");

      const result = (await add.execute(
        {
          name: "Datadog",
          cost: 50,
          billing_cycle: "monthly",
          category: "monitoring",
          tags: ["observability", "infra"],
          url: "https://datadoghq.com",
        },
        api
      )) as { success: boolean; expense: ExpenseEntry };

      expect(result.expense.tags).toHaveLength(2);
      expect(result.expense.url).toBe("https://datadoghq.com");
    });
  });

  describe("get_monthly_summary with budget", () => {
    it("includes budget status when budget is set", async () => {
      const add = findTool("add_expense");
      const setBudget = findTool("set_budget");
      const summary = findTool("get_monthly_summary");

      await add.execute(
        { name: "Vercel", cost: 150, billing_cycle: "monthly", category: "hosting" },
        api
      );
      await setBudget.execute({ total_monthly: 200 }, api);

      const result = (await summary.execute({}, api)) as {
        total_monthly: number;
        budget_limit: number | null;
        over_budget: boolean;
      };

      expect(result.total_monthly).toBe(150);
      expect(result.budget_limit).toBe(200);
      expect(result.over_budget).toBe(false);
    });

    it("excludes trashed expenses from summary", async () => {
      const add = findTool("add_expense");
      const del = findTool("delete_expense");
      const summary = findTool("get_monthly_summary");

      const { expense } = (await add.execute(
        { name: "Trashed", cost: 100, billing_cycle: "monthly", category: "hosting" },
        api
      )) as { expense: ExpenseEntry };
      await add.execute(
        { name: "Active", cost: 50, billing_cycle: "monthly", category: "hosting" },
        api
      );

      await del.execute({ expense_id: expense.id }, api);

      const result = (await summary.execute({}, api)) as {
        total_monthly: number;
        service_count: number;
      };
      expect(result.total_monthly).toBe(50);
      expect(result.service_count).toBe(1);
    });
  });

  describe("set_budget", () => {
    it("sets total monthly budget", async () => {
      const tool = findTool("set_budget");
      const result = (await tool.execute({ total_monthly: 500 }, api)) as {
        success: boolean;
        budget: Budget;
      };

      expect(result.success).toBe(true);
      expect(result.budget.totalMonthly).toBe(500);
    });

    it("sets per-category budgets", async () => {
      const tool = findTool("set_budget");
      const result = (await tool.execute(
        { total_monthly: 500, category_budgets: { hosting: 200, monitoring: 100 } },
        api
      )) as { success: boolean; budget: Budget };

      expect(result.budget.byCategory?.hosting).toBe(200);
      expect(result.budget.byCategory?.monitoring).toBe(100);
    });
  });

  describe("get_budget_status", () => {
    it("returns null when no budget set", async () => {
      const tool = findTool("get_budget_status");
      const result = (await tool.execute({}, api)) as { budget: null; message: string };
      expect(result.budget).toBeNull();
    });

    it("returns spend vs budget", async () => {
      const add = findTool("add_expense");
      const setBudget = findTool("set_budget");
      const status = findTool("get_budget_status");

      await add.execute(
        { name: "Vercel", cost: 80, billing_cycle: "monthly", category: "hosting" },
        api
      );
      await setBudget.execute({ total_monthly: 200, category_budgets: { hosting: 100 } }, api);

      const result = (await status.execute({}, api)) as {
        total: { current: number; limit: number; percentage: number };
        by_category: Array<{
          category: string;
          current: number;
          limit: number;
          percentage: number;
        }>;
      };

      expect(result.total.current).toBe(80);
      expect(result.total.limit).toBe(200);
      expect(result.total.percentage).toBe(40);
      expect(result.by_category).toHaveLength(1);
      expect(result.by_category[0]?.category).toBe("hosting");
      expect(result.by_category[0]?.current).toBe(80);
      expect(result.by_category[0]?.percentage).toBe(80);
    });
  });
});
