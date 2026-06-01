/**
 * Provider-neutral release activity data source.
 *
 * Release Activity is satisfied by any configured GitHub, Linear, or Vercel
 * provider. Provider-specific widgets still own deep provider surfaces; this
 * aggregate keeps the canonical widget useful as soon as one provider is
 * connected.
 */

import type {
  CommonRouteParams,
  DataSourceContext,
  DataSourceDescriptor,
} from "@radarboard/integration-sdk/types";
import type { ShippingItem } from "@radarboard/types/shipping";

interface ShippingParams {
  limit: number;
}

interface ProviderConfig {
  github: { token: string } | null;
  linear: { apiKey: string } | null;
  vercel: { token: string; teamId?: string } | null;
}

interface ProjectTarget {
  slug: string;
  name: string;
  color: string;
  platformId: string;
  integrations: Record<string, unknown>;
}

type ProjectOverrides = Record<string, Record<string, Record<string, unknown>>>;

const RELEASE_PROVIDERS = [
  { id: "github", name: "GitHub" },
  { id: "linear", name: "Linear" },
  { id: "vercel", name: "Vercel" },
] as const;

const DEFAULT_PROJECT_COLOR = "#777";
const DEFAULT_LIMIT = 20;

function buildProviderList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, or ${names.at(-1)}`;
}

function buildSetupMessage(names = RELEASE_PROVIDERS.map((provider) => provider.name)): string {
  return `Connect ${buildProviderList(names)} to show release activity.`;
}

function toTimeMs(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const timestamp =
    typeof value === "number" ? (value > 1e12 ? value : value * 1000) : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function timeAgo(value: string | number | null | undefined): string {
  const timestamp = toTimeMs(value);
  if (timestamp == null) return "";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function rangeToSince(range: CommonRouteParams["range"]): string | null {
  const days =
    range === "today"
      ? 1
      : range === "7d"
        ? 7
        : range === "15d"
          ? 15
          : range === "30d"
            ? 30
            : range === "3m"
              ? 90
              : range === "1y"
                ? 365
                : null;

  return days == null ? null : new Date(Date.now() - days * 86_400_000).toISOString();
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function overrideValue(
  overrides: ProjectOverrides,
  target: ProjectTarget,
  integrationKey: string,
  fieldKey: string
): unknown {
  return overrides[target.slug]?.[target.platformId]?.[`${integrationKey}.${fieldKey}`] ?? null;
}

function integrationConfig(target: ProjectTarget, integrationKey: string): Record<string, unknown> {
  return asObject(target.integrations[integrationKey]) ?? {};
}

function collectProjectTargets(
  projects: Awaited<ReturnType<DataSourceContext["getAllProjects"]>>,
  projectSlug: string | null
): ProjectTarget[] {
  return projects
    .filter((project) => projectSlug === null || project.slug === projectSlug)
    .flatMap((project) =>
      project.platforms.map((platform) => ({
        slug: project.slug,
        name: project.name,
        color: project.color || DEFAULT_PROJECT_COLOR,
        platformId: platform.id,
        integrations: platform.integrations,
      }))
    );
}

async function resolveProviderConfig(ctx: DataSourceContext): Promise<ProviderConfig> {
  const [github, linear, vercel] = await Promise.all([
    ctx.resolveCredential("github").catch(() => null),
    ctx.resolveCredential("linear").catch(() => null),
    ctx.resolveCredential("vercel").catch(() => null),
  ]);
  const githubToken = github?.token ?? github?.accessToken;

  return {
    github: githubToken ? { token: githubToken } : null,
    linear: linear?.apiKey ? { apiKey: linear.apiKey } : null,
    vercel: vercel?.token ? { token: vercel.token, teamId: vercel.teamId || undefined } : null,
  };
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T | null> {
  const response = await fetch(url, init);
  if (!response.ok) return null;
  return (await response.json()) as T;
}

async function fetchVercelItems({
  config,
  limit,
  params,
  projectTargets,
  projectOverrides,
}: {
  config: NonNullable<ProviderConfig["vercel"]>;
  limit: number;
  params: CommonRouteParams;
  projectTargets: ProjectTarget[];
  projectOverrides: ProjectOverrides;
}): Promise<ShippingItem[]> {
  const targetProjectIds = projectTargets
    .map((target) => {
      const projectId =
        asString(overrideValue(projectOverrides, target, "vercel", "projectId")) ??
        asString(integrationConfig(target, "vercel").projectId);
      return projectId
        ? {
            projectId,
            projectName: target.name,
            projectColor: target.color,
          }
        : null;
    })
    .filter(
      (target): target is { projectId: string; projectName: string; projectColor: string } =>
        target !== null
    );

  const targets =
    targetProjectIds.length > 0
      ? targetProjectIds
      : params.projectSlug
        ? []
        : [{ projectId: null, projectName: "Vercel", projectColor: DEFAULT_PROJECT_COLOR }];
  const since = rangeToSince(params.range);

  const items = await Promise.all(
    targets.map(async (target) => {
      const searchParams = new URLSearchParams({
        limit: String(Math.min(limit, 100)),
        target: "production",
      });
      if (target.projectId) searchParams.set("projectId", target.projectId);
      if (config.teamId) searchParams.set("teamId", config.teamId);

      const data = await fetchJson<{
        deployments?: Array<{
          uid?: string;
          id?: string;
          name?: string;
          url?: string;
          created?: number;
          createdAt?: number;
          ready?: number;
          meta?: { githubCommitMessage?: string };
        }>;
      }>(`https://api.vercel.com/v6/deployments?${searchParams.toString()}`, {
        headers: { Authorization: `Bearer ${config.token}` },
      });

      return (data?.deployments ?? [])
        .filter((deployment) => {
          const created = deployment.ready ?? deployment.createdAt ?? deployment.created;
          const createdMs = toTimeMs(created);
          return since === null || createdMs === null || createdMs >= Date.parse(since);
        })
        .map((deployment): ShippingItem => {
          const created = deployment.ready ?? deployment.createdAt ?? deployment.created;
          const createdAt = toTimeMs(created);
          const title =
            deployment.meta?.githubCommitMessage || `Deployed ${deployment.name ?? "project"}`;
          const url = deployment.url
            ? deployment.url.startsWith("http")
              ? deployment.url
              : `https://${deployment.url}`
            : undefined;
          return {
            id: `vercel:${deployment.uid ?? deployment.id ?? `${target.projectId ?? "all"}:${created}`}`,
            title,
            projectName: deployment.name ?? target.projectName,
            projectColor: target.projectColor,
            source: "vercel",
            url,
            createdAt: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
            timeAgo: timeAgo(created),
          };
        });
    })
  );

  return items.flat();
}

async function fetchLinearItems({
  config,
  limit,
  params,
  projectTargets,
  projectOverrides,
}: {
  config: NonNullable<ProviderConfig["linear"]>;
  limit: number;
  params: CommonRouteParams;
  projectTargets: ProjectTarget[];
  projectOverrides: ProjectOverrides;
}): Promise<ShippingItem[]> {
  const targetTeamIds = new Set(
    projectTargets
      .map((target) => {
        return (
          asString(overrideValue(projectOverrides, target, "linear", "teamId")) ??
          asString(integrationConfig(target, "linear").teamId)
        );
      })
      .filter((teamId): teamId is string => teamId !== null)
  );
  const since = rangeToSince(params.range);
  if (params.projectSlug && targetTeamIds.size === 0) return [];

  const query = `
    query ReleaseActivity($first: Int!, $since: DateTime) {
      issues(
        first: $first
        orderBy: updatedAt
        filter: { completedAt: { gte: $since } }
      ) {
        nodes {
          id
          identifier
          title
          url
          completedAt
          updatedAt
          team { id name }
          project { name color }
        }
      }
    }
  `;

  const data = await fetchJson<{
    data?: {
      issues?: {
        nodes?: Array<{
          id: string;
          identifier?: string;
          title?: string;
          url?: string;
          completedAt?: string | null;
          updatedAt?: string | null;
          team?: { id?: string; name?: string } | null;
          project?: { name?: string; color?: string } | null;
        }>;
      };
    };
  }>("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { first: Math.min(limit, 100), since } }),
  });

  return (data?.data?.issues?.nodes ?? [])
    .filter(
      (issue) => targetTeamIds.size === 0 || (issue.team?.id && targetTeamIds.has(issue.team.id))
    )
    .map((issue): ShippingItem => {
      const completedAt = issue.completedAt ?? issue.updatedAt ?? new Date().toISOString();
      return {
        id: `linear:${issue.id}`,
        title: issue.identifier
          ? `${issue.identifier} ${issue.title ?? "Completed issue"}`
          : (issue.title ?? "Completed issue"),
        projectName: issue.project?.name ?? issue.team?.name ?? "Linear",
        projectColor: issue.project?.color ?? DEFAULT_PROJECT_COLOR,
        source: "linear",
        url: issue.url,
        createdAt: completedAt,
        timeAgo: timeAgo(completedAt),
      };
    });
}

async function fetchGitHubItems({
  config,
  limit,
  params,
  projectTargets,
  projectOverrides,
}: {
  config: NonNullable<ProviderConfig["github"]>;
  limit: number;
  params: CommonRouteParams;
  projectTargets: ProjectTarget[];
  projectOverrides: ProjectOverrides;
}): Promise<ShippingItem[]> {
  const repos = projectTargets
    .map((target) => {
      const overrideRepo = asObject(projectOverrides[target.slug]?.[target.platformId]?.github);
      const baseRepo = integrationConfig(target, "github");
      const owner = asString(overrideRepo?.owner) ?? asString(baseRepo.owner);
      const repo = asString(overrideRepo?.repo) ?? asString(baseRepo.repo);
      return owner && repo
        ? {
            owner,
            repo,
            projectName: target.name,
            projectColor: target.color,
          }
        : null;
    })
    .filter(
      (repo): repo is { owner: string; repo: string; projectName: string; projectColor: string } =>
        repo !== null
    );

  if (repos.length === 0) return [];

  const since = rangeToSince(params.range);
  const items = await Promise.all(
    repos.map(async (repoTarget) => {
      const searchParams = new URLSearchParams({
        state: "closed",
        sort: "updated",
        direction: "desc",
        per_page: String(Math.min(limit, 100)),
      });
      if (since) searchParams.set("since", since);

      const pulls = await fetchJson<
        Array<{
          id: number;
          number: number;
          title?: string;
          html_url?: string;
          merged_at?: string | null;
          updated_at?: string | null;
        }>
      >(
        `https://api.github.com/repos/${repoTarget.owner}/${repoTarget.repo}/pulls?${searchParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: "application/vnd.github+json",
          },
        }
      );

      return (pulls ?? [])
        .filter((pull) => pull.merged_at)
        .map((pull): ShippingItem => {
          const createdAt = pull.merged_at ?? pull.updated_at ?? new Date().toISOString();
          return {
            id: `github:${repoTarget.owner}/${repoTarget.repo}:${pull.id}`,
            title: `Merged #${pull.number}: ${pull.title ?? "Pull request"}`,
            projectName: repoTarget.projectName,
            projectColor: repoTarget.projectColor,
            source: "github",
            url: pull.html_url,
            createdAt,
            timeAgo: timeAgo(createdAt),
          };
        });
    })
  );

  return items.flat();
}

export const shippingDataSource: DataSourceDescriptor<ShippingParams> = {
  action: "data",
  description:
    "Returns recent release activity from configured GitHub, Linear, and Vercel providers.",
  cacheTtlSeconds: 120,
  pollingSourceId: "shipping",
  parseParams: (sp) => ({ limit: Number(sp.get("limit") ?? String(DEFAULT_LIMIT)) }),
  buildCacheKey: (params) =>
    `shipping:${params.projectSlug ?? "all"}:${params.range}:${params.timeZone}:${params.limit}`,
  async fetch(params, ctx) {
    const [providerConfig, projectOverrides, projects] = await Promise.all([
      resolveProviderConfig(ctx),
      ctx.getProjectIntegrations().catch(() => ({})),
      ctx.getAllProjects().catch(() => []),
    ]);
    const configuredProviderNames = RELEASE_PROVIDERS.filter(
      (provider) => providerConfig[provider.id] !== null
    ).map((provider) => provider.name);

    if (configuredProviderNames.length === 0) {
      return {
        configured: false,
        items: [],
        setupMessage: buildSetupMessage(),
        ctaLabel: "Choose integration",
        ctaTarget: "intent:release-activity",
      };
    }

    const limit = Number.isFinite(params.limit) && params.limit > 0 ? params.limit : DEFAULT_LIMIT;
    const projectTargets = collectProjectTargets(projects, params.projectSlug);
    const fetches: Array<Promise<ShippingItem[]>> = [];

    if (providerConfig.github) {
      fetches.push(
        fetchGitHubItems({
          config: providerConfig.github,
          limit,
          params,
          projectTargets,
          projectOverrides,
        }).catch(() => [])
      );
    }
    if (providerConfig.linear) {
      fetches.push(
        fetchLinearItems({
          config: providerConfig.linear,
          limit,
          params,
          projectTargets,
          projectOverrides,
        }).catch(() => [])
      );
    }
    if (providerConfig.vercel) {
      fetches.push(
        fetchVercelItems({
          config: providerConfig.vercel,
          limit,
          params,
          projectTargets,
          projectOverrides,
        }).catch(() => [])
      );
    }

    const items = (await Promise.all(fetches))
      .flat()
      .toSorted((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, limit);

    return {
      configured: true,
      items,
      setupMessage: buildSetupMessage(configuredProviderNames),
      ctaLabel: "Choose integration",
      ctaTarget: "intent:release-activity",
    };
  },
};

// biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
export const shippingDataSources: DataSourceDescriptor<any, any>[] = [shippingDataSource];
