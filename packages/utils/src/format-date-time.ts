import { AUTO_LOCALE } from "@radarboard/types/dashboard";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_HINT_PATTERN = /T|\d{1,2}:\d{2}|Z$|[+-]\d{2}:?\d{2}$/;
const DEFAULT_LOCALE = "en-US";

interface ParsedDateValue {
  date: Date;
  includesTime: boolean;
}

export interface FormatDateTimeOptions {
  compact?: boolean;
  includeTime?: boolean | "auto";
  locale?: Intl.LocalesArgument;
  now?: Date;
  timeZone?: string;
}

function normalizeLocale(locale: string): string | null {
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? null;
  } catch {
    return null;
  }
}

export function isValidLocale(locale: string): boolean {
  return normalizeLocale(locale) !== null;
}

export function detectBrowserLocale(): string {
  const detected = Intl.DateTimeFormat().resolvedOptions().locale;
  return typeof detected === "string"
    ? (normalizeLocale(detected) ?? DEFAULT_LOCALE)
    : DEFAULT_LOCALE;
}

export function resolveEffectiveLocale(preference: string | null | undefined): string {
  if (!preference || preference === AUTO_LOCALE) {
    return detectBrowserLocale();
  }

  return normalizeLocale(preference) ?? DEFAULT_LOCALE;
}

function parseDateValue(value: string | number | Date): ParsedDateValue | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : { date: value, includesTime: value.getHours() !== 0 || value.getMinutes() !== 0 };
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : { date, includesTime: true };
  }

  const trimmed = value.trim();
  // Reject strings too short to be a realistic date (avoids new Date("0") → Dec 31, year -1)
  if (trimmed.length < 4) return null;

  if (DATE_ONLY_PATTERN.test(trimmed)) {
    const [yearPart, monthPart, dayPart] = trimmed.split("-");
    if (yearPart == null || monthPart == null || dayPart == null) {
      return null;
    }

    const year = Number(yearPart);
    const month = Number(monthPart);
    const day = Number(dayPart);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    return {
      date: new Date(year, month - 1, day),
      includesTime: false,
    };
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    date,
    includesTime: DATE_TIME_HINT_PATTERN.test(trimmed),
  };
}

export function isDateString(value: unknown): value is string {
  return typeof value === "string" && parseDateValue(value) !== null;
}

export function formatDateTime(
  value: string | number | Date,
  options: FormatDateTimeOptions = {}
): string | null {
  const parsed = parseDateValue(value);
  if (!parsed) return null;

  const includeTime =
    options.includeTime === "auto" || options.includeTime == null
      ? parsed.includesTime
      : options.includeTime;
  const now = options.now ?? new Date();
  const includeYear = parsed.date.getFullYear() !== now.getFullYear() || options.compact !== true;

  const locale =
    typeof options.locale === "string" ? resolveEffectiveLocale(options.locale) : options.locale;

  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone: options.timeZone,
    ...(options.compact
      ? {
          month: "short",
          day: "numeric",
          ...(includeYear ? { year: "numeric" } : {}),
          ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
        }
      : includeTime
        ? { dateStyle: "medium", timeStyle: "short" }
        : { dateStyle: "medium" }),
  });

  return formatter.format(parsed.date);
}

export function formatDate(value: string | number | Date, options: FormatDateTimeOptions = {}) {
  return formatDateTime(value, { ...options, includeTime: false });
}
