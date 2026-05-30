import type { ChangelogEntry, ChangelogImportTarget, PackageWatch } from "../types";
import type { PillVariant, ProjectSummary, ReadTab, ScopeKey } from "./types";

export function getSourceVariant(sourceType: ChangelogEntry["sourceType"]): PillVariant {
  switch (sourceType) {
    case "github_release":
      return "cyan";
    case "github_atom":
      return "indigo";
    case "npm_publish":
      return "warning";
    case "manual":
      return "error";
    default:
      return "default";
  }
}

export function formatReleaseDate(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelativeDate(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export function formatMonthSeparator(value: string): string {
  return new Date(value).toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
}

export function scopeTitle(scopeKey: ScopeKey, targets: ChangelogImportTarget[]): string {
  if (scopeKey === "all") return "All Releases";
  if (scopeKey === "quality:full") return "Full Notes";
  if (scopeKey === "quality:minimal") return "Minimal Notes";
  if (scopeKey === "prerelease") return "Prereleases";
  const projectSlug = scopeKey.replace("project:", "");
  return targets.find((target) => target.projectSlug === projectSlug)?.projectName ?? "Project";
}

export function repositoryLabel(repositoryUrl: string | null | undefined): string | null {
  if (!repositoryUrl) return null;
  const normalized = repositoryUrl.replace(/^git\+/, "");
  try {
    const url = new URL(normalized);
    if (!/github\.com$/i.test(url.hostname)) return null;
    const [owner, repo] = url.pathname.replace(/^\/+/, "").split("/");
    if (!owner || !repo) return null;
    return `${owner}/${repo.replace(/\.git$/i, "")}`;
  } catch {
    return null;
  }
}

export function getProjectSummaries(
  targets: ChangelogImportTarget[],
  watches: PackageWatch[],
  entries: ChangelogEntry[]
): ProjectSummary[] {
  const summaryMap = new Map<string, ProjectSummary>();

  for (const target of targets) {
    summaryMap.set(target.projectSlug, {
      projectSlug: target.projectSlug,
      projectName: target.projectName,
      projectColor: target.projectColor,
      watchCount: 0,
      releaseCount: 0,
      latestAt: null,
    });
  }

  for (const watch of watches) {
    const summary = summaryMap.get(watch.projectSlug);
    if (!summary || watch.status === "disabled") continue;
    summary.watchCount += 1;
  }

  for (const entry of entries) {
    for (const projectSlug of entry.projectSlugs) {
      const summary = summaryMap.get(projectSlug);
      if (!summary) continue;
      summary.releaseCount += 1;
      if (!summary.latestAt || entry.publishedAt > summary.latestAt) {
        summary.latestAt = entry.publishedAt;
      }
    }
  }

  return Array.from(summaryMap.values()).sort((left, right) =>
    left.projectName.localeCompare(right.projectName)
  );
}

function matchesSearch(entry: ChangelogEntry, searchLower: string): boolean {
  if (!searchLower) return true;
  return [entry.packageName, entry.version, entry.title, entry.description, entry.body ?? ""]
    .join(" ")
    .toLowerCase()
    .includes(searchLower);
}

function matchesScope(entry: ChangelogEntry, scopeKey: ScopeKey): boolean {
  if (scopeKey === "all") return true;
  if (scopeKey === "quality:full") return entry.notesQuality === "full";
  if (scopeKey === "quality:minimal") return entry.notesQuality === "minimal";
  if (scopeKey === "prerelease") return entry.isPrerelease;
  if (scopeKey.startsWith("project:")) {
    const projectSlug = scopeKey.replace("project:", "");
    return entry.projectSlugs.includes(projectSlug);
  }
  return true;
}

export function getFilteredEntries(
  entries: ChangelogEntry[],
  entryMeta: Record<string, { readAt?: string; archivedAt?: string }>,
  readTab: ReadTab,
  scopeKey: ScopeKey,
  search: string
): ChangelogEntry[] {
  const searchLower = search.trim().toLowerCase();
  return [...entries]
    .filter((entry) => {
      const meta = entryMeta[entry.id];
      const isArchived = Boolean(meta?.archivedAt);

      if (readTab === "archived" && !isArchived) return false;
      if (readTab === "inbox" && isArchived) return false;

      return matchesScope(entry, scopeKey) && matchesSearch(entry, searchLower);
    })
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}
