"use client";

import {
  FormField,
  FormInput,
  FormSelect,
  PluginFormDialog,
} from "@radarboard/plugin-sdk/components/form-dialog";
import { PluginEmptyState } from "@radarboard/plugin-sdk/components/plugin-empty";
import { ThreePaneWorkspace } from "@radarboard/plugin-sdk/components/three-pane-workspace";
import type { PluginRenderProps } from "@radarboard/plugin-sdk/types";
import { usePluginSearchParam } from "@radarboard/plugin-sdk/use-plugin-search-param";
import { SkeletonShimmer } from "@radarboard/ui/skeleton-shimmer";
import { DollarSign } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { BillingCycle, ExpenseEntry } from "../types";
import { useExpenses } from "../use-expenses";
import { ExpenseDetailPanel } from "./expense-detail-panel";
import { ExpenseList } from "./expense-list";
import { ExpenseSidebar } from "./expense-sidebar";

export function ExpensesOverlay({ api }: PluginRenderProps) {
  const {
    expenses,
    activeExpenses,
    settings,
    tags,
    categories,
    budget,
    budgetStatus,
    loaded,
    monthlySummary,
    addExpense,
    updateExpense,
    softDeleteExpense,
    permanentDeleteExpense,
    restoreExpense,
    getOrCreateTag,
    setBudget,
    syncBilling,
  } = useExpenses(api);

  const [overlayUi, setOverlayUi] = useState({
    categoryFilter: "all" as string | "all",
    newBilling: "monthly" as BillingCycle,
    newCategory: "other",
    newCost: "",
    newName: "",
    selectedExpense: null as ExpenseEntry | null,
    selectedTags: [] as string[],
    showCreateModal: false,
    trashMode: false,
  });
  const {
    categoryFilter,
    newBilling,
    newCategory,
    newCost,
    newName,
    selectedExpense,
    selectedTags,
    showCreateModal,
    trashMode,
  } = overlayUi;

  const urlCategory = usePluginSearchParam(api, "category", "expenses");
  const effectiveCategoryFilter = urlCategory ?? categoryFilter;
  const effectiveSelectedTags = urlCategory ? [] : selectedTags;
  const effectiveTrashMode = urlCategory ? false : trashMode;

  // Integration connection status
  const [integrations] = useState([
    { id: "vercel", name: "Vercel", connected: false },
    { id: "github", name: "GitHub", connected: false },
  ]);

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    if (effectiveTrashMode) {
      return expenses.filter((e) => e.deletedAt !== null);
    }

    let result = activeExpenses;
    if (effectiveCategoryFilter !== "all") {
      result = result.filter((e) => e.category === effectiveCategoryFilter);
    }
    if (effectiveSelectedTags.length > 0) {
      result = result.filter((e) => effectiveSelectedTags.every((tid) => e.tags.includes(tid)));
    }
    return result;
  }, [
    activeExpenses,
    effectiveCategoryFilter,
    effectiveSelectedTags,
    effectiveTrashMode,
    expenses,
  ]);

  // Visible tags (on non-deleted expenses)
  const visibleTags = useMemo(() => {
    const tagIds = new Set<string>();
    for (const e of activeExpenses) {
      for (const tid of e.tags) tagIds.add(tid);
    }
    return tags.filter((t) => tagIds.has(t.id));
  }, [activeExpenses, tags]);

  // Keep selected expense in sync
  const resolvedSelected = useMemo(() => {
    if (!selectedExpense) return null;
    return expenses.find((e) => e.id === selectedExpense.id) ?? null;
  }, [expenses, selectedExpense]);

  const resetCreateForm = useCallback(() => {
    setOverlayUi((current) => ({
      ...current,
      newName: "",
      newCost: "",
      newBilling: "monthly",
      newCategory: "other",
    }));
  }, []);

  const handleCreateSubmit = useCallback(async () => {
    const name = newName.trim() || "Untitled Expense";
    const cost = Number.parseFloat(newCost) || 0;
    const entry = await addExpense({ name, cost, billingCycle: newBilling, category: newCategory });
    setOverlayUi((current) => ({
      ...current,
      selectedExpense: entry as ExpenseEntry,
      showCreateModal: false,
    }));
    resetCreateForm();
  }, [newName, newCost, newBilling, newCategory, addExpense, resetCreateForm]);

  const handleTagAdd = useCallback(
    async (tagName: string) => {
      if (!resolvedSelected) return;
      const tag = await getOrCreateTag(tagName);
      if (!resolvedSelected.tags.includes(tag.id)) {
        await updateExpense(resolvedSelected.id, {
          tags: [...resolvedSelected.tags, tag.id],
        });
      }
    },
    [resolvedSelected, getOrCreateTag, updateExpense]
  );

  const handleTagRemove = useCallback(
    (tagId: string) => {
      if (!resolvedSelected) return;
      updateExpense(resolvedSelected.id, {
        tags: resolvedSelected.tags.filter((t) => t !== tagId),
      });
    },
    [resolvedSelected, updateExpense]
  );

  const handleTagToggle = useCallback((tagId: string) => {
    setOverlayUi((current) => ({
      ...current,
      selectedTags: current.selectedTags.includes(tagId)
        ? current.selectedTags.filter((tag) => tag !== tagId)
        : [...current.selectedTags, tagId],
    }));
  }, []);

  const handleSync = useCallback(
    async (integration: string) => {
      await syncBilling(integration);
      api.notify(`Synced ${integration} billing`, "success");
    },
    [syncBilling, api]
  );

  return (
    <SkeletonShimmer loading={!loaded}>
      <ThreePaneWorkspace
        initialSidebarWidth={280}
        initialListWidth={360}
        minSidebarWidth={220}
        minListWidth={280}
        minDetailWidth={420}
        sidebarTabLabel="Summary"
        listTabLabel="Expenses"
        detailKey={resolvedSelected?.id ?? null}
        sidebar={
          <ExpenseSidebar
            monthlySummary={monthlySummary}
            budget={budget}
            budgetStatus={budgetStatus}
            categories={categories}
            categoryFilter={effectiveCategoryFilter}
            selectedTags={effectiveSelectedTags}
            tags={visibleTags}
            integrations={integrations}
            currency={settings.currency}
            onCategoryChange={(value) =>
              setOverlayUi((current) => ({ ...current, categoryFilter: value }))
            }
            onTagToggle={handleTagToggle}
            onBudgetSave={setBudget}
            onSync={handleSync}
          />
        }
        list={
          <ExpenseList
            expenses={filteredExpenses}
            selectedId={resolvedSelected?.id ?? null}
            currency={settings.currency}
            alertDaysAhead={settings.alertDaysAhead}
            tags={tags}
            trashMode={effectiveTrashMode}
            onSelect={(expense) =>
              setOverlayUi((current) => ({ ...current, selectedExpense: expense }))
            }
            onAdd={() => setOverlayUi((current) => ({ ...current, showCreateModal: true }))}
            onRestore={restoreExpense}
            onPermanentDelete={permanentDeleteExpense}
            onTrashToggle={() =>
              setOverlayUi((current) => ({ ...current, trashMode: !current.trashMode }))
            }
          />
        }
        detail={
          resolvedSelected && !effectiveTrashMode ? (
            <ExpenseDetailPanel
              expense={resolvedSelected}
              tags={tags}
              categories={categories}
              currency={settings.currency}
              onUpdate={updateExpense}
              onTagAdd={handleTagAdd}
              onTagRemove={handleTagRemove}
              onDelete={softDeleteExpense}
              onClose={() => setOverlayUi((current) => ({ ...current, selectedExpense: null }))}
            />
          ) : (
            <PluginEmptyState
              icon={<DollarSign className="icon-lg" />}
              title={
                effectiveTrashMode
                  ? "Select a trashed expense"
                  : "Select an expense to view details"
              }
            />
          )
        }
      />

      {/* ---------- Create Expense Modal ---------- */}
      <PluginFormDialog
        open={showCreateModal}
        onClose={() => {
          setOverlayUi((current) => ({ ...current, showCreateModal: false }));
          resetCreateForm();
        }}
        title="New Expense"
        onSubmit={handleCreateSubmit}
        submitLabel="Add Expense"
        submitDisabled={!newName.trim()}
      >
        <FormField label="Name">
          <FormInput
            placeholder="e.g. Vercel Pro"
            ref={(node) => node?.focus()}
            value={newName}
            onChange={(e) => setOverlayUi((current) => ({ ...current, newName: e.target.value }))}
          />
        </FormField>

        <FormField label={`Cost (${settings.currency})`}>
          <FormInput
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={newCost}
            onChange={(e) => setOverlayUi((current) => ({ ...current, newCost: e.target.value }))}
          />
        </FormField>

        <FormField label="Billing Cycle">
          <FormSelect
            value={newBilling}
            onChange={(e) =>
              setOverlayUi((current) => ({
                ...current,
                newBilling: e.target.value as BillingCycle,
              }))
            }
          >
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
            <option value="one-time">One-time</option>
          </FormSelect>
        </FormField>

        <FormField label="Category">
          <FormSelect
            value={newCategory}
            onChange={(e) =>
              setOverlayUi((current) => ({ ...current, newCategory: e.target.value }))
            }
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </FormSelect>
        </FormField>
      </PluginFormDialog>
    </SkeletonShimmer>
  );
}
