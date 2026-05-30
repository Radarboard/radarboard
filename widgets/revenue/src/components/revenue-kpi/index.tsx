"use client";

import { Sparkline } from "@radarboard/charts/sparkline";
import type {
  LastPayment,
  RevenueKPIBreakdown,
  RevenueKPI as RevenueKPIType,
} from "@radarboard/types/revenue";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radarboard/ui/tooltip";
import { formatCurrency } from "@radarboard/utils/format-currency";
import { calculateChange } from "@radarboard/utils/format-percent";
import { TrendIndicator } from "@radarboard/widget-engine/trend-indicator";

interface RevenueKPICardProps {
  label: string;
  data: RevenueKPIType;
  /** Per-project breakdown for tooltip in "All" view */
  breakdown?: RevenueKPIBreakdown[];
}

export function RevenueKPICard({ label, data, breakdown }: RevenueKPICardProps) {
  const change = calculateChange(data.value, data.previousValue);
  const isPositive = change >= 0;

  const content = (
    <div className="flex h-full cursor-default flex-col gap-1 bg-surface p-3">
      <span className="truncate font-mono @[200px]:text-w-sm text-dim text-w-xs uppercase tracking-wider">
        {label}
      </span>
      <span className="truncate font-bold font-mono @[200px]:text-w-2xl text-foreground text-w-xl">
        {formatCurrency(data.value, data.currency)}
      </span>
      <div className="flex items-center gap-2">
        <TrendIndicator
          direction={Math.abs(change) < 2 ? "flat" : isPositive ? "up" : "down"}
          changePct={Math.round(change * 10) / 10}
          size="xs"
        />
      </div>
      <div className="mt-auto pt-2">
        <Sparkline
          data={data.sparklineData.map((d) => ({ value: d.value }))}
          positive={isPositive}
          height={32}
        />
      </div>
    </div>
  );

  if (!breakdown || breakdown.length <= 1) {
    return content;
  }

  const total = breakdown.reduce((sum, b) => sum + b.value, 0);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="bottom" className="min-w-[180px] border-border bg-surface-raised p-0">
          <div className="flex flex-col gap-1.5 p-2">
            {breakdown.map((b) => (
              <div key={b.projectName} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-foreground-secondary text-w-sm">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: b.projectColor }}
                  />
                  {b.projectName}
                </span>
                <span className="font-mono font-semibold text-foreground text-w-sm">
                  {formatCurrency(b.value, data.currency)}
                </span>
              </div>
            ))}
            {total > 0 && (
              <div className="mt-0.5 flex h-1 overflow-hidden rounded-full">
                {breakdown.map((b) => {
                  const pct = (b.value / total) * 100;
                  return (
                    <div
                      key={b.projectName}
                      style={{ backgroundColor: b.projectColor, width: `${pct}%` }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface LastPaymentCardProps {
  data: LastPayment;
}

export function LastPaymentCard({ data }: LastPaymentCardProps) {
  return (
    <div className="flex h-full flex-col gap-1 bg-surface p-3">
      <span className="truncate font-mono @[200px]:text-w-sm text-dim text-w-xs uppercase tracking-wider">
        Last Payment
      </span>
      <span className="truncate font-bold font-mono @[200px]:text-w-2xl text-foreground text-w-xl">
        {formatCurrency(data.amount, data.currency)}
      </span>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <span
          className="icon-xs inline-block rounded-none"
          style={{ backgroundColor: data.projectColor }}
        />
        <span className="truncate @[200px]:text-w-base text-dim text-w-sm">{data.projectName}</span>
        <span className="ml-auto @[200px]:text-w-sm text-dim text-w-xs">{data.country}</span>
      </div>
      <span className="@[200px]:text-w-sm text-dim text-w-xs">{data.timeAgo}</span>
    </div>
  );
}
