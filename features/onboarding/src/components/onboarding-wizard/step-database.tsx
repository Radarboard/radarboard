"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { CheckCircle, Database } from "lucide-react";
import { useState } from "react";
import { OnboardingGrid } from "./onboarding-grid";
import type { OnboardingState } from "./types";

const GRID_CLASS =
  "grid grid-cols-1 gap-3 @[500px]:grid-cols-2 @[750px]:grid-cols-4 @[1000px]:grid-cols-5";

interface StepDatabaseProps {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface ProviderOption {
  id: string;
  name: string;
  description: string;
  badge: string | null;
  category: string;
}

const PROVIDER_CATEGORIES = [
  {
    id: "local",
    label: "Local",
    providers: [
      {
        id: "sqlite",
        name: "SQLite",
        description: "Local file-based storage. No setup required.",
        badge: "Recommended",
        category: "local",
      },
    ],
  },
  {
    id: "cloud",
    label: "Cloud",
    providers: [
      {
        id: "supabase",
        name: "Supabase",
        description: "Postgres-based backend with real-time capabilities.",
        badge: null,
        category: "cloud",
      },
      {
        id: "turso",
        name: "Turso",
        description: "Distributed SQLite at the edge.",
        badge: null,
        category: "cloud",
      },
      {
        id: "planetscale",
        name: "PlanetScale",
        description: "MySQL-compatible serverless database.",
        badge: null,
        category: "cloud",
      },
    ],
  },
] satisfies { id: string; label: string; providers: ProviderOption[] }[];

export function StepDatabase({ state, onChange, onNext, onBack }: StepDatabaseProps) {
  const [selected, setSelected] = useState(state.databaseProvider || "sqlite");

  const handleSelect = (id: string) => {
    setSelected(id);
    onChange({ databaseProvider: id });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="mb-1 font-mono text-dim text-w-sm uppercase tracking-widest">
        Database Setup
      </div>
      <p className="mb-5 font-mono text-dim text-w-sm">
        Choose where to store your dashboard data. SQLite works out of the box for local use.
      </p>

      <div className="@container min-h-0 flex-1 overflow-y-auto pr-1">
        {state.demoMode ? (
          <div className="mb-4 rounded-item border border-accent/20 bg-accent/5 px-4 py-2.5 font-mono text-accent text-w-sm">
            Demo mode is enabled — SQLite is auto-selected for a quick start. You can change this
            later in Settings.
          </div>
        ) : null}

        <fieldset className="space-y-5">
          <legend className="sr-only">Database provider</legend>
          {PROVIDER_CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <div className="mb-2 font-mono text-dim/60 text-w-sm uppercase tracking-widest">
                {cat.label}
              </div>
              <OnboardingGrid className={GRID_CLASS}>
                {cat.providers.map((p) => {
                  const isSelected = selected === p.id;
                  const inputId = `db-provider-${p.id}`;
                  return (
                    <label
                      key={p.id}
                      htmlFor={inputId}
                      className={cn(
                        "cursor-pointer rounded-item border px-4 py-3 text-left transition-colors",
                        isSelected
                          ? "border-accent/30 bg-accent/10"
                          : "border-border bg-surface hover:bg-muted"
                      )}
                    >
                      <input
                        id={inputId}
                        type="radio"
                        name="database-provider"
                        value={p.id}
                        checked={isSelected}
                        onChange={() => handleSelect(p.id)}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 shrink-0 text-foreground-secondary" />
                        <span className="font-mono text-foreground text-w-sm uppercase tracking-widest">
                          {p.name}
                        </span>
                        {isSelected ? (
                          <CheckCircle className="ml-auto h-4 w-4 shrink-0 text-accent" />
                        ) : null}
                      </div>
                      <div className="mt-1 font-mono text-dim text-w-sm">{p.description}</div>
                      {p.badge ? (
                        <span className="mt-2 inline-block rounded-full bg-accent/20 px-2 py-0.5 font-mono text-accent text-w-xs uppercase tracking-widest">
                          {p.badge}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </OnboardingGrid>
            </div>
          ))}
        </fieldset>
      </div>

      <div className="flex shrink-0 items-center justify-between border-border/40 border-t py-4">
        <Button variant="ghost" onClick={onBack} className="font-mono uppercase tracking-widest">
          Back
        </Button>
        <Button onClick={onNext} className="font-mono uppercase tracking-widest">
          Continue
        </Button>
      </div>
    </div>
  );
}
