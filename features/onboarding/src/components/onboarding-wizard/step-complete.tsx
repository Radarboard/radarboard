"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import {
  CheckCircle,
  FlaskConical,
  LayoutGrid,
  Loader2,
  Plug,
  Puzzle,
  ShieldCheck,
  User,
} from "lucide-react";
import type { ComponentType } from "react";
import { PROFILE_GROUPS } from "./profile-config";
import type { OnboardingState } from "./types";

interface StepCompleteProps {
  state: OnboardingState;
  onFinish: () => void;
  isFinishing?: boolean;
  finishProgress?: string | null;
  finishError?: string | null;
}

export function StepComplete({
  state,
  onFinish,
  isFinishing,
  finishProgress,
  finishError,
}: StepCompleteProps) {
  const integrationCount = state.connectedIntegrations.length;
  const pluginCount = state.enabledPlugins.length;
  const profileLabel = state.profile
    ? PROFILE_GROUPS.flatMap((g) => g.profiles).find((p) => p.id === state.profile)?.label
    : null;
  const summaryItems: Array<{
    eyebrow: string;
    description?: string;
    icon: ComponentType<{ className?: string }>;
    key: string;
    label: string;
  }> = [];

  if (state.keepExisting) {
    summaryItems.push({
      eyebrow: "Status",
      key: "keep-existing",
      icon: ShieldCheck,
      label: "Existing settings preserved",
      description: "Nothing was changed",
    });
  }

  if (profileLabel) {
    summaryItems.push({
      eyebrow: "Profile",
      key: "profile",
      icon: User,
      label: profileLabel,
    });
  }

  if (state.demoMode) {
    summaryItems.push({
      eyebrow: "Mode",
      key: "demo-mode",
      icon: FlaskConical,
      label: "Demo mode",
      description: "Viewing sample data",
    });
  }

  if (integrationCount > 0) {
    summaryItems.push({
      eyebrow: "Integrations",
      key: "integrations",
      icon: Plug,
      label: `${integrationCount} integration${integrationCount > 1 ? "s" : ""}`,
      description: "Selected",
    });
  }

  if (pluginCount > 0) {
    summaryItems.push({
      eyebrow: "Plugins",
      key: "plugins",
      icon: Puzzle,
      label: `${pluginCount} plugin${pluginCount > 1 ? "s" : ""}`,
      description: "Enabled",
    });
  }

  if (state.blueprintId) {
    summaryItems.push({
      eyebrow: "Layout",
      key: "blueprint",
      icon: LayoutGrid,
      label: "Dashboard blueprint selected",
    });
  }

  if (summaryItems.length === 0) {
    summaryItems.push({
      eyebrow: "Status",
      key: "ready",
      icon: CheckCircle,
      label: "Dashboard ready",
      description: "You can customize everything later in Settings",
    });
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-success/30 bg-success/10">
          <CheckCircle className="icon-lg text-success" />
        </div>

        <div className="mt-5 flex max-w-sm flex-col items-center gap-4">
          <h2 className="font-bold font-mono text-foreground text-w-lg uppercase tracking-widest">
            You&apos;re all set
          </h2>
          <p className="font-mono text-dim text-w-sm leading-6">
            Your dashboard is ready. Here&apos;s a summary of your setup.
          </p>
        </div>

        <div className="mt-8 w-full max-w-sm text-left">
          <p className="font-mono text-dim text-w-xs uppercase tracking-widest">Setup summary</p>
          <ul className="mt-3 space-y-2 overflow-x-hidden">
            {summaryItems.map((item) => {
              const Icon = item.icon;

              return (
                <li
                  key={item.key}
                  className="flex items-start gap-3 rounded-item border border-border bg-surface px-4 py-3.5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-item border border-border bg-secondary">
                    <Icon className="icon-sm text-accent" />
                  </div>
                  <div className="min-w-0 font-mono">
                    <p className="text-dim text-w-xs uppercase tracking-wide">{item.eyebrow}</p>
                    <p className="mt-1 text-foreground-secondary text-w-sm leading-6">{item.label}</p>
                    {item.description ? (
                      <p className="mt-1 text-dim text-w-xs leading-5">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-8 flex max-w-sm flex-col items-center gap-5">
          <p className="font-mono text-dim text-w-sm leading-6">
            You can always re-run this setup from Settings or adjust individual preferences.
          </p>

          {finishError ? (
            <p className="rounded-item border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-destructive text-w-sm leading-6">
              {finishError}
            </p>
          ) : null}

          <Button
            onClick={onFinish}
            disabled={isFinishing}
            className={cn("font-mono uppercase tracking-widest", isFinishing && "cursor-wait")}
          >
            {isFinishing ? (
              <>
                <Loader2 className="icon-xs animate-spin" />
                {finishProgress ?? "Finishing..."}
              </>
            ) : (
              (finishError ? "Retry" : "Go to Dashboard")
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
