export type ScopeKey =
  | "all"
  | "quality:full"
  | "quality:minimal"
  | "prerelease"
  | `project:${string}`;
export type ReadTab = "inbox" | "archived";

export interface ProjectSummary {
  projectSlug: string;
  projectName: string;
  projectColor: string;
  watchCount: number;
  releaseCount: number;
  latestAt: string | null;
}

export interface SummaryStats {
  watchedCount: number;
  fullNotesCount: number;
  projectCount: number;
  unreadCount: number;
  archivedCount: number;
}

export type PillVariant =
  | "default"
  | "success"
  | "info"
  | "warning"
  | "error"
  | "purple"
  | "indigo"
  | "cyan"
  | "dim"
  | "magenta";
