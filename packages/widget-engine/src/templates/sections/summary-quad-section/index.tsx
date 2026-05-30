"use client";

import { Sparkline } from "@radarboard/charts/sparkline";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { resolveCompactProjectBadgeLabel } from "../../../components/compact-project-badge";
import { SummaryQuadShell } from "../../../components/summary-quad-shell";
import { useResolvedData } from "../../data-resolver";
import type {
  DataSource,
  SummaryQuadMetricSlotConfig,
  SummaryQuadSectionConfig,
  SummaryQuadSlotConfig,
} from "../../types";
import { useTemplateFormatting } from "../../use-formatting";
import { formatValue, getSiblingCurrencyField } from "../../utils/format-value";

interface BreakdownItem {
  label: string;
  value: number;
  color: string;
}

const SLOT_KEYS = ["summary-quad-a", "summary-quad-b", "summary-quad-c", "summary-quad-d"] as const;

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

  return { label, value: record.value, color };
}

function normalizeBreakdown(input: unknown): BreakdownItem[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((item) => {
    const normalized = normalizeBreakdownItem(item);
    return normalized ? [normalized] : [];
  });
}

function normalizeSparklineData(input: unknown) {
  if (!Array.isArray(input)) return [];

  return input.filter(
    (item): item is { value: number } =>
      !!item && typeof item === "object" && typeof (item as { value?: unknown }).value === "number"
  );
}

function useFormattedValue(source?: DataSource) {
  const { locale, timeZone } = useTemplateFormatting();
  const value = useResolvedData(source);
  const currency = useResolvedData(
    source?.format === "currency"
      ? { sourceId: source.sourceId, field: getSiblingCurrencyField(source.field) }
      : undefined
  );

  if (!source) return null;

  return formatValue(value, source.format, {
    currency: typeof currency === "string" ? currency : undefined,
    locale,
    normalize: source.normalize,
    timeZone,
  });
}

function SummaryMetricSubtitle({
  subtitleValue,
  subtitleText,
}: {
  subtitleValue: string | null;
  subtitleText?: string;
}) {
  const value = subtitleValue ?? subtitleText;
  if (!value) return null;

  return <span className="font-mono text-dim text-w-sm">{value}</span>;
}

function SummaryMetricFooter({
  footerStart,
  footerEnd,
  footerColor,
}: {
  footerStart: string | null;
  footerEnd: string | null;
  footerColor: unknown;
}) {
  if (!footerStart && !footerEnd) return null;

  return (
    <div className="mt-1 flex items-center gap-2">
      {typeof footerColor === "string" && footerColor.length > 0 ? (
        <span
          className="icon-xs inline-block rounded-item"
          style={{ backgroundColor: footerColor }}
        />
      ) : null}
      {footerStart ? <span className="truncate text-dim text-w-base">{footerStart}</span> : null}
      {footerEnd ? <span className="ml-auto text-dim text-w-sm">{footerEnd}</span> : null}
    </div>
  );
}

function SummaryMetricBreakdownBar({
  breakdown,
  total,
}: {
  breakdown: BreakdownItem[];
  total: number;
}) {
  if (breakdown.length <= 1 || total <= 0) return null;

  return (
    <div className="mt-auto flex h-1 overflow-hidden rounded-full">
      {breakdown.map((item) => (
        <div
          key={item.label}
          style={{ backgroundColor: item.color, width: `${(item.value / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

function SummaryMetricTooltipContent({
  slot,
  breakdown,
}: {
  slot: SummaryQuadMetricSlotConfig;
  breakdown: BreakdownItem[];
}) {
  const { locale, timeZone } = useTemplateFormatting();
  if (!slot.tooltip && breakdown.length <= 1) return null;

  return (
    <TooltipContent side="bottom" className="min-w-[180px] border-border bg-surface-raised p-2">
      <div className="space-y-2">
        {slot.tooltip ? (
          <p className="max-w-[220px] text-muted-foreground text-w-sm">{slot.tooltip}</p>
        ) : null}
        {breakdown.length > 1 ? (
          <div className="space-y-1.5">
            {breakdown.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-foreground-secondary text-w-sm">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </span>
                <span className="font-mono text-foreground text-w-sm">
                  {formatValue(item.value, slot.source.format, { locale, timeZone })}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </TooltipContent>
  );
}

function SummaryMetricCardBody({ slot }: { slot: SummaryQuadMetricSlotConfig }) {
  const { locale, timeZone } = useTemplateFormatting();
  const value = useFormattedValue(slot.source);
  const subtitleValue = useFormattedValue(slot.subtitle);
  const footerStart = useFormattedValue(slot.footerStart);
  const footerEnd = useFormattedValue(slot.footerEnd);
  const footerColor = useResolvedData(slot.footerColor);
  const changeValue = useResolvedData(slot.changeSource);
  const sparklineData = normalizeSparklineData(useResolvedData(slot.sparklineSource));
  const breakdown = normalizeBreakdown(useResolvedData(slot.breakdownSource));
  const total = breakdown.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex h-full flex-col gap-1 bg-surface p-3">
      <span className="flex items-center gap-1 font-mono text-dim text-w-sm uppercase tracking-wider">
        {slot.label}
        {slot.tooltip ? <Info className="icon-xs text-dim" /> : null}
      </span>
      <span className="font-bold font-mono text-foreground text-w-2xl">{value}</span>
      {typeof changeValue === "number" ? (
        <span
          className={cn(
            "font-mono text-w-sm",
            changeValue >= 0 ? "text-success" : "text-destructive"
          )}
        >
          {changeValue > 0 ? "+" : ""}
          {formatValue(changeValue, slot.changeSource?.format, { locale, timeZone })}
        </span>
      ) : null}
      <SummaryMetricSubtitle subtitleValue={subtitleValue} subtitleText={slot.subtitleText} />
      <SummaryMetricFooter
        footerStart={footerStart}
        footerEnd={footerEnd}
        footerColor={footerColor}
      />
      {sparklineData.length > 0 ? (
        <div className="mt-1">
          <Sparkline data={sparklineData} positive height={32} />
        </div>
      ) : null}
      <SummaryMetricBreakdownBar breakdown={breakdown} total={total} />
    </div>
  );
}

function SummaryMetricCard({ slot }: { slot: SummaryQuadMetricSlotConfig }) {
  const breakdown = normalizeBreakdown(useResolvedData(slot.breakdownSource));
  const content = <SummaryMetricCardBody slot={slot} />;
  const tooltipContent = <SummaryMetricTooltipContent slot={slot} breakdown={breakdown} />;

  if (!tooltipContent) {
    return content;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        {tooltipContent}
      </Tooltip>
    </TooltipProvider>
  );
}

function SummarySparklineCard({
  slot,
}: {
  slot: Extract<SummaryQuadSlotConfig, { kind: "sparkline" }>;
}) {
  const data = normalizeSparklineData(useResolvedData(slot.source));

  return (
    <div className="flex h-full flex-col justify-center bg-surface p-3">
      {data.length > 0 ? (
        <>
          <span className="mb-1 font-mono text-dim text-w-sm uppercase tracking-wider">
            {slot.label}
          </span>
          <Sparkline data={data} positive={slot.positive ?? true} height={36} />
        </>
      ) : (
        <span className="text-center font-mono text-dim text-w-sm">
          {slot.emptyMessage ?? "No trend data"}
        </span>
      )}
    </div>
  );
}

function SummaryQuadSlotContent({ slot }: { slot: SummaryQuadSlotConfig }) {
  if (slot.kind === "empty") {
    return <div className="bg-surface" />;
  }

  if (slot.kind === "sparkline") {
    return <SummarySparklineCard slot={slot} />;
  }

  return <SummaryMetricCard slot={slot} />;
}

export function SummaryQuadSection({ config }: { config: SummaryQuadSectionConfig }) {
  const slots = config.slots.map((slot, index) => (
    <SummaryQuadSlotContent key={SLOT_KEYS[index]} slot={slot} />
  )) as [ReactNode, ReactNode, ReactNode, ReactNode];

  return <SummaryQuadShell slots={slots} className="h-full" />;
}
