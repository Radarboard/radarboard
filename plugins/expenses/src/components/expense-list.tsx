"use client";

import { PluginListHeader } from "@radarboard/plugin-sdk/components/list-header";
import { PluginListRow } from "@radarboard/plugin-sdk/components/list-row";
import { PluginListTabs } from "@radarboard/plugin-sdk/components/list-tabs";
import { NativeSelect } from "@radarboard/ui/select";
import { DollarSign, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { calculateMonthlyEquivalent, formatCurrency } from "../expense-operations";
import type { ExpenseEntry, ExpenseTag } from "../types";

type SortBy = "cost-desc" | "cost-asc" | "name-asc" | "renewal" | "recent";

interface ExpenseListProps {
  expenses: ExpenseEntry[];
  selectedId: string | null;
  currency: string;
  alertDaysAhead: number;
  tags: ExpenseTag[];
  trashMode: boolean;
  onSelect: (expense: ExpenseEntry) => void;
  onAdd: () => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onTrashToggle: () => void;
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "cost-desc", label: "Cost \u2193" },
  { value: "cost-asc", label: "Cost \u2191" },
  { value: "name-asc", label: "Name" },
  { value: "renewal", label: "Renewal" },
  { value: "recent", label: "Recent" },
];

export function ExpenseList({
  expenses,
  selectedId,
  currency,
  alertDaysAhead,
  tags,
  trashMode,
  onSelect,
  onAdd,
  onRestore: _onRestore,
  onPermanentDelete: _onPermanentDelete,
  onTrashToggle,
}: ExpenseListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("cost-desc");

  const today = new Date().toLocaleDateString("en-CA");
  const renewalCutoff = new Date(
    Date.now() + alertDaysAhead * 24 * 60 * 60 * 1000
  ).toLocaleDateString("en-CA");

  const filtered = useMemo(() => {
    let result = expenses;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => {
        if (e.name.toLowerCase().includes(q)) return true;
        if (e.notes?.toLowerCase().includes(q)) return true;
        const tagNames = e.tags
          .map((tid) => tags.find((t) => t.id === tid)?.name ?? "")
          .join(" ")
          .toLowerCase();
        return tagNames.includes(q);
      });
    }

    const sorted = [...result];
    switch (sortBy) {
      case "cost-desc":
        sorted.sort(
          (a, b) =>
            calculateMonthlyEquivalent(b.cost, b.billingCycle) -
            calculateMonthlyEquivalent(a.cost, a.billingCycle)
        );
        break;
      case "cost-asc":
        sorted.sort(
          (a, b) =>
            calculateMonthlyEquivalent(a.cost, a.billingCycle) -
            calculateMonthlyEquivalent(b.cost, b.billingCycle)
        );
        break;
      case "name-asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "renewal":
        sorted.sort((a, b) => (a.renewalDate ?? "9999").localeCompare(b.renewalDate ?? "9999"));
        break;
      case "recent":
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      default:
        break;
    }
    return sorted;
  }, [expenses, searchQuery, sortBy, tags]);

  return (
    <div className="flex h-full flex-col border-border border-r">
      <PluginListHeader
        label="Expenses"
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: "Search expenses...",
        }}
        addButton={trashMode ? undefined : { label: "Add Expense", onClick: onAdd }}
        count={`${filtered.length} expense${filtered.length !== 1 ? "s" : ""}`}
        extra={
          <NativeSelect
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            variant="ghost"
            size="sm"
            className="w-auto text-dim text-w-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        }
      />

      <PluginListTabs
        tabs={[
          { value: "active", label: "Active" },
          { value: "trash", label: "Trash", activeClassName: "bg-red-500/20 text-red-400" },
        ]}
        value={trashMode ? "trash" : "active"}
        onChange={(tab) => {
          if ((tab === "trash") !== trashMode) onTrashToggle();
        }}
      />

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-dim text-sm">
            {trashMode ? "Trash is empty" : "No expenses tracked yet."}
          </div>
        ) : (
          <div className="divide-y divide-[#1a1a1a]">
            {filtered.map((expense) => {
              const isRenewingSoon =
                expense.renewalDate &&
                expense.renewalDate >= (today ?? "") &&
                expense.renewalDate <= (renewalCutoff ?? "");

              return (
                <PluginListRow
                  key={expense.id}
                  indicator={<DollarSign className="icon-sm text-dim" />}
                  title={
                    <>
                      {expense.name}
                      {Boolean(expense.autoDetected) && (
                        <RefreshCw className="ml-1 h-2.5 w-2.5 shrink-0 text-dim" />
                      )}
                    </>
                  }
                  subtitle={
                    <span className="flex items-center gap-1">
                      <span className="capitalize">{expense.category}</span>
                      <span className="text-dim/40">\u00B7</span>
                      <span>{expense.billingCycle}</span>
                      {Boolean(isRenewingSoon) && (
                        <>
                          <span className="text-dim/40">\u00B7</span>
                          <span className="text-amber-400">{expense.renewalDate}</span>
                        </>
                      )}
                    </span>
                  }
                  meta={formatCurrency(
                    calculateMonthlyEquivalent(expense.cost, expense.billingCycle),
                    currency
                  )}
                  selected={selectedId === expense.id}
                  onClick={() => onSelect(expense)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Trash banner */}
      {Boolean(trashMode) && (
        <div className="border-border border-t bg-red-500/5 px-3 py-2 text-red-400/70 text-w-sm">
          Permanently deleted after 30 days
        </div>
      )}
    </div>
  );
}
