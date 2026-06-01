"use client";

import { getAllPlugins } from "@radarboard/plugin-sdk/registry";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { CheckCircle } from "lucide-react";
import { useMemo } from "react";
import { OnboardingGrid } from "./onboarding-grid";
import type { OnboardingState } from "./types";

const GRID_CLASS =
  "grid grid-cols-1 gap-3 @[500px]:grid-cols-2 @[750px]:grid-cols-4 @[1000px]:grid-cols-5";

interface StepPluginsProps {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
}

/** Essential plugins are always enabled and cannot be deselected during onboarding. */
export const ESSENTIAL_PLUGIN_IDS = ["backup", "embeddings"];

const CATEGORY_ORDER = ["productivity", "monitoring", "data"];
const CATEGORY_LABELS: Record<string, string> = {
  productivity: "Productivity",
  monitoring: "Monitoring",
  data: "Data",
};

export function StepPlugins({ state, onChange, onNext, onBack }: StepPluginsProps) {
  const plugins = useMemo(() => getAllPlugins(), []);
  const essentialIds = useMemo(() => new Set(ESSENTIAL_PLUGIN_IDS), []);
  const optionalPlugins = useMemo(
    () => plugins.filter((plugin) => !essentialIds.has(plugin.id)),
    [essentialIds, plugins]
  );

  const groupedPlugins = useMemo(() => {
    const groups = new Map<string, typeof plugins>();
    for (const plugin of plugins) {
      const cat = plugin.category ?? "other";
      const list = groups.get(cat) ?? [];
      list.push(plugin);
      groups.set(cat, list);
    }
    const ordered = [
      ...CATEGORY_ORDER,
      ...Array.from(groups.keys()).filter((k) => !CATEGORY_ORDER.includes(k)),
    ];
    return ordered
      .map((cat) => ({
        id: cat,
        label: CATEGORY_LABELS[cat] ?? cat,
        plugins: groups.get(cat) ?? [],
      }))
      .filter((g) => g.plugins.length > 0);
  }, [plugins]);

  const enabled = new Set(state.enabledPlugins);

  const togglePlugin = (id: string) => {
    const next = new Set(enabled);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange({ enabledPlugins: Array.from(next) });
  };

  const allOptionalIds = useMemo(() => optionalPlugins.map((p) => p.id), [optionalPlugins]);
  const selectedCount = plugins.filter(
    (plugin) => essentialIds.has(plugin.id) || enabled.has(plugin.id)
  ).length;
  const allSelected = allOptionalIds.every((id) => enabled.has(id));

  const toggleAll = () => {
    onChange({ enabledPlugins: allSelected ? [] : allOptionalIds });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-dim text-w-sm uppercase tracking-widest">Plugins</span>
        <div className="flex items-center gap-3">
          {selectedCount > 0 ? (
            <span className="font-mono text-accent text-w-sm">{selectedCount} enabled</span>
          ) : null}
          <button
            type="button"
            onClick={toggleAll}
            className="font-mono text-accent text-w-sm underline underline-offset-2 transition-interactive hover:text-foreground"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        </div>
      </div>
      <p className="mb-5 font-mono text-dim text-w-sm">
        Choose which plugins to enable. Essential plugins (Backup, Embeddings) are always active.
      </p>

      <div className="@container min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 scrollbar-thin">
        {groupedPlugins.map((group) => (
          <fieldset key={group.id}>
            <legend className="mb-2 font-mono text-dim/60 text-w-sm uppercase tracking-widest">
              {group.label}
            </legend>
            <OnboardingGrid className={GRID_CLASS}>
              {group.plugins.map((plugin) => {
                const isEssential = essentialIds.has(plugin.id);
                const isSelected = isEssential || enabled.has(plugin.id);
                const inputId = `plugin-${plugin.id}`;
                const Icon = plugin.icon;
                return (
                  <label
                    key={plugin.id}
                    htmlFor={inputId}
                    className={cn(
                      "flex items-start gap-3 rounded-item border px-3 py-2.5 text-left transition-interactive",
                      isEssential ? "cursor-default" : "cursor-pointer",
                      isSelected
                        ? "border-accent/30 bg-accent/10"
                        : "border-border bg-surface hover:bg-muted"
                    )}
                    aria-disabled={isEssential}
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePlugin(plugin.id)}
                      disabled={isEssential}
                      className="sr-only"
                    />
                    <Icon className="mt-0.5 icon-base shrink-0 text-foreground-secondary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground text-w-base">
                          {plugin.name}
                        </span>
                        {isSelected ? (
                          <CheckCircle className="ml-auto icon-sm shrink-0 text-accent" />
                        ) : null}
                      </div>
                      <div className="mt-1 text-foreground-secondary text-w-sm leading-snug">
                        {plugin.description}
                      </div>
                      {isEssential ? (
                        <div className="mt-2 font-mono text-accent text-w-xs uppercase tracking-widest">
                          Always active
                        </div>
                      ) : null}
                    </div>
                  </label>
                );
              })}
            </OnboardingGrid>
          </fieldset>
        ))}
      </div>

      <div className="flex shrink-0 items-center justify-between border-border/40 border-t py-4">
        <Button variant="ghost" onClick={onBack} className="font-mono uppercase tracking-widest">
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={onNext}
            className="font-mono text-dim uppercase tracking-widest"
          >
            Skip
          </Button>
          <Button onClick={onNext} className="font-mono uppercase tracking-widest">
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
