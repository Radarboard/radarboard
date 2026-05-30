import type { DataSourceContext, DataSourceDescriptor } from "@radarboard/integration-sdk/types";
import type { RoadmapInProgressIssue, RoadmapProject } from "@radarboard/types/roadmap";
import type { LinearConfig, LinearProject, LinearStartedIssue } from "../types";
import { getActiveProjects, getInProgressIssues } from "./client";

interface RoadmapParams {
  limit: number;
}

function priorityToLabel(priority: number): "critical" | "high" | "medium" | "low" {
  switch (priority) {
    case 1:
      return "critical";
    case 2:
      return "high";
    case 3:
      return "medium";
    default:
      return "low";
  }
}

function formatAge(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function projectStateToNormalized(state: string): "planned" | "started" | "paused" {
  switch (state) {
    case "started":
      return "started";
    case "paused":
      return "paused";
    default:
      return "planned";
  }
}

function projectHealthToNormalized(
  health: string | null
): "onTrack" | "atRisk" | "offTrack" | null {
  switch (health) {
    case "onTrack":
      return "onTrack";
    case "atRisk":
      return "atRisk";
    case "offTrack":
      return "offTrack";
    default:
      return null;
  }
}

function mapProject(project: LinearProject): RoadmapProject {
  const issues = project.issues.nodes;
  let done = 0;
  let inProgress = 0;
  let open = 0;
  for (const issue of issues) {
    switch (issue.state.type) {
      case "completed":
        done++;
        break;
      case "started":
        inProgress++;
        break;
      default:
        open++;
        break;
    }
  }

  return {
    id: project.id,
    name: project.name,
    state: projectStateToNormalized(project.state),
    progress: project.progress,
    targetDate: project.targetDate,
    health: projectHealthToNormalized(project.health),
    issueCountDone: done,
    issueCountInProgress: inProgress,
    issueCountOpen: open,
    teams: project.teams.nodes.map((t) => t.name),
  };
}

function mapStartedIssue(
  issue: LinearStartedIssue,
  projectName: string,
  projectColor: string
): RoadmapInProgressIssue {
  const startedDate = issue.startedAt ?? issue.createdAt;

  return {
    id: `linear-${issue.id}`,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    priority: priorityToLabel(issue.priority),
    assignee: issue.assignee,
    projectName,
    projectColor,
    startedAt: startedDate,
    timeInStarted: formatAge(startedDate),
    labels: issue.labels.nodes.map((l) => ({ name: l.name, color: l.color })),
  };
}

async function resolveConfig(ctx: DataSourceContext): Promise<LinearConfig | null> {
  const creds = await ctx.resolveCredential("linear");
  if (creds?.apiKey) return { apiKey: creds.apiKey };
  return null;
}

type ProjectEntry = Awaited<ReturnType<DataSourceContext["getAllProjects"]>>[number];

function resolveLinearPlatforms(projects: ProjectEntry[]) {
  return projects.flatMap((p) =>
    p.platforms.flatMap((pl) => {
      const integration = pl.integrations.linear as
        | { teamId?: string; labelNames?: string[] }
        | undefined;
      if (!integration) return [];
      return [{ project: p, linear: integration }];
    })
  );
}

function deduplicateAndSortProjects(results: PromiseSettledResult<unknown[]>[]): RoadmapProject[] {
  const projectMap = new Map<string, RoadmapProject>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const project of result.value as LinearProject[]) {
      if (!projectMap.has(project.id)) {
        projectMap.set(project.id, mapProject(project));
      }
    }
  }

  const stateOrder: Record<string, number> = { started: 0, planned: 1, paused: 2 };
  return Array.from(projectMap.values()).sort((a, b) => {
    const stateDiff = (stateOrder[a.state] ?? 9) - (stateOrder[b.state] ?? 9);
    if (stateDiff !== 0) return stateDiff;
    if (a.targetDate && b.targetDate) return a.targetDate.localeCompare(b.targetDate);
    if (a.targetDate) return -1;
    if (b.targetDate) return 1;
    return a.name.localeCompare(b.name);
  });
}

function collectAndSortIssues(
  results: PromiseSettledResult<RoadmapInProgressIssue[]>[]
): RoadmapInProgressIssue[] {
  const issues: RoadmapInProgressIssue[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") issues.push(...result.value);
  }
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  issues.sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));
  return issues;
}

export const linearRoadmapDataSource: DataSourceDescriptor<RoadmapParams> = {
  action: "roadmap",
  description: "Fetches active Linear projects with progress and in-progress issues.",
  cacheTtlSeconds: 120,
  pollingSourceId: "roadmap",
  parseParams: (sp) => ({ limit: Number(sp.get("limit") ?? "30") }),
  buildCacheKey: (params) => `roadmap:${params.projectSlug ?? "all"}`,
  async fetch(params, ctx) {
    const { projectSlug, limit } = params;

    const config = await resolveConfig(ctx);
    if (!config) return { configured: false as const, projects: [], inProgressIssues: [] };

    const allProjects = await ctx.getAllProjects();
    const projects = projectSlug ? allProjects.filter((p) => p.slug === projectSlug) : allProjects;

    const linearPlatforms = resolveLinearPlatforms(projects);

    if (linearPlatforms.length === 0) {
      return { configured: false as const, projects: [], inProgressIssues: [] };
    }

    // Fetch projects and in-progress issues in parallel across all teams
    const projectResults = await Promise.allSettled(
      linearPlatforms.map(({ linear }) =>
        getActiveProjects(config, { teamId: linear.teamId ?? "" })
      )
    );

    const issueResults = await Promise.allSettled(
      linearPlatforms.map(({ project, linear }) =>
        getInProgressIssues(config, {
          teamId: linear.teamId ?? "",
          limit,
        }).then((issues) =>
          issues.map((issue) => mapStartedIssue(issue, project.name, project.color))
        )
      )
    );

    const sortedProjects = deduplicateAndSortProjects(projectResults);
    const inProgressIssues = collectAndSortIssues(issueResults);

    return {
      configured: true as const,
      projects: sortedProjects,
      inProgressIssues: inProgressIssues.slice(0, limit),
    };
  },
};

// biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
export const linearDataSources: DataSourceDescriptor<any, any>[] = [linearRoadmapDataSource];
