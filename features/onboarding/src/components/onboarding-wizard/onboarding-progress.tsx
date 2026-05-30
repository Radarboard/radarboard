"use client";

import { cn } from "@radarboard/utils/cn";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ONBOARDING_STEPS, OnboardingStep } from "./types";

interface OnboardingProgressProps {
  currentStep: OnboardingStep;
  completedSteps: Set<OnboardingStep>;
  visibleSteps: typeof ONBOARDING_STEPS;
}

/** Threshold below which we switch to the compact view (px). */
const COMPACT_THRESHOLD = 750;

export function OnboardingProgress({
  currentStep,
  completedSteps,
  visibleSteps,
}: OnboardingProgressProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (typeof ResizeObserver === "undefined") {
      setCompact(el.clientWidth < COMPACT_THRESHOLD);
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCompact(entry.contentRect.width < COMPACT_THRESHOLD);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const currentIdx = visibleSteps.findIndex((s) => s.step === currentStep);
  const currentLabel = visibleSteps[currentIdx]?.label ?? "";

  return (
    <div ref={containerRef} className="border-border border-b">
      {compact ? (
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent font-mono text-accent-foreground text-w-xs">
              {currentIdx + 1}
            </span>
            <span className="font-mono text-accent text-w-sm uppercase tracking-widest">
              {currentLabel}
            </span>
          </div>
          <span className="font-mono text-dim text-w-xs uppercase tracking-widest">
            {currentIdx + 1} / {visibleSteps.length}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-1 px-4 py-3">
          {visibleSteps.map((s, idx) => {
            const isActive = s.step === currentStep;
            const isCompleted = completedSteps.has(s.step);
            return (
              <div key={s.step} className="flex items-center gap-1">
                {idx > 0 && <div className="mx-1 h-px w-4 bg-border" />}
                <div
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-w-sm uppercase tracking-widest transition-colors",
                    isActive && "bg-accent/20 text-accent",
                    isCompleted && !isActive && "text-success",
                    !isActive && !isCompleted && "text-dim"
                  )}
                >
                  {isCompleted && !isActive ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full text-w-xs",
                        isActive ? "bg-accent text-accent-foreground" : "bg-border text-dim"
                      )}
                    >
                      {idx + 1}
                    </span>
                  )}
                  <span>{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
