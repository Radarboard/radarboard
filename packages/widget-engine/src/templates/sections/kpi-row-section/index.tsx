"use client";

import { Sparkline } from "@radarboard/charts/sparkline";
import { Button } from "@radarboard/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { Info } from "lucide-react";
import { useMemo } from "react";
import { resolveCompactProjectBadgeLabel } from "../../../components/compact-project-badge";
import { SummaryMetricCell } from "../../../components/summary-metric-cell";
import { useResolvedData, useResolvedSourceState } from "../../data-resolver";
import type { KPIMetricConfig, KPIRowSectionConfig } from "../../types";
import { useTemplateFormatting } from "../../use-formatting";
import { formatValue, getSiblingCurrencyField } from "../../utils/format-value";

const GRID_COLUMNS = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
} as const;

interface BreakdownItem {
  label: string;
  value: number;
  color: string;
}

function normalizeBreakdownItem(item: unknown): BreakdownItem | null {
  if (!item || typeof item !== "object") return null;

  const record = item as Record<string, unknown>;
  if (typeof record.value !== "number") return null;

  const getLabel = () => {
    if (typeof record.projectName === "string") {
      return resolveCompactProjectBadgeLabel(record.projectName) ?? record.projectName;
    }
    if (typeof record.platformName === "string") return record.platformName;
    if (typeof record.name === "string") return record.name;
    return "Unknown";
  };
  const label = getLabel();

  const getColor = () => {
    if (typeof record.projectColor === "string") return record.projectColor;
    if (typeof record.color === "string") return record.color;
    return "#5b8af5";
  };
  const color = getColor();

  return {
    label,
    value: record.value,
    color,
  };
}

function normalizeBreakdown(input: unknown): BreakdownItem[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((item) => {
    const normalized = normalizeBreakdownItem(item);
    return normalized ? [normalized] : [];
  });
}

function KPIChange({ metric }: { metric: KPIMetricConfig }) {
  const { locale, timeZone } = useTemplateFormatting();
  const change = useResolvedData(metric.changeSource);
  if (!metric.changeSource) return null;
  if (typeof change !== "number") return null;

  return (
    <div className={cn("font-mono text-w-sm", change >= 0 ? "text-success" : "text-destructive")}>
      {change > 0 ? "+" : ""}
      {formatValue(change, metric.changeSource.format ?? "percent", {
        locale,
        precision: metric.changeSource.precision,
        normalize: metric.changeSource.normalize,
        timeZone,
      })}
    </div>
  );
}

function KPIBreakdown({ metric }: { metric: KPIMetricConfig }) {
  const { locale, timeZone } = useTemplateFormatting();
  const breakdown = useResolvedData(metric.breakdownSource);
  const currency = useResolvedData({
    sourceId: metric.source.sourceId,
    field: getSiblingCurrencyField(metric.source.field),
  });
  const items = useMemo(() => normalizeBreakdown(breakdown), [breakdown]);

  if (!metric.breakdownSource) return null;
  if (items.length === 0) return null;

  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost-link"
            spacing="none"
            uppercase={false}
            className="mt-2 flex w-full items-center gap-2 text-left"
            aria-label={`View ${metric.label} breakdown`}
          >
            <div className="flex h-1 flex-1 overflow-hidden rounded-full bg-secondary">
              {items.map((item) => (
                <span
                  key={`${metric.label}:${item.label}`}
                  className="h-full"
                  style={{
                    width: `${Math.max((item.value / total) * 100, 4)}%`,
                    backgroundColor: item.color,
                  }}
                />
              ))}
            </div>
            <Info className="icon-xs shrink-0 text-dim" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="min-w-[180px] border-border bg-[#181818] px-2 py-2">
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={`${metric.label}:${item.label}`}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-mono text-[#bbb] text-w-sm">{item.label}</span>
                </div>
                <span className="font-mono text-dim text-w-sm">
                  {formatValue(item.value, metric.source.format, {
                    currency: typeof currency === "string" ? currency : undefined,
                    locale,
                    precision: metric.source.precision,
                    compact: metric.source.compact,
                    normalize: metric.source.normalize,
                    timeZone,
                  })}
                </span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function KPICard({ metric }: { metric: KPIMetricConfig }) {
  const { locale, timeZone } = useTemplateFormatting();
  const value = useResolvedData(metric.source);
  const sparkline = useResolvedData(metric.sparklineSource);
  const currency = useResolvedData(
    metric.source.format === "currency"
      ? {
          sourceId: metric.source.sourceId,
          field: getSiblingCurrencyField(metric.source.field),
        }
      : undefined
  );
  const sourceState = useResolvedSourceState(metric.source.sourceId);
  const sparklineData = Array.isArray(sparkline)
    ? sparkline.filter(
        (item): item is { value: number } =>
          !!item &&
          typeof item === "object" &&
          typeof (item as { value?: unknown }).value === "number"
      )
    : [];

  if (sourceState.loading && value == null) {
    return (
      <div className="bg-surface-raised px-3 py-2.5">
        <div className="h-3 w-20 animate-pulse bg-secondary" />
        <div className="mt-2 h-6 w-24 animate-pulse bg-[#202020]" />
        <div className="mt-3 h-8 animate-pulse bg-surface-raised" />
      </div>
    );
  }

  return (
    <div className="bg-surface-raised px-3 py-2.5">
      <div className="flex items-center gap-1.5 font-mono text-dim text-w-sm uppercase tracking-wider">
        {metric.color != null && metric.color.length > 0 && (
          <span
            className="inline-block size-2 shrink-0 rounded-full"
            style={{ backgroundColor: metric.color }}
          />
        )}
        {metric.label}
      </div>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-foreground-secondary text-w-lg">
            {formatValue(value, metric.source.format, {
              currency: typeof currency === "string" ? currency : undefined,
              locale,
              precision: metric.source.precision,
              compact: metric.source.compact,
              normalize: metric.source.normalize,
              timeZone,
            })}
          </div>
          <KPIChange metric={metric} />
        </div>
        {sparklineData.length > 0 && (
          <div className="h-8 w-20 shrink-0">
            <Sparkline data={sparklineData} height={32} />
          </div>
        )}
      </div>
      <KPIBreakdown metric={metric} />
    </div>
  );
}

function CompactKPICard({ metric }: { metric: KPIMetricConfig }) {
  const { locale, timeZone } = useTemplateFormatting();
  const value = useResolvedData(metric.source);
  const valueColor = useResolvedData(metric.valueColorSource);

  return (
    <SummaryMetricCell
      label={metric.label}
      value={formatValue(value, metric.source.format, {
        locale,
        precision: metric.source.precision,
        compact: metric.source.compact,
        normalize: metric.source.normalize,
        timeZone,
      })}
      valueStyle={{
        color: typeof valueColor === "string" && valueColor.length > 0 ? valueColor : undefined,
      }}
    />
  );
}

export function KPIRowSection({ config }: { config: KPIRowSectionConfig }) {
  const variant = config.variant ?? "default";
  const gridClass = cn(
    "grid",
    GRID_COLUMNS[config.columns],
    variant === "compact" ? "gap-0 border-y border-border" : "gap-px bg-secondary"
  );

  return (
    <div className={cn(gridClass, "shrink-0")}>
      {config.metrics.map((metric) =>
        variant === "compact" ? (
          <CompactKPICard key={metric.label} metric={metric} />
        ) : (
          <KPICard key={metric.label} metric={metric} />
        )
      )}
    </div>
  );
}
