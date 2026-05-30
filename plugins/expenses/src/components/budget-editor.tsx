"use client";

import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { useState } from "react";
import type { Budget } from "../types";

interface BudgetEditorProps {
  budget: Budget | null;
  categories: string[];
  currency: string;
  onSave: (budget: Budget) => void;
  onCancel: () => void;
}

export function BudgetEditor({
  budget,
  categories,
  currency,
  onSave,
  onCancel,
}: BudgetEditorProps) {
  const [totalMonthly, setTotalMonthly] = useState(budget?.totalMonthly?.toString() ?? "");
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(budget?.byCategory ?? {}).map(([k, v]) => [k, v?.toString() ?? ""])
    )
  );
  const [showCategories, setShowCategories] = useState(
    Object.keys(budget?.byCategory ?? {}).length > 0
  );

  const handleSave = () => {
    const result: Budget = {};
    const total = Number.parseFloat(totalMonthly);
    if (total > 0) result.totalMonthly = total;

    if (showCategories) {
      const byCat: Record<string, number> = {};
      for (const [cat, val] of Object.entries(categoryBudgets)) {
        const num = Number.parseFloat(val);
        if (num > 0) byCat[cat] = num;
      }
      if (Object.keys(byCat).length > 0) result.byCategory = byCat;
    }
    onSave(result);
  };

  return (
    <div className="space-y-3">
      <div className="text-dim text-w-sm">Budget ({currency})</div>

      <div className="space-y-1">
        <span className="text-dim text-w-sm">Total monthly</span>
        <Input
          type="number"
          value={totalMonthly}
          onChange={(e) => setTotalMonthly(e.target.value)}
          placeholder="No limit"
          min="0"
          step="1"
          size="sm"
          className="w-full bg-surface-raised font-mono text-sm"
        />
      </div>

      <Button
        type="button"
        onClick={() => setShowCategories(!showCategories)}
        variant="ghost-link"
        uppercase={false}
        className="text-dim"
      >
        {showCategories ? "Hide per-category" : "Add per-category limits"}
      </Button>

      {Boolean(showCategories) && (
        <div className="space-y-1.5">
          {categories.map((cat) => (
            <div key={cat} className="flex items-center gap-2">
              <span className="w-20 text-dim text-w-sm capitalize">{cat}</span>
              <Input
                type="number"
                value={categoryBudgets[cat] ?? ""}
                onChange={(e) => setCategoryBudgets((prev) => ({ ...prev, [cat]: e.target.value }))}
                placeholder="\u2014"
                min="0"
                step="1"
                size="sm"
                className="flex-1 bg-surface-raised font-mono text-w-sm"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="button" onClick={handleSave} variant="secondary" uppercase={false}>
          Save
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          variant="ghost"
          uppercase={false}
          className="text-dim hover:text-muted-foreground"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
