"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { Pause, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { PomodoroSession } from "../types";

interface PomodoroTimerProps {
  session: PomodoroSession | null;
  onStop: () => void;
  /** Compact display for widget mode. */
  compact?: boolean;
}

function getTimeRemaining(session: PomodoroSession): number {
  const start = new Date(session.startedAt).getTime();
  const end = start + session.durationMinutes * 60 * 1000;
  return Math.max(0, end - Date.now());
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

const TYPE_LABELS: Record<string, string> = {
  work: "Focus",
  "short-break": "Short Break",
  "long-break": "Long Break",
};

const TYPE_COLORS: Record<string, string> = {
  work: "text-red-400",
  "short-break": "text-emerald-400",
  "long-break": "text-blue-400",
};

export function PomodoroTimer({ session, onStop, compact }: PomodoroTimerProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      const r = getTimeRemaining(session);
      setTick((current) => current + 1);
      if (r <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  if (!session) {
    return compact ? null : (
      <div className="py-4 text-center text-dim text-sm">
        No active timer. Start a Pomodoro from a task.
      </div>
    );
  }

  const remaining = getTimeRemaining(session);
  const isComplete = remaining <= 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            isComplete ? "bg-emerald-400" : "animate-pulse bg-red-400"
          )}
        />
        <span className={cn("font-mono text-sm", TYPE_COLORS[session.type])}>
          {isComplete ? "Done!" : formatTime(remaining)}
        </span>
        <span className="text-dim text-w-sm">{TYPE_LABELS[session.type]}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div
        className={cn("font-mono text-w-sm uppercase tracking-widest", TYPE_COLORS[session.type])}
      >
        {TYPE_LABELS[session.type]}
      </div>

      <div
        className={cn(
          "font-bold font-mono text-4xl tabular-nums",
          isComplete ? "text-emerald-400" : "text-foreground-secondary"
        )}
      >
        {isComplete ? "00:00" : formatTime(remaining)}
      </div>

      <div className="text-dim text-xs">Cycle {session.completedCycles + 1}</div>

      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          onClick={onStop}
          variant="secondary"
          uppercase={false}
          className="h-auto gap-1.5 py-1.5 text-muted-foreground text-sm hover:text-foreground-secondary"
        >
          {isComplete ? <RotateCcw className="icon-base" /> : <Pause className="icon-base" />}
          {isComplete ? "Reset" : "Stop"}
        </Button>
      </div>
    </div>
  );
}
