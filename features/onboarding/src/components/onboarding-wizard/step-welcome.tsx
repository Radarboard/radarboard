"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import { AlertTriangle, FlaskConical, RotateCcw, Rocket, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import type { OnboardingState } from "./types";

const ERASE_CONFIRM_WORD = "ERASE";

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
  const [eraseState, setEraseState] = useState<"idle" | "confirming" | "erasing">("idle");
  const [eraseConfirmText, setEraseConfirmText] = useState("");
  const [eraseError, setEraseError] = useState<string | null>(null);

  const canErase =
    eraseConfirmText.trim().toUpperCase() === ERASE_CONFIRM_WORD && eraseState !== "erasing";

  async function handleEraseAll() {
    if (!canErase) return;
    setEraseState("erasing");
    setEraseError(null);
    try {
      const response = await fetch(API_ROUTES.factoryReset, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: ERASE_CONFIRM_WORD }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Erase failed (${response.status})`);
      }
      // Hard reload so the app re-initializes into a clean first-run onboarding.
      window.location.assign("/");
    } catch (err) {
      setEraseError(err instanceof Error ? err.message : "Failed to erase data.");
      setEraseState("confirming");
    }
  }

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
              {hasExistingData
                ? "Reset your dashboard and clear demo data, but keep your connected services and credentials."
                : "Set up your database and connect your services right away."}
            </div>
          </div>
        </button>

        {hasExistingData &&
          (eraseState === "idle" ? (
            <button
              type="button"
              onClick={() => {
                setEraseConfirmText("");
                setEraseError(null);
                setEraseState("confirming");
              }}
              className="flex items-center gap-4 rounded-item border border-destructive/30 bg-destructive/5 px-5 py-4 text-left transition-colors hover:bg-destructive/10"
            >
              <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
              <div>
                <div className="font-mono text-foreground text-w-base uppercase tracking-widest">
                  Erase everything
                </div>
                <div className="mt-0.5 font-mono text-dim text-w-sm">
                  Permanently delete all data — connections, credentials, layouts, plugins,
                  assistant history, and settings — and start completely over.
                </div>
              </div>
            </button>
          ) : (
            <div className="space-y-3 rounded-item border border-destructive/40 bg-destructive/5 px-5 py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                <p className="font-mono text-dim text-w-sm">
                  This permanently deletes <span className="text-foreground">all</span> data and
                  cannot be undone. Type{" "}
                  <span className="font-bold text-foreground">{ERASE_CONFIRM_WORD}</span> to confirm.
                </p>
              </div>
              <input
                type="text"
                value={eraseConfirmText}
                onChange={(e) => setEraseConfirmText(e.target.value)}
                placeholder={ERASE_CONFIRM_WORD}
                autoComplete="off"
                // biome-ignore lint/a11y/noAutofocus: focus the confirm field when the destructive panel opens
                autoFocus
                className="w-full rounded-item border border-border bg-surface px-3 py-2 font-mono text-foreground text-w-sm outline-none focus:border-destructive"
              />
              {eraseError && <p className="font-mono text-destructive text-w-sm">{eraseError}</p>}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canErase}
                  onClick={() => void handleEraseAll()}
                  className="rounded-item bg-destructive px-3 py-1.5 font-mono text-destructive-foreground text-w-sm transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {eraseState === "erasing" ? "Erasing…" : "Erase everything"}
                </button>
                <button
                  type="button"
                  disabled={eraseState === "erasing"}
                  onClick={() => {
                    setEraseState("idle");
                    setEraseError(null);
                  }}
                  className="px-3 py-1.5 font-mono text-muted-foreground text-w-sm transition-colors hover:text-foreground disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}

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
