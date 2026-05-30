export type TimeRange = "today" | "7d" | "15d" | "30d" | "3m" | "1y" | "all";
export type DisplayCurrency = "USD" | "CAD";
export const AUTO_TIMEZONE = "auto";
export const AUTO_LOCALE = "auto";
export type DashboardTimezonePreference = string;
export type DashboardLocalePreference = string;

/** Persisted config slug for the aggregate "All Projects" dashboard view. */
export const ALL_PROJECTS_SLUG = "__all__";

export interface DashboardState {
  timeRange: TimeRange;
  activeProjectSlug: string | null;
  currency: DisplayCurrency;
  timezonePreference: DashboardTimezonePreference;
  localePreference: DashboardLocalePreference;
}

export interface DataPoint {
  date: string;
  value: number;
}
