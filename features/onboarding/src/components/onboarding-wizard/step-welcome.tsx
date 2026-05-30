"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import { FlaskConical, RotateCcw, Rocket, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import type { OnboardingState } from "./types";

interface StepWelcomeProps {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
  /** True when the app already has layouts, widget configs, or a user profile from a previous session. */
  hasExistingData?: boolean;
  /** Jump directly to the Complete step, bypassing intermediate steps. */
  onSkipToComplete?: () => void;
}

export function StepWelcome({ state, onChange, onNext, hasExistingData = false, onSkipToComplete }: StepWelcomeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreState, setRestoreState] = useState<"idle" | "loading" | "error">("idle");
  const [restoreError, setRestoreError] = useState<string | null>(null);

  async function handleRestoreFile(file: File) {
    setRestoreState("loading");
    setRestoreError(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text) as unknown;

      if (!json || typeof json !== "object" || (json as Record<string, unknown>).version !== "1") {
        throw new Error("Invalid backup file. Make sure you're uploading a Radarboard config backup.");
      }

      const response = await fetch(API_ROUTES.configImport, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? `Import failed (${response.status})`);
      }

      onChange({ restoredFromBackup: true, demoMode: false });
      onNext();
    } catch (err) {
      setRestoreState("error");
      setRestoreError(err instanceof Error ? err.message : "Failed to restore backup.");
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 text-center sm:px-6 sm:py-8">
      <h2 className="font-bold font-mono text-foreground text-w-xl uppercase tracking-widest">
        Welcome to Radarboard
      </h2>
      <p className="mt-3 mb-6 max-w-md font-mono text-dim text-w-base">
        Your dashboard for connected services, projects, audiences, revenue, and more. Let&apos;s
        get you set up.
      </p>

      <div className="mt-10 flex w-full max-w-md flex-col gap-3">
        {hasExistingData && (
          <button
            type="button"
            onClick={() => {
              onChange({ keepExisting: true, demoMode: false });
              onSkipToComplete?.();
            }}
            className="flex items-center gap-4 rounded-item border border-accent/30 bg-accent/10 px-5 py-4 text-left transition-colors hover:bg-accent/20"
          >
            <ShieldCheck className="h-6 w-6 shrink-0 text-accent" />
            <div>
              <div className="font-mono text-foreground text-w-base uppercase tracking-widest">
                Keep existing settings
              </div>
              <div className="mt-0.5 font-mono text-dim text-w-sm">
                We found data from a previous session. Keep your layouts, plugins, and preferences as
                they are.
              </div>
            </div>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            onChange({ demoMode: true, keepExisting: false });
            onSkipToComplete?.();
          }}
          className={`flex items-center gap-4 rounded-item border px-5 py-4 text-left transition-colors ${
            state.demoMode
              ? "border-accent/30 bg-accent/10"
              : "border-border bg-surface hover:bg-muted"
          }`}
        >
          <FlaskConical className="h-6 w-6 shrink-0 text-accent" />
          <div>
            <div className="font-mono text-foreground text-w-base uppercase tracking-widest">
              Start with demo data
            </div>
            <div className="mt-0.5 font-mono text-dim text-w-sm">
              See the dashboard in action with realistic sample data. Connect real services later.
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            onChange({ demoMode: false, keepExisting: false });
            onNext();
          }}
          className={`flex items-center gap-4 rounded-item border px-5 py-4 text-left transition-colors ${
            !state.demoMode && !state.restoredFromBackup
              ? "border-accent/30 bg-accent/10"
              : "border-border bg-surface hover:bg-muted"
          }`}
        >
          <Rocket className="h-6 w-6 shrink-0 text-foreground-secondary" />
          <div>
            <div className="font-mono text-foreground text-w-base uppercase tracking-widest">
              Start fresh
            </div>
            <div className="mt-0.5 font-mono text-dim text-w-sm">
              Set up your database and connect your services right away.
            </div>
          </div>
        </button>

        <button
          type="button"
          disabled={restoreState === "loading"}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-4 rounded-item border border-border bg-surface px-5 py-4 text-left transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-60"
        >
          <RotateCcw className="h-6 w-6 shrink-0 text-foreground-secondary" />
          <div>
            <div className="font-mono text-foreground text-w-base uppercase tracking-widest">
              {restoreState === "loading" ? "Restoring…" : "Restore from backup"}
            </div>
            <div className="mt-0.5 font-mono text-dim text-w-sm">
              Upload a config backup to restore your layouts, preferences, and plugin settings.
            </div>
          </div>
        </button>

        {restoreError && (
          <p className="font-mono text-destructive text-w-sm">{restoreError}</p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleRestoreFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
