"use client";

import type { PluginWidgetContribution } from "@radarboard/plugin-sdk/types";
import {
  createTemplateConfig,
  type DataSourceResolverProps,
  reportState,
  useStoredValue,
} from "@radarboard/plugin-sdk/widget-template-utils";
import { registerTemplateDataSource } from "@radarboard/widget-engine/templates";
import { useCallback, useEffect, useMemo } from "react";
import type { ExpenseEntry } from "./types";

function toMonthlyCost(cost: number, cycle: ExpenseEntry["billingCycle"]): number {
  switch (cycle) {
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

function ExpensesResolver({ onState }: DataSourceResolverProps) {
  const { data, error, isLoading, mutate } = useStoredValue<ExpenseEntry[]>(
    "expenses",
    "expenses:list",
    "plugin-expenses"
  );
  const refetch = useCallback(async () => {
    await mutate();
  }, [mutate]);
  const normalized = useMemo(() => {
    const expenses = data ?? [];
    const monthlyTotal = expenses.reduce(
      (sum, entry) => sum + toMonthlyCost(entry.cost, entry.billingCycle),
      0
    );
    const byCategory = new Map<string, number>();

    for (const expense of expenses) {
      byCategory.set(
        expense.category,
        (byCategory.get(expense.category) ?? 0) + toMonthlyCost(expense.cost, expense.billingCycle)
      );
    }

    return {
      monthlyTotal,
      servicesCount: expenses.length,
      categories: Array.from(byCategory.entries())
        .map(([category, amount]) => ({
          titleText: category,
          valueText: `$${amount.toFixed(0)}`,
          pluginUrl: `?plugin=expenses&category=${encodeURIComponent(category)}`,
        }))
        .sort((left, right) => Number(right.valueText.slice(1)) - Number(left.valueText.slice(1))),
    };
  }, [data]);

  useEffect(() => {
    reportState(onState, {
      data: normalized,
      fetchedAt: null,
      refetch,
      loading: isLoading,
      error: error?.message ?? null,
    });
  }, [normalized, refetch, isLoading, error, onState]);

  return null;
}

registerTemplateDataSource("plugin.expenses.overview", ExpensesResolver);

export const expensesWidgetContribution: PluginWidgetContribution = {
  widgetId: "overview",
  name: "Expenses Overview",
  description: "Monthly spend and top expense categories",
  defaultSlot: "slot8",
  templateConfig: createTemplateConfig(
    {
      kind: "summary_content",
      summary: [
        {
          type: "headline-stat",
          source: {
            sourceId: "plugin.expenses.overview",
            field: "monthlyTotal",
            format: "currency",
          },
          label: "monthly spend",
        },
        {
          type: "kpi-row",
          columns: 1,
          metrics: [
            {
              label: "Services",
              source: {
                sourceId: "plugin.expenses.overview",
                field: "servicesCount",
                format: "number",
              },
            },
          ],
        },
      ],
      rail: [],
      content: [
        {
          type: "row-list",
          source: { sourceId: "plugin.expenses.overview", field: "categories" },
          emptyMessage: "No expenses tracked",
          hrefSource: { sourceId: "plugin.expenses.overview", field: "pluginUrl" },
          itemTemplate: {
            title: { sourceId: "plugin.expenses.overview", field: "titleText" },
            value: { sourceId: "plugin.expenses.overview", field: "valueText" },
          },
        },
      ],
    },
    "plugin.expenses.overview"
  ),
  pollingSourceIds: ["plugin-expenses"],
  defaultPollInterval: 30_000,
};
