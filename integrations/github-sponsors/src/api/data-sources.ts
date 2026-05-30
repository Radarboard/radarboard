import type { DataSourceContext, DataSourceDescriptor } from "@radarboard/integration-sdk/types";
import { evictSponsorsCache, getSponsorsOverview } from "./client";

interface GHSponsorsParams {
  login: string | null;
}

async function resolveGitHubConfig(ctx: DataSourceContext) {
  const creds = await ctx.resolveCredential("github");
  const token = creds?.token ?? creds?.accessToken;
  if (token) return { token };
  return null;
}

function findLoginInIntegrations(savedProject: Record<string, unknown>): string | null {
  // Project-level override
  const projectGh = (savedProject._project as Record<string, unknown> | undefined)?.github as
    | { owner?: string; repo?: string }
    | undefined;
  if (projectGh?.owner) return projectGh.owner;

  // Platform-level overrides
  for (const [key, platformData] of Object.entries(savedProject)) {
    if (key === "_project") continue;
    const gh = (platformData as Record<string, unknown>)?.github as { owner?: string } | undefined;
    if (gh?.owner) return gh.owner;
  }
  return null;
}

async function resolveLogin(ctx: DataSourceContext): Promise<string | null> {
  const projects = await ctx.getAllProjects();
  const integrations = await ctx.getProjectIntegrations();

  for (const project of projects) {
    const savedProject = integrations[project.slug] ?? {};
    const found = findLoginInIntegrations(savedProject);
    if (found) return found;

    // Static config
    for (const platform of project.platforms) {
      const gh = platform.integrations.github as { owner?: string } | undefined;
      if (gh?.owner) return gh.owner;
    }
  }
  return null;
}

export const githubSponsorsDataSource: DataSourceDescriptor<GHSponsorsParams> = {
  action: "data",
  description: "Returns GitHub Sponsors overview (stats, sponsors, tiers, goal).",
  cacheTtlSeconds: 300,
  pollingSourceId: "sponsorship",
  parseParams: (sp) => ({ login: sp.get("login") }),
  buildCacheKey: (params) => `github-sponsors:${params.login ?? "auto"}`,
  async fetch(params, ctx) {
    let { login } = params;
    if (!login) {
      login = await resolveLogin(ctx);
    }
    if (!login) return { configured: false as const };

    const config = await resolveGitHubConfig(ctx);
    if (!config) return { configured: false as const };

    if (params.forceRefresh) evictSponsorsCache();

    const overview = await getSponsorsOverview(config, login);
    return { configured: true as const, ...overview };
  },
};

// biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
export const githubSponsorsDataSources: DataSourceDescriptor<any, any>[] = [
  githubSponsorsDataSource,
];
