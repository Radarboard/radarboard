"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import {
  formatPollingInterval,
  getEffectivePollingInterval,
  getPollingSourceDefinition,
  type PollingSourceId,
} from "@radarboard/types/polling";
import { Button } from "@radarboard/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@radarboard/ui/select";
import { cn } from "@radarboard/utils/cn";
import { useMemo } from "react";

interface PollingSourceControlsProps {
  sourceIds: PollingSourceId[];
  title?: string;
  description?: string;
  className?: string;
  sourceHints?: Partial<Record<PollingSourceId, string>>;
}

interface ResolvedPollingSource {
  id: PollingSourceId;
  label: string;
  description?: string;
  defaultIntervalMs: number;
  allowedIntervalsMs: readonly number[];
}

function resolvePollingSource(sourceId: PollingSourceId): ResolvedPollingSource | null {
  const definition = getPollingSourceDefinition(sourceId);
  if (!definition) return null;

  return {
    id: sourceId,
    label: definition.label,
    description: definition.description,
    defaultIntervalMs: definition.defaultIntervalMs,
    allowedIntervalsMs: definition.allowedIntervalsMs,
  };
}

export function PollingSourceControls({
  sourceIds,
  title = "Refresh",
  description,
  className,
  sourceHints,
}: PollingSourceControlsProps) {
  const { preferences, updatePreferences } = useDashboard();

  const sources = useMemo<ResolvedPollingSource[]>(
    () =>
      Array.from(new Set(sourceIds))
        .map(resolvePollingSource)
        .filter((source): source is ResolvedPollingSource => source !== null)
        .sort((left, right) => left.label.localeCompare(right.label)),
    [sourceIds]
  );

  if (sources.length === 0) {
    return null;
  }

  function updatePollingPreference(sourceId: PollingSourceId, intervalMs: number) {
    const definition = getPollingSourceDefinition(sourceId);
    if (!definition) return;

    const nextPolling = { ...(preferences.polling ?? {}) };

    if (intervalMs === definition.defaultIntervalMs) {
      delete nextPolling[sourceId];
    } else {
      nextPolling[sourceId] = intervalMs;
    }

    updatePreferences({ polling: nextPolling });
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div className="space-y-1">
        <div className="font-mono text-muted-foreground text-w-sm uppercase tracking-wider">
          {title}
        </div>
        {description ? <p className="text-dim text-w-sm">{description}</p> : null}
      </div>

      <div className="space-y-3 rounded-item border border-border bg-surface p-3">
        {sources.map((source, index) => {
          const effectiveInterval = getEffectivePollingInterval(source.id, preferences.polling);
          const hasOverride = preferences.polling?.[source.id] !== undefined;

          return (
            <div
              key={source.id}
              className={cn("space-y-3", index > 0 && "border-border border-t pt-3")}
            >
              <div className="space-y-1">
                <div className="font-mono text-foreground-secondary text-w-sm">{source.label}</div>
                {source.description ? (
                  <p className="text-dim text-w-sm">{source.description}</p>
                ) : null}
                {sourceHints?.[source.id] ? (
                  <p className="text-dim text-w-sm">{sourceHints[source.id]}</p>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-dim text-w-sm">
                  {hasOverride
                    ? `Custom interval. Default is ${formatPollingInterval(source.defaultIntervalMs)}.`
                    : `Default interval: ${formatPollingInterval(source.defaultIntervalMs)}.`}
                </div>
                {hasOverride ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => updatePollingPreference(source.id, source.defaultIntervalMs)}
                  >
                    Use default
                  </Button>
                ) : null}
              </div>

              <Select
                value={String(effectiveInterval)}
                onValueChange={(value) => updatePollingPreference(source.id, Number(value))}
              >
                <SelectTrigger size="lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {source.allowedIntervalsMs.map((intervalMs) => (
                    <SelectItem key={intervalMs} value={String(intervalMs)}>
                      {formatPollingInterval(intervalMs)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </section>
  );
}
