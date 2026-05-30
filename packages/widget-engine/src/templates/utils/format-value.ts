import { formatCurrency } from "@radarboard/utils/format-currency";
import { formatDateTime, isDateString } from "@radarboard/utils/format-date-time";
import { formatNumber } from "@radarboard/utils/format-number";
import { resolveCompactProjectBadgeLabel } from "../../components/compact-project-badge";
import type { DataSourceFormat } from "../types";

interface FormatValueOptions {
  currency?: string;
  precision?: number;
  compact?: boolean;
  normalize?: "none" | "compact-project";
  locale?: Intl.LocalesArgument;
  timeZone?: string;
}

function formatDurationSeconds(value: unknown): string {
  if (typeof value !== "number" || Number.isNaN(value)) return String(value);

  const rounded = Math.round(value);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function formatPercent(value: number, precision?: number): string {
  return `${value.toFixed(precision ?? (Math.abs(value) < 10 ? 1 : 0))}%`;
}

function formatNumberValue(value: number, options?: FormatValueOptions): string {
  if (options?.precision != null) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: options.precision,
      maximumFractionDigits: options.precision,
    }).format(value);
  }

  return formatNumber(value, { compact: options?.compact });
}

function formatDateValue(value: unknown, options?: FormatValueOptions): string {
  if (value instanceof Date || typeof value === "number" || typeof value === "string") {
    return (
      formatDateTime(value, {
        compact: true,
        includeTime: "auto",
        locale: options?.locale,
        timeZone: options?.timeZone,
      }) ?? String(value)
    );
  }

  return String(value);
}

function formatWithoutType(value: unknown, options?: FormatValueOptions): string {
  if (isDateString(value)) {
    return (
      formatDateTime(value, {
        compact: true,
        includeTime: "auto",
        locale: options?.locale,
        timeZone: options?.timeZone,
      }) ?? value
    );
  }
  return typeof value === "number" ? formatNumber(value) : String(value);
}

function formatRelativeTime(value: unknown): string {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      return value;
    }

    return formatRelativeTime(parsed);
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  const millis = value > 1_000_000_000_000 ? value : value * 1000;
  const diffSeconds = Math.floor((Date.now() - millis) / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86_400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86_400)}d ago`;
}

const FORMATTERS: Record<
  DataSourceFormat,
  (value: unknown, options?: FormatValueOptions) => string
> = {
  currency: (value) => (typeof value === "number" ? formatCurrency(value) : String(value)),
  number: (value, options) =>
    typeof value === "number" ? formatNumberValue(value, options) : String(value),
  percent: (value, options) =>
    typeof value === "number" ? formatPercent(value, options?.precision) : String(value),
  date: (value, options) => formatDateValue(value, options),
  "relative-time": (value) => formatRelativeTime(value),
  "duration-seconds": (value) => formatDurationSeconds(value),
};

export function getSiblingCurrencyField(field: string): string {
  const lastDotIndex = field.lastIndexOf(".");
  return lastDotIndex === -1 ? "currency" : `${field.slice(0, lastDotIndex)}.currency`;
}

export function formatValue(
  value: unknown,
  format?: DataSourceFormat,
  options?: FormatValueOptions
): string {
  if (value == null) return "—";
  if (options?.normalize === "compact-project") {
    const normalized = resolveCompactProjectBadgeLabel(value);
    return normalized ?? "—";
  }
  if (!format) return formatWithoutType(value, options);
  if (format === "currency") {
    return typeof value === "number"
      ? formatCurrency(value, options?.currency ?? "USD")
      : String(value);
  }
  return FORMATTERS[format](value, options);
}
