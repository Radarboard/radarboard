import type { DataSourceContext, DataSourceDescriptor } from "@radarboard/integration-sdk/types";
import type { RoadmapInProgressIssue, RoadmapProject } from "@radarboard/types/roadmap";

interface LinearRoadmapParams {
  limit: number;
}

interface LinearIssue {
  id: string;
  identifier?: string | null;
  title?: string | null;
  url?: string | null;
  priority?: number | null;
  updatedAt?: string | null;
  state?: { type?: string | null } | null;
  assignee?: { name?: string | null; avatarUrl?: string | null } | null;
  project?: { id?: string | null; name?: string | null; color?: string | null } | null;
  labels?: { nodes?: Array<{ name?: string | null; color?: string | null }> | null } | null;
  team?: { id?: string | null; name?: string | null; key?: string | null } | null;
}

interface LinearProject {
  id: string;
  name?: string | null;
  progress?: number | null;
  targetDate?: string | null;
  teams?: {
    nodes?: Array<{ id?: string | null; name?: string | null; key?: string | null }> | null;
  } | null;
}

interface LinearRoadmapResponse {
  data?: {
    issues?: { nodes?: LinearIssue[] | null } | null;
    projects?: { nodes?: LinearProject[] | null } | null;
  };
  errors?: Array<{ message?: string }>;
}

type ProjectOverrides = Record<string, Record<string, Record<string, unknown>>>;

const DEFAULT_PROJECT_COLOR = "#777";
const DEFAULT_LIMIT = 50;

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function timeAgo(value: string | null | undefined): string {
  if (!value) return "";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function mapPriority(value: number | null | undefined): RoadmapInProgressIssue["priority"] {
  if (value === 1) return "critical";
  if (value === 2) return "high";
  if (value === 3) return "medium";
  return "low";
}

function resolveMappedTeamIds({
  projectOverrides,
  projectSlug,
  projects,
}: {
  projectOverrides: ProjectOverrides;
  projectSlug: string | null;
  projects: Awaited<ReturnType<DataSourceContext["getAllProjects"]>>;
}): Set<string> {
  if (!projectSlug) return new Set();

  const project = projects.find((entry) => entry.slug === projectSlug);
  if (!project) return new Set();

  const teamIds = project.platforms
    .map((platform) => {
      const override = projectOverrides[project.slug]?.[platform.id]?.["linear.teamId"];
      const config = asObject(platform.integrations.linear);
      return asString(override) ?? asString(config?.teamId);
    })
    .filter((teamId): teamId is string => teamId !== null);

  return new Set(teamIds);
}

function filterByProjectTeam<T extends { team?: { id?: string | null } | null }>(
  items: T[],
  projectSlug: string | null,
  mappedTeamIds: Set<string>
): T[] {
  if (!projectSlug) return items;
  if (mappedTeamIds.size === 0) return [];
  return items.filter((item) => item.team?.id && mappedTeamIds.has(item.team.id));
}

function filterProjectsByTeam(
  projects: LinearProject[],
  projectSlug: string | null,
  mappedTeamIds: Set<string>
): LinearProject[] {
  if (!projectSlug) return projects;
  if (mappedTeamIds.size === 0) return [];
  return projects.filter((project) =>
    project.teams?.nodes?.some((team) => team.id && mappedTeamIds.has(team.id))
  );
}

function countIssuesByProject(issues: LinearIssue[]): Map<string, Map<string, number>> {
  const counts = new Map<string, Map<string, number>>();

  for (const issue of issues) {
    const projectId = issue.project?.id;
    if (!projectId) continue;
    const stateType = issue.state?.type ?? "unstarted";
    const projectCounts = counts.get(projectId) ?? new Map<string, number>();
    projectCounts.set(stateType, (projectCounts.get(stateType) ?? 0) + 1);
    counts.set(projectId, projectCounts);
  }

  return counts;
}

function mapProjects(projects: LinearProject[], issues: LinearIssue[]): RoadmapProject[] {
  const countsByProject = countIssuesByProject(issues);

  return projects
    .map((project): RoadmapProject => {
      const counts = countsByProject.get(project.id) ?? new Map<string, number>();
      const progress = Math.max(0, Math.min(1, project.progress ?? 0));
      return {
        id: project.id,
        name: project.name ?? "Untitled project",
        state: progress > 0 ? "started" : "planned",
        progress,
        targetDate: project.targetDate ?? null,
        health: null,
        issueCountDone: counts.get("completed") ?? 0,
        issueCountInProgress: counts.get("started") ?? 0,
        issueCountOpen:
          (counts.get("backlog") ?? 0) +
          (counts.get("unstarted") ?? 0) +
          (counts.get("triage") ?? 0),
        teams:
          project.teams?.nodes
            ?.map((team) => team.name ?? team.key)
            .filter((team): team is string => Boolean(team)) ?? [],
      };
    })
    .filter((project) => project.progress < 1)
    .sort((left, right) => {
      if (left.targetDate && right.targetDate)
        return left.targetDate.localeCompare(right.targetDate);
      if (left.targetDate) return -1;
      if (right.targetDate) return 1;
      return right.progress - left.progress;
    });
}

function mapInProgressIssues(issues: LinearIssue[]): RoadmapInProgressIssue[] {
  return issues
    .filter((issue) => issue.state?.type === "started")
    .map((issue) => ({
      id: issue.id,
      identifier: issue.identifier ?? "",
      title: issue.title ?? "Untitled issue",
      url: issue.url ?? "",
      priority: mapPriority(issue.priority),
      assignee: issue.assignee?.name
        ? { name: issue.assignee.name, avatarUrl: issue.assignee.avatarUrl ?? null }
        : null,
      projectName: issue.project?.name ?? null,
      projectColor: issue.project?.color ?? DEFAULT_PROJECT_COLOR,
      startedAt: issue.updatedAt ?? "",
      timeInStarted: timeAgo(issue.updatedAt),
      labels:
        issue.labels?.nodes
          ?.map((label) => ({
            name: label.name ?? "",
            color: label.color ?? DEFAULT_PROJECT_COLOR,
          }))
          .filter((label) => label.name.length > 0) ?? [],
    }));
}

async function fetchLinearRoadmap(apiKey: string, limit: number): Promise<LinearRoadmapResponse> {
  const headers = new Headers();
  headers.set("Authorization", apiKey);
  headers.set("Content-Type", "application/json");
  const query = `
    query RadarboardRoadmap($issueFirst: Int!, $projectFirst: Int!) {
      issues(first: $issueFirst) {
        nodes {
          id
          identifier
          title
          url
          priority
          updatedAt
          state { type }
          assignee { name avatarUrl }
          project { id name color }
          labels { nodes { name color } }
          team { id name key }
        }
      }
      projects(first: $projectFirst) {
        nodes {
          id
          name
          progress
          targetDate
          teams { nodes { id name key } }
        }
      }
    }
  `;
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      variables: {
        issueFirst: Math.min(limit, 100),
        projectFirst: Math.min(limit, 100),
      },
    }),
  });

  if (!response.ok) {
    return { errors: [{ message: `Linear returned ${response.status}` }] };
  }

  return (await response.json()) as LinearRoadmapResponse;
}

export const linearRoadmapDataSource: DataSourceDescriptor<LinearRoadmapParams> = {
  action: "roadmap",
  description: "Returns active Linear projects and in-progress issue work for the Roadmap widget.",
  cacheTtlSeconds: 120,
  pollingSourceId: "roadmap",
  parseParams: (sp) => ({ limit: Number(sp.get("limit") ?? String(DEFAULT_LIMIT)) }),
  buildCacheKey: (params) => `roadmap:${params.projectSlug ?? "all"}:${params.limit}`,
  async fetch(params, ctx) {
    const credentials = await ctx.resolveCredential("linear");
    if (!credentials?.apiKey) {
      return { configured: false, projects: [], inProgressIssues: [] };
    }

    const limit = Number.isFinite(params.limit) && params.limit > 0 ? params.limit : DEFAULT_LIMIT;
    const [projectOverrides, allProjects, linearResponse] = await Promise.all([
      ctx.getProjectIntegrations().catch(() => ({})),
      ctx.getAllProjects().catch(() => []),
      fetchLinearRoadmap(credentials.apiKey, limit),
    ]);

    if (linearResponse.errors?.length) {
      return { configured: true, projects: [], inProgressIssues: [] };
    }

    const mappedTeamIds = resolveMappedTeamIds({
      projectOverrides,
      projectSlug: params.projectSlug,
      projects: allProjects,
    });
    const issues = filterByProjectTeam(
      linearResponse.data?.issues?.nodes ?? [],
      params.projectSlug,
      mappedTeamIds
    );
    const projects = filterProjectsByTeam(
      linearResponse.data?.projects?.nodes ?? [],
      params.projectSlug,
      mappedTeamIds
    );

    return {
      configured: true,
      projects: mapProjects(projects, issues),
      inProgressIssues: mapInProgressIssues(issues).slice(0, limit),
    };
  },
};

// biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
export const linearRoadmapDataSources: DataSourceDescriptor<any, any>[] = [linearRoadmapDataSource];
