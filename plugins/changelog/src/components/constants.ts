import type { PillVariant } from "./types";

export const STATUS_LABELS = {
  active: "Active",
  muted: "Muted",
  disabled: "Disabled",
} as const;

export const STATUS_VARIANTS: Record<string, PillVariant> = {
  active: "success",
  muted: "warning",
  disabled: "default",
} as const;

export const QUALITY_VARIANTS: Record<string, PillVariant> = {
  full: "info",
  minimal: "magenta",
} as const;

export const CHANGELOG_ENTRY_QUERY_PARAM = "entryId";
export const MARK_READ_DELAY_MS = 2500;
