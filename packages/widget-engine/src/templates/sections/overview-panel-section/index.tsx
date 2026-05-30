"use client";

import { Badge } from "@radarboard/ui/badge";
import { cn } from "@radarboard/utils/cn";
import { useResolvedData } from "../../data-resolver";
import type { DataSource, OverviewPanelSectionConfig } from "../../types";
import { useTemplateFormatting } from "../../use-formatting";
import { formatValue, getSiblingCurrencyField } from "../../utils/format-value";

function toneClass(value: unknown): string {
  if (typeof value === "string" && value.startsWith("#")) return "";

  switch (String(value ?? "").toLowerCase()) {
    case "high":
    case "critical":
    case "error":
    case "outage":
      return "text-destructive";
    case "elevated":
    case "warning":
    case "degraded":
      return "text-warning";
    case "low":
    case "healthy":
    case "operational":
    case "ok":
      return "text-success";
    default:
      return "text-[#d5d5da]";
  }
}

function useFormattedValue(source?: DataSource): string | null {
  const { locale, timeZone } = useTemplateFormatting();
  const value = useResolvedData(source);
  const currency = useResolvedData(
    source?.format === "currency"
      ? { sourceId: source.sourceId, field: getSiblingCurrencyField(source.field) }
      : undefined
  );

  if (!source || value == null || value === "") return null;

  return formatValue(value, source.format, {
    currency: typeof currency === "string" ? currency : undefined,
    locale,
    normalize: source.normalize,
    timeZone,
  });
}

function useToneStyle(source?: DataSource): { className: string; color?: string } {
  const value = useResolvedData(source);
  if (typeof value === "string" && value.startsWith("#")) {
    return { className: "", color: value };
  }

  return { className: toneClass(value) };
}

function OverviewPanelRow({
  row,
}: {
  row: NonNullable<OverviewPanelSectionConfig["rows"]>[number];
}) {
  const value = useFormattedValue(row.source);
  const tone = useToneStyle(row.toneSource);

  if (!value) return null;

  return (
    <div className="flex items-center justify-between gap-3 text-w-sm">
      <span className="truncate font-mono text-dim uppercase tracking-wider">{row.label}</span>
      <span
        className={cn("shrink-0 font-mono text-[#d2d2d8]", tone.className)}
        style={tone.color ? { color: tone.color } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

export function OverviewPanelSection({ config }: { config: OverviewPanelSectionConfig }) {
  const titleValue = useFormattedValue(config.titleSource);
  const metricValue = useFormattedValue(config.metricSource);
  const badgeValue = useFormattedValue(config.badgeSource);
  const descriptionValue = useFormattedValue(config.descriptionSource);
  const footerStart = useFormattedValue(config.footerStart);
  const footerEnd = useFormattedValue(config.footerEnd);
  const metricTone = useToneStyle(config.metricToneSource);
  const badgeTone = useToneStyle(config.badgeToneSource);

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-hidden rounded-item border border-border bg-surface p-3">
      {config.eyebrow ? (
        <span className="font-mono text-dim text-w-sm uppercase tracking-wider">
          {config.eyebrow}
        </span>
      ) : null}

      {(titleValue ?? config.title) ? (
        <div className="min-w-0">
          <div className="truncate text-[#e5e5ea] text-w-base">{titleValue ?? config.title}</div>
        </div>
      ) : null}

      {metricValue ? (
        <div className="space-y-1">
          {config.metricLabel ? (
            <div className="font-mono text-dim text-w-sm uppercase tracking-wider">
              {config.metricLabel}
            </div>
          ) : null}
          <div
            className={cn("font-bold font-mono text-foreground text-w-2xl", metricTone.className)}
            style={metricTone.color ? { color: metricTone.color } : undefined}
          >
            {metricValue}
          </div>
        </div>
      ) : null}

      {badgeValue ? (
        <Badge
          variant="default"
          className={cn("w-fit border-border bg-surface-raised", badgeTone.className)}
          style={badgeTone.color ? { color: badgeTone.color } : undefined}
        >
          {badgeValue}
        </Badge>
      ) : null}

      {descriptionValue ? (
        <p className="line-clamp-4 text-[#9b9ba1] text-w-sm leading-relaxed">{descriptionValue}</p>
      ) : null}

      {config.rows && config.rows.length > 0 ? (
        <div className="space-y-1.5">
          {config.rows.map((row) => (
            <OverviewPanelRow
              key={`${row.label}:${row.source.sourceId}:${row.source.field}`}
              row={row}
            />
          ))}
        </div>
      ) : null}

      {footerStart || footerEnd ? (
        <div className="mt-auto flex items-center gap-2 border-[#1b1b1b] border-t pt-2">
          {footerStart ? (
            <span className="truncate text-[#8e8e94] text-w-sm">{footerStart}</span>
          ) : null}
          {footerEnd ? (
            <span className="ml-auto shrink-0 font-mono text-dim text-w-sm">{footerEnd}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
