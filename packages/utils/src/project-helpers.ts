import type { Project } from "@radarboard/types/project";

/** Check if active project (or any project in "All" mode) has a given integration. */
export function hasIntegration(
  projects: Project[],
  activeProjectSlug: string | null,
  integration: string
): boolean {
  const activeProject = activeProjectSlug
    ? projects.find((p) => p.slug === activeProjectSlug)
    : null;
  if (!activeProject) return true; // "All" mode: assume all integrations present
  return activeProject.platforms.some((p) => p.integrations[integration]);
}

/** Resolve Open Collective slug from active project. */
export function resolveOcSlug(
  projects: Project[],
  activeProjectSlug: string | null
): string | null {
  if (!activeProjectSlug) return "front-end-checklist";
  const project = projects.find((p) => p.slug === activeProjectSlug);
  const oc = project?.platforms.find((p) => p.integrations.openCollective)?.integrations
    .openCollective as { slug?: string } | undefined;
  return oc?.slug ?? null;
}

/** Return items if configured and non-empty, otherwise return fallback. */
export function resolveWithFallback<T>(items: T[], configured: boolean, fallback: T[]): T[] {
  return configured && items.length > 0 ? items : fallback;
}

/** Filter items by project name (pass-through when null). */
export function filterByProject<T extends { projectName: string }>(
  items: T[],
  projectName: string | null
): T[] {
  return projectName ? items.filter((s) => s.projectName === projectName) : items;
}

/** Format a date string as a relative time ago string. */
export function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Resolve a GitHub login (owner) from the project config.
 * In "All" mode, returns the first github.owner found across all projects.
 * In single-project mode, returns the owner from that project's platforms.
 */
export function resolveGitHubLogin(
  projects: Project[],
  activeProjectSlug: string | null
): string | null {
  const candidates = activeProjectSlug
    ? projects.filter((p) => p.slug === activeProjectSlug)
    : projects;

  for (const project of candidates) {
    for (const platform of project.platforms) {
      const gh = platform.integrations.github as { owner?: string } | undefined;
      if (gh?.owner) {
        return gh.owner;
      }
    }
  }
  return null;
}

/** Resolve the active project's display name from its slug. */
export function resolveProjectName(
  projects: Project[],
  activeProjectSlug: string | null
): string | null {
  if (!activeProjectSlug) return null;
  return projects.find((p) => p.slug === activeProjectSlug)?.name ?? null;
}
