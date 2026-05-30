"use client";

import { ColorDot } from "@radarboard/plugin-sdk/components/sidebar/color-dot";
import { FolderItem } from "@radarboard/plugin-sdk/components/sidebar/folder-item";
import { SidebarSection } from "@radarboard/plugin-sdk/components/sidebar/section-header";
import {
  SidebarHeader,
  SidebarShell,
} from "@radarboard/plugin-sdk/components/sidebar/sidebar-shell";
import { SidebarStats } from "@radarboard/plugin-sdk/components/sidebar/sidebar-stats";
import { Button } from "@radarboard/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "../expense-operations";
import type { Budget, CategoryDefinition, ExpenseTag } from "../types";
import { BudgetEditor } from "./budget-editor";

interface ExpenseSidebarProps {
  monthlySummary: { total: number; byCategory: { category: string; amount: number }[] };
  budget: Budget | null;
  budgetStatus: {
    total: { current: number; limit: number; percentage: number } | null;
    byCategory: { category: string; current: number; limit: number; percentage: number }[];
  } | null;
  categories: CategoryDefinition[];
  categoryFilter: string | "all";
  selectedTags: string[];
  tags: ExpenseTag[];
  integrations: { id: string; name: string; connected: boolean }[];
  currency: string;
  onCategoryChange: (category: string | "all") => void;
  onTagToggle: (tagId: string) => void;
  onBudgetSave: (budget: Budget) => void;
  onSync: (integration: string) => void;
}

export function ExpenseSidebar({
  monthlySummary,
  budget,
  budgetStatus,
  categories,
  categoryFilter,
  selectedTags,
  tags,
  integrations,
  currency,
  onCategoryChange,
  onTagToggle,
  onBudgetSave,
  onSync,
}: ExpenseSidebarProps) {
  const [editingBudget, setEditingBudget] = useState(false);

  const budgetPct = budgetStatus?.total?.percentage ?? 0;
  const getBudgetColor = () => {
    if (budgetPct > 100) return "text-red-400";
    if (budgetPct > 80) return "text-amber-400";
    return "text-emerald-400";
  };
  const budgetColor = getBudgetColor();
  const getBudgetBarColor = () => {
    if (budgetPct > 100) return "bg-red-400";
    if (budgetPct > 80) return "bg-amber-400";
    return "bg-emerald-400";
  };
  const budgetBarColor = getBudgetBarColor();

  const activeTags = tags.filter((t) => selectedTags.includes(t.id));

  return (
    <SidebarShell
      header={
        <SidebarHeader
          label="Expenses"
          stats={
            <>
              <SidebarStats
                value={formatCurrency(monthlySummary.total, currency)}
                label="monthly spend"
              />
              {budgetStatus?.total != null && (
                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-w-sm">
                    <span className={budgetColor}>
                      {Math.round(budgetStatus.total.percentage)}% of budget
                    </span>
                    <span className="text-dim">
                      {formatCurrency(budgetStatus.total.limit, currency)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary">
                    <div
                      className={cn("h-full rounded-full transition-all", budgetBarColor)}
                      style={{ width: `${Math.min(budgetStatus.total.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          }
        />
      }
    >
      {/* Category filter — uses FolderItem for consistency */}
      <SidebarSection title="Category">
        <FolderItem
          icon={<ColorDot color="#e5e5e5" />}
          label="All"
          count={0}
          selected={categoryFilter === "all"}
          onClick={() => onCategoryChange("all")}
        />
        {categories.map((c) => (
          <FolderItem
            key={c.id}
            icon={<ColorDot color={c.color} />}
            label={c.label}
            count={0}
            selected={categoryFilter === c.id}
            onClick={() => onCategoryChange(c.id)}
          />
        ))}
      </SidebarSection>

      {/* Tags filter */}
      {tags.length > 0 && (
        <SidebarSection title="Tags">
          <div className="flex flex-wrap gap-1 px-3">
            {tags.map((tag) => (
              <Button
                key={tag.id}
                type="button"
                onClick={() => onTagToggle(tag.id)}
                variant={activeTags.some((t) => t.id === tag.id) ? "secondary" : "ghost"}
                size="sm"
                uppercase={false}
                className={cn(
                  activeTags.some((t) => t.id === tag.id)
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-surface-raised text-dim hover:text-dim"
                )}
              >
                {tag.name}
              </Button>
            ))}
          </div>
        </SidebarSection>
      )}

      {/* Budget config */}
      <SidebarSection title="Budget">
        <div className="px-3">
          {editingBudget ? (
            <BudgetEditor
              budget={budget}
              categories={categories.map((c) => c.id)}
              currency={currency}
              onSave={(b) => {
                onBudgetSave(b);
                setEditingBudget(false);
              }}
              onCancel={() => setEditingBudget(false)}
            />
          ) : (
            <Button
              type="button"
              onClick={() => setEditingBudget(true)}
              variant="ghost-link"
              uppercase={false}
              className="text-dim text-w-sm hover:text-foreground-secondary"
            >
              {budget?.totalMonthly ? "Edit Budget" : "Set Budget"}
            </Button>
          )}
        </div>
      </SidebarSection>

      {/* Integrations */}
      {integrations.length > 0 && (
        <SidebarSection title="Integrations">
          <div className="space-y-2 px-3">
            {integrations.map((integration) => (
              <div key={integration.id} className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    integration.connected ? "bg-emerald-400" : "bg-dim"
                  )}
                />
                <span className="flex-1 text-muted-foreground text-w-sm">{integration.name}</span>
                {Boolean(integration.connected) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        onClick={() => onSync(integration.id)}
                        variant="ghost"
                        size="icon"
                        uppercase={false}
                        className="text-dim hover:text-muted-foreground"
                        aria-label={`Sync billing for ${integration.name}`}
                      >
                        <RefreshCw className="icon-base" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Sync billing</TooltipContent>
                  </Tooltip>
                )}
              </div>
            ))}
          </div>
        </SidebarSection>
      )}
    </SidebarShell>
  );
}
