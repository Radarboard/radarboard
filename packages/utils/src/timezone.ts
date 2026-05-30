export const AUTO_TIMEZONE = "auto";
export type DashboardTimezonePreference = string;
export type TimeRange = "today" | "7d" | "15d" | "30d" | "3m" | "1y" | "all";

const RANGE_CONFIG: Record<
  Exclude<TimeRange, "all">,
  { days?: number; months?: number; years?: number }
> = {
  today: { days: 1 },
  "7d": { days: 7 },
  "15d": { days: 15 },
  "30d": { days: 30 },
  "3m": { months: 3 },
  "1y": { years: 1 },
};

const DEFAULT_TIMEZONE = "UTC";
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();
const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dateFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function getDateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dateTimeFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    dateTimeFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function extractParts(formatter: Intl.DateTimeFormat, date: Date): Record<string, string> {
  return formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
}

function formatDateParts(year: number, month: number, day: number): string {
  return `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
}

function shiftDateString(
  dateString: string,
  config: { days?: number; months?: number; years?: number }
): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));

  if (config.days) date.setUTCDate(date.getUTCDate() - (config.days - 1));
  else if (config.months) date.setUTCMonth(date.getUTCMonth() - config.months);
  else if (config.years) date.setUTCFullYear(date.getUTCFullYear() - config.years);

  return formatDateParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function getDateTimeParts(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = extractParts(getDateTimeFormatter(timeZone), date);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function zonedDateTimeToUtc(
  timeZone: string,
  parts: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
  }
): Date {
  let utcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0
  );

  for (let index = 0; index < 3; index += 1) {
    const actual = getDateTimeParts(new Date(utcMs), timeZone);
    const desiredUtcMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour ?? 0,
      parts.minute ?? 0,
      parts.second ?? 0
    );
    const actualUtcMs = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    const diffMs = desiredUtcMs - actualUtcMs;
    utcMs += diffMs;
    if (diffMs === 0) break;
  }

  return new Date(utcMs);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(timeZone: string | null | undefined): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
}

export function getSupportedTimeZones(): string[] {
  const valuesOf = Intl.supportedValuesOf as
    | ((
        key: "calendar" | "collation" | "currency" | "numberingSystem" | "timeZone" | "unit"
      ) => string[])
    | undefined;

  if (typeof valuesOf === "function") {
    const zones = valuesOf("timeZone");
    return zones.includes(DEFAULT_TIMEZONE) ? zones : [DEFAULT_TIMEZONE, ...zones];
  }

  return [DEFAULT_TIMEZONE];
}

export function detectBrowserTimeZone(): string {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return detected && isValidTimeZone(detected) ? detected : DEFAULT_TIMEZONE;
}

export function resolveEffectiveTimeZone(
  preference: DashboardTimezonePreference | null | undefined
): string {
  if (!preference || preference === AUTO_TIMEZONE) {
    return detectBrowserTimeZone();
  }
  return normalizeTimeZone(preference);
}

export function getDateStringInTimeZone(date: Date, timeZone: string): string {
  const parts = extractParts(getDateFormatter(timeZone), date);
  return formatDateParts(Number(parts.year), Number(parts.month), Number(parts.day));
}

export function formatDateInTimeZone(
  value: Date | string | number,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(date);
}

export function getStartOfTodayInTimeZone(timeZone: string, now = new Date()): Date {
  const parts = getDateTimeParts(now, timeZone);
  return zonedDateTimeToUtc(timeZone, {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 0,
    minute: 0,
    second: 0,
  });
}

export function isSameDayInTimeZone(
  value: Date | string | number,
  timeZone: string,
  now = new Date()
): boolean {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return getDateStringInTimeZone(date, timeZone) === getDateStringInTimeZone(now, timeZone);
}

export function formatLocalDate(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  return getDateStringInTimeZone(date, timeZone);
}

export function getTimeRangeWindow(
  range: TimeRange,
  timeZone = DEFAULT_TIMEZONE,
  now = new Date()
) {
  const endDate = getDateStringInTimeZone(now, timeZone);
  if (range === "all") {
    return {
      start: new Date(0),
      end: zonedDateTimeToUtc(timeZone, {
        year: Number(endDate.split("-")[0] ?? 1970),
        month: Number(endDate.split("-")[1] ?? 1),
        day: Number(endDate.split("-")[2] ?? 1),
        hour: 0,
        minute: 0,
        second: 0,
      }),
      startDate: "1970-01-01",
      endDate,
    };
  }

  const config = RANGE_CONFIG[range];
  const startDate = shiftDateString(endDate, config);
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);

  return {
    start: zonedDateTimeToUtc(timeZone, {
      year: startYear ?? 1970,
      month: startMonth ?? 1,
      day: startDay ?? 1,
      hour: 0,
      minute: 0,
      second: 0,
    }),
    end: zonedDateTimeToUtc(timeZone, {
      year: endYear ?? 1970,
      month: endMonth ?? 1,
      day: endDay ?? 1,
      hour: 0,
      minute: 0,
      second: 0,
    }),
    startDate,
    endDate,
  };
}

export function isDateInTimeRange(
  date: Date | string,
  range: TimeRange,
  timeZone = DEFAULT_TIMEZONE,
  now = new Date()
): boolean {
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return false;

  const { startDate, endDate } = getTimeRangeWindow(range, timeZone, now);
  const valueDate = getDateStringInTimeZone(value, timeZone);

  return valueDate >= startDate && valueDate <= endDate;
}
