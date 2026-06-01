import { DEFAULT_DASHBOARD_TIME_RANGE } from "@radarboard/types/dashboard";

/**
 * Dashboard session model.
 *
 * Groups all state that should be scoped to a "monitoring session":
 * active project, time range, open plugins, and widget layout.
 *
 * Enables future features like save/restore sessions and proper
 * multi-project isolation. The session ID can be used as a prefix
 * for cache keys and DB operations to prevent cross-session leaking.
 */

export interface DashboardSession {
  /** Unique session identifier. */
  id: string;
  /** Active project slug, or null for the "all projects" view. */
  projectSlug: string | null;
  /** Selected time range for dashboard metrics. */
  timeRange: "today" | "7d" | "15d" | "30d" | "3m" | "1y";
  /** Currently active plugin ID, or null if none open. */
  activePluginId: string | null;
  /** Session creation timestamp. */
  createdAt: number;
  /** Last interaction timestamp. */
  lastActiveAt: number;
}

/** Create a new dashboard session with defaults. */
export function createSession(overrides?: Partial<DashboardSession>): DashboardSession {
  return {
    id: crypto.randomUUID(),
    projectSlug: null,
    timeRange: DEFAULT_DASHBOARD_TIME_RANGE,
    activePluginId: null,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    ...overrides,
  };
}

/** Build a cache key prefix scoped to a session. */
export function sessionCachePrefix(session: DashboardSession): string {
  return session.projectSlug
    ? `session:${session.id}:${session.projectSlug}`
    : `session:${session.id}:all`;
}
