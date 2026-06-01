import { findDataSource } from "@radarboard/integration-sdk/registry";
import { integrationRoute } from "@radarboard/integration-sdk/routes";
import type { DashboardPollingPreferences, PollingSourceId } from "@radarboard/types/polling";
import type { Project } from "@radarboard/types/project";
import { buildDataSourceContext } from "@/lib/data-source-context";
import { resolvePollingTtlSeconds } from "@/lib/polling-settings";

export interface BackupTask {
  key: string;
  route: string;
  ttlSeconds: number;
  fetchFn: () => Promise<unknown>;
  rateLimitGroup?: string;
}

/**
 * Helper to create a backup task that calls a data-source via the unified handler pattern.
 */
function dsTask(
  key: string,
  route: string,
  ttlSeconds: number,
  integration: string,
  action: string,
  params: Record<string, unknown>,
  rateLimitGroup?: string,
  pollingSourceId?: PollingSourceId,
  pollingPreferences?: DashboardPollingPreferences
): BackupTask {
  return {
    key,
    route,
    ttlSeconds: resolvePollingTtlSeconds(pollingSourceId, ttlSeconds, pollingPreferences),
    rateLimitGroup,
    fetchFn: async () => {
      const ds = findDataSource(integration, action);
      if (!ds) throw new Error(`Data source ${integration}/${action} not found`);
      const ctx = buildDataSourceContext();
      return ds.fetch(
        { projectSlug: null, range: "30d", timeZone: "UTC", forceRefresh: false, ...params },
        ctx
      );
    },
  };
}

function addRevenueTasks(
  tasks: BackupTask[],
  project: Project,
  pollingPreferences?: DashboardPollingPreferences
): void {
  if (!project.platforms.some((p) => p.integrations.revenuecat)) return;
  const slug = project.slug;
  for (const currency of ["USD", "CAD"] as const) {
    tasks.push(
      dsTask(
        `revenue:${slug}:30d:${currency}:UTC`,
        integrationRoute("revenuecat", "data"),
        300,
        "revenuecat",
        "data",
        { projectSlug: slug, currency },
        "revenuecat",
        "revenue",
        pollingPreferences
      )
    );
  }
}

function addAnalyticsTasks(
  tasks: BackupTask[],
  project: Project,
  pollingPreferences?: DashboardPollingPreferences
): void {
  if (!project.platforms.some((p) => p.integrations.openPanel)) return;
  tasks.push(
    dsTask(
      `analytics:${project.slug}:30d:UTC`,
      integrationRoute("openpanel", "data"),
      60,
      "openpanel",
      "data",
      {
        projectSlug: project.slug,
      },
      undefined,
      "analytics",
      pollingPreferences
    )
  );
}

function addRaindropTask(
  tasks: BackupTask[],
  pollingPreferences?: DashboardPollingPreferences
): void {
  if (tasks.some((task) => task.route === integrationRoute("raindrop", "data"))) return;

  tasks.push(
    dsTask(
      "raindrop:all:30d:UTC",
      integrationRoute("raindrop", "data"),
      300,
      "raindrop",
      "data",
      {},
      undefined,
      "raindrop",
      pollingPreferences
    )
  );
}

function addSentryTasks(
  tasks: BackupTask[],
  project: Project,
  pollingPreferences?: DashboardPollingPreferences
): void {
  if (!project.platforms.some((p) => p.integrations.sentry)) return;
  tasks.push(
    dsTask(
      `sentry:${project.slug}:30d:UTC`,
      integrationRoute("sentry", "data"),
      120,
      "sentry",
      "data",
      {
        projectSlug: project.slug,
      },
      undefined,
      "sentry",
      pollingPreferences
    )
  );
}

function addSeoTasks(
  tasks: BackupTask[],
  project: Project,
  pollingPreferences?: DashboardPollingPreferences
): void {
  for (const platform of project.platforms) {
    const gsc = platform.integrations.googleSearchConsole;
    if (gsc) {
      tasks.push(
        dsTask(
          `seo:${project.slug}:${gsc.siteUrl}:30d:UTC`,
          integrationRoute("google-search-console", "data"),
          300,
          "google-search-console",
          "data",
          { projectSlug: project.slug, siteUrl: gsc.siteUrl },
          undefined,
          "seo",
          pollingPreferences
        )
      );
    }
  }
}

function addAppStoreTasks(
  tasks: BackupTask[],
  project: Project,
  pollingPreferences?: DashboardPollingPreferences
): void {
  if (!project.platforms.some((p) => p.integrations.appStoreConnect)) return;
  tasks.push(
    dsTask(
      `app-store:${project.slug}:30d:UTC`,
      integrationRoute("app-store-connect", "data"),
      900,
      "app-store-connect",
      "data",
      { projectSlug: project.slug },
      "appstore",
      "app-store",
      pollingPreferences
    )
  );
}

function addRoadmapTasks(
  tasks: BackupTask[],
  project: Project,
  pollingPreferences?: DashboardPollingPreferences
): void {
  if (!project.platforms.some((p) => p.integrations.linear)) return;
  tasks.push(
    dsTask(
      `roadmap:${project.slug}`,
      integrationRoute("linear", "roadmap"),
      120,
      "linear",
      "roadmap",
      {
        projectSlug: project.slug,
        limit: 30,
      },
      undefined,
      "roadmap",
      pollingPreferences
    )
  );
}

function addGitHubStarsHistoryTasks(
  tasks: BackupTask[],
  project: Project,
  pollingPreferences?: DashboardPollingPreferences
): void {
  const hasGitHub = project.platforms.some((platform) => platform.integrations.github);
  if (!hasGitHub) return;

  tasks.push(
    dsTask(
      `github-stars-history:${project.slug}:all:none`,
      integrationRoute("github", "stars-history"),
      600,
      "github",
      "stars-history",
      {
        projectSlug: project.slug,
        range: "all",
        forceRefresh: true,
      },
      "github",
      "github-stars",
      pollingPreferences
    )
  );
}

function addShippingTasks(
  tasks: BackupTask[],
  project: Project,
  pollingPreferences?: DashboardPollingPreferences
): void {
  const hasShippingSources = project.platforms.some(
    (p) => p.integrations.github || p.integrations.linear || p.integrations.vercel
  );
  if (!hasShippingSources) return;
  tasks.push(
    dsTask(
      `shipping:${project.slug}:30d:UTC`,
      integrationRoute("shipping", "data"),
      120,
      "shipping",
      "data",
      {
        projectSlug: project.slug,
        limit: 20,
      },
      undefined,
      "shipping",
      pollingPreferences
    )
  );
}

function addOpenCollectiveTasks(
  tasks: BackupTask[],
  project: Project,
  pollingPreferences?: DashboardPollingPreferences
): void {
  for (const platform of project.platforms) {
    const oc = platform.integrations.openCollective;
    if (oc) {
      tasks.push(
        dsTask(
          `open-collective:${oc.slug}:30d:UTC`,
          integrationRoute("open-collective", "data"),
          300,
          "open-collective",
          "data",
          { slug: oc.slug },
          undefined,
          "sponsorship",
          pollingPreferences
        )
      );
    }
  }
}

/**
 * Builds the complete list of backup tasks by iterating projects
 * and their platform integrations.
 */
export function buildBackupTasks(
  projects: Project[],
  pollingPreferences?: DashboardPollingPreferences
): BackupTask[] {
  const tasks: BackupTask[] = [];

  addRaindropTask(tasks, pollingPreferences);

  for (const project of projects) {
    addRevenueTasks(tasks, project, pollingPreferences);
    addAnalyticsTasks(tasks, project, pollingPreferences);
    addSentryTasks(tasks, project, pollingPreferences);
    addSeoTasks(tasks, project, pollingPreferences);
    addAppStoreTasks(tasks, project, pollingPreferences);
    addRoadmapTasks(tasks, project, pollingPreferences);
    addGitHubStarsHistoryTasks(tasks, project, pollingPreferences);
    addShippingTasks(tasks, project, pollingPreferences);
    addOpenCollectiveTasks(tasks, project, pollingPreferences);
  }

  // Health is project-independent
  tasks.push(
    dsTask(
      "health",
      integrationRoute("betterstack", "data"),
      60,
      "betterstack",
      "data",
      {},
      undefined,
      "health",
      pollingPreferences
    )
  );

  return tasks;
}
