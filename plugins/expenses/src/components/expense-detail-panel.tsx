"use client";

import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { NativeSelect } from "@radarboard/ui/select";
import { Textarea } from "@radarboard/ui/textarea";
import { cn } from "@radarboard/utils/cn";
import { ExternalLink, Trash2, X } from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import { formatCurrency } from "../expense-operations";
import type { BillingCycle, CategoryDefinition, ExpenseEntry, ExpenseTag } from "../types";
import { TagInput } from "./tag-input";

const BILLING_CYCLES: { value: BillingCycle; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
  { value: "one-time", label: "One-time" },
];

interface ExpenseDetailPanelProps {
  expense: ExpenseEntry;
  tags: ExpenseTag[];
  categories: CategoryDefinition[];
  currency: string;
  onUpdate: (id: string, changes: Partial<ExpenseEntry>) => void;
  onTagAdd: (tagName: string) => Promise<void>;
  onTagRemove: (tagId: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function ExpenseDetailPanel({
  expense,
  tags,
  categories,
  currency,
  onUpdate,
  onTagAdd,
  onTagRemove,
  onDelete,
  onClose,
}: ExpenseDetailPanelProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(expense.name);
  const attachNameInputRef = useCallback((node: HTMLInputElement | null) => {
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, []);

  const handleNameSave = useCallback(() => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== expense.name) {
      onUpdate(expense.id, { name: trimmed });
    }
    setEditingName(false);
  }, [nameDraft, expense.id, expense.name, onUpdate]);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleNameSave();
      } else if (e.key === "Escape") {
        setNameDraft(expense.name);
        setEditingName(false);
      }
    },
    [handleNameSave, expense.name]
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="space-y-5 p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          {editingName ? (
            <Input
              ref={attachNameInputRef}
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={handleNameKeyDown}
              variant="ghost"
              size="default"
              className="flex-1 font-medium text-foreground-secondary text-sm"
            />
          ) : (
            <Button
              type="button"
              onClick={() => {
                setNameDraft(expense.name);
                setEditingName(true);
              }}
              variant="ghost"
              uppercase={false}
              className="h-auto flex-1 justify-start p-0 text-left font-medium text-foreground-secondary text-sm hover:text-foreground"
            >
              {expense.name}
            </Button>
          )}
          <Button
            type="button"
            onClick={onClose}
            variant="ghost"
            size="icon"
            uppercase={false}
            className="shrink-0 text-dim hover:text-muted-foreground"
          >
            <X className="icon-base" />
          </Button>
        </div>

        {/* Cost */}
        <div className="space-y-1">
          <span className="text-dim text-w-sm">Cost</span>
          {expense.autoDetected ? (
            <div className="font-mono text-foreground-secondary text-sm">
              {formatCurrency(expense.cost, currency)}
              <span className="ml-1.5 text-dim text-w-sm">(synced)</span>
            </div>
          ) : (
            <Input
              type="number"
              value={expense.cost}
              onChange={(e) => onUpdate(expense.id, { cost: Number(e.target.value) || 0 })}
              step="0.01"
              min="0"
              variant="ghost"
              size="default"
              className="w-full font-mono text-foreground-secondary text-sm"
            />
          )}
        </div>

        {/* Billing cycle */}
        <div className="space-y-1">
          <span className="text-dim text-w-sm">Billing Cycle</span>
          <div className="flex gap-1">
            {BILLING_CYCLES.map((c) => (
              <Button
                key={c.value}
                type="button"
                onClick={() => onUpdate(expense.id, { billingCycle: c.value })}
                variant={expense.billingCycle === c.value ? "secondary" : "ghost"}
                size="sm"
                uppercase={false}
                className={cn(expense.billingCycle !== c.value && "text-dim hover:text-dim")}
              >
                {c.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div className="space-y-1">
          <span className="text-dim text-w-sm">Category</span>
          <NativeSelect
            value={expense.category}
            onChange={(e) => onUpdate(expense.id, { category: e.target.value })}
            variant="surface"
            size="sm"
            className="bg-surface-raised text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* Renewal date */}
        <div className="space-y-1">
          <span className="text-dim text-w-sm">Renewal Date</span>
          <Input
            type="date"
            value={expense.renewalDate ?? ""}
            onChange={(e) => onUpdate(expense.id, { renewalDate: e.target.value || undefined })}
            variant="ghost"
            size="default"
            className="text-foreground-secondary text-sm"
            style={{ colorScheme: "light dark" }}
          />
        </div>

        {/* URL */}
        <div className="space-y-1">
          <span className="text-dim text-w-sm">URL</span>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={expense.url ?? ""}
              onChange={(e) => onUpdate(expense.id, { url: e.target.value || undefined })}
              placeholder="https://..."
              variant="ghost"
              size="default"
              className="flex-1 text-foreground-secondary text-sm"
            />
            {Boolean(expense.url) && (
              <a
                href={expense.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-item p-1 text-dim transition-colors hover:text-muted-foreground"
              >
                <ExternalLink className="icon-base" />
              </a>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-1">
          <span className="text-dim text-w-sm">Tags</span>
          <TagInput
            selectedTagIds={expense.tags}
            allTags={tags}
            onAdd={onTagAdd}
            onRemove={onTagRemove}
          />
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <span className="text-dim text-w-sm">Notes</span>
          <Textarea
            value={expense.notes ?? ""}
            onChange={(e) => onUpdate(expense.id, { notes: e.target.value || undefined })}
            placeholder="Add notes..."
            rows={3}
            className="resize-none bg-transparent p-2 text-foreground-secondary text-sm"
          />
        </div>

        {/* Cost breakdown (for synced expenses) */}
        {expense.costBreakdown && expense.costBreakdown.length > 0 && (
          <div className="space-y-1">
            <span className="text-dim text-w-sm">Cost Breakdown</span>
            <div className="space-y-1 rounded-item bg-surface p-2">
              {expense.costBreakdown.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-w-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-mono text-foreground-secondary">
                    {formatCurrency(item.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="space-y-1 border-border border-t pt-2">
          <div className="text-dim text-w-sm">
            Created {new Date(expense.createdAt).toLocaleDateString()}
          </div>
          <div className="text-dim text-w-sm">
            Updated {new Date(expense.updatedAt).toLocaleDateString()}
          </div>
          {Boolean(expense.integrationSource) && (
            <div className="text-dim text-w-sm">Source: {expense.integrationSource}</div>
          )}
          <div className="font-mono text-dim/40 text-w-sm">{expense.id}</div>
        </div>

        {/* Actions */}
        <div className="border-border border-t pt-2">
          <Button
            type="button"
            onClick={() => onDelete(expense.id)}
            variant="ghost"
            uppercase={false}
            className="gap-1.5 text-red-400/70 hover:bg-red-400/10 hover:text-red-400"
          >
            <Trash2 className="icon-base" />
            Move to trash
          </Button>
        </div>
      </div>
    </div>
  );
}
