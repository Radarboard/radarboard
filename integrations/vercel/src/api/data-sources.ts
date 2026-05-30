import type {
  CommonRouteParams,
  DataSourceContext,
  DataSourceDescriptor,
} from "@radarboard/integration-sdk/types";
import { isSameDayInTimeZone } from "@radarboard/utils/timezone";
import { vercelDeploymentDelta } from "../events/delta";
import type { VercelConfig } from "../types";
import { getProjectDomains, getRecentDeployments, listProjects } from "./client";

const VERCEL_PALETTE = [
  "#5b8af5",
  "#3fb950",
  "#f5c542",
  "#e63946",
  "#8b5cf6",
  "#f97316",
  "#EC4899",
  "#3B82F6",
];

function vercelProjectColor(_name: string, index: number): string {
  return VERCEL_PALETTE[index % VERCEL_PALETTE.length] ?? "#888";
}

async function resolveConfig(ctx: DataSourceContext): Promise<VercelConfig | null> {
  const creds = await ctx.resolveCredential("vercel");
  if (creds?.token) return { token: creds.token, teamId: creds.teamId || undefined };
  return null;
}

interface DeploymentsParams {
  limit: number;
}

export const vercelDeploymentsDataSource: DataSourceDescriptor<DeploymentsParams> = {
  action: "deployments",
  description: "Fetches production deployments and project summaries from Vercel.",
  cacheTtlSeconds: 120,
  pollingSourceId: "vercel-deployments",
  evictPrefixes: ["vercel:"],
  parseParams: (sp) => ({ limit: Number(sp.get("limit") ?? "100") }),
  buildCacheKey: (params) =>
    `vercel-deployments:${params.projectSlug ?? "all"}:${params.range}:${params.timeZone}`,
  async fetch(params, ctx) {
    const { limit, range, timeZone } = params;
    const config = await resolveConfig(ctx);
    if (!config) return { configured: false as const, deployments: [], projects: [] };

    const vercelProjects = await listProjects(config);
    if (vercelProjects.length === 0)
      return { configured: true as const, deployments: [], projects: [] };

    const summaries = vercelProjects.map((p, i) => {
      const prod =
        // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
        p.targets?.production ?? p.latestDeployments?.find((d: any) => d.target === "production");
      return {
        id: p.id,
        name: p.name,
        framework: p.framework,
        latestProductionState: prod?.readyState ?? null,
        latestProductionUrl: prod?.url ?? null,
        latestProductionReady: prod?.ready ?? null,
        primaryDomain: p.link ? `${p.link.org}/${p.link.repo}` : null,
        projectColor: vercelProjectColor(p.name, i),
      };
    });

    const colorMap = new Map(summaries.map((s) => [s.id, s.projectColor]));
    const nameMap = new Map(summaries.map((s) => [s.id, s.name]));

    const deploymentsResults = await Promise.allSettled(
      vercelProjects.map((vp, i) =>
        getRecentDeployments(config, {
          projectId: vp.id,
          target: "production",
          limit,
        }).then((deploys) =>
          deploys.map((d) => ({
            id: d.uid,
            url: d.url,
            inspectorUrl: d.inspectorUrl,
            state: d.state,
            readyState: d.readyState,
            target: d.target,
            created: d.created,
            buildingAt: d.buildingAt,
            ready: d.ready,
            buildDuration: d.ready && d.buildingAt ? d.ready - d.buildingAt : 0,
            commitMessage: d.meta?.githubCommitMessage ?? null,
            commitSha: d.meta?.githubCommitSha ?? null,
            commitAuthor: d.meta?.githubCommitAuthorLogin ?? null,
            branch: d.meta?.githubCommitRef ?? null,
            projectId: vp.id,
            projectName: nameMap.get(vp.id) ?? vp.name,
            projectColor: colorMap.get(vp.id) ?? vercelProjectColor(vp.name, i),
            creatorUsername: d.creator?.username ?? "unknown",
          }))
        )
      )
    );

    // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
    const deployments: any[] = [];
    for (const r of deploymentsResults) {
      if (r.status === "fulfilled") deployments.push(...r.value);
    }
    const filteredDeployments =
      range === "today"
        ? deployments.filter((deployment) => isSameDayInTimeZone(deployment.created, timeZone))
        : deployments;
    filteredDeployments.sort((a, b) => b.created - a.created);

    return {
      configured: true as const,
      deployments: filteredDeployments,
      projects: summaries,
    };
  },
  delta: {
    // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
    extractData: (data: any) => data.deployments ?? [],
    detector: vercelDeploymentDelta,
    // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
    shouldDetect: (data: any) => data.configured !== false && "deployments" in data,
  },
};

export const vercelDomainsDataSource: DataSourceDescriptor = {
  action: "domains",
  description: "Fetches domains across all Vercel projects.",
  cacheTtlSeconds: 600,
  pollingSourceId: "vercel-domains",
  evictPrefixes: ["vercel:"],
  buildCacheKey: (params) => `vercel-domains:${params.projectSlug ?? "all"}`,
  async fetch(_params: CommonRouteParams, ctx: DataSourceContext) {
    const config = await resolveConfig(ctx);
    if (!config) return { configured: false as const, domains: [] };

    const vercelProjects = await listProjects(config);
    if (vercelProjects.length === 0) return { configured: true as const, domains: [] };

    const results = await Promise.allSettled(
      vercelProjects.map((vp, i) =>
        getProjectDomains(config, vp.id).then((domains) =>
          domains.map((d) => ({
            name: d.name,
            verified: d.verified,
            configured: d.configured,
            projectId: vp.id,
            projectName: vp.name,
            projectColor: vercelProjectColor(vp.name, i),
          }))
        )
      )
    );

    // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
    const domains: any[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") domains.push(...r.value);
    }

    domains.sort((a, b) => {
      if (a.verified !== b.verified) return a.verified ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

    return { configured: true as const, domains };
  },
};

interface BillingChargeItem {
  serviceName?: string;
  chargeDescription?: string;
  billedCost?: number;
}

export const vercelBillingDataSource: DataSourceDescriptor = {
  action: "billing",
  description: "Fetches current month billing charges and cost breakdown from Vercel.",
  cacheTtlSeconds: 3600,
  buildCacheKey: () => "vercel-billing:current-month",
  async fetch(_params: CommonRouteParams, ctx: DataSourceContext) {
    const config = await resolveConfig(ctx);
    if (!config) return { configured: false as const, total: null, breakdown: [] };

    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const to = now.toISOString().split("T")[0];

    const teamParam = config.teamId ? `&teamId=${config.teamId}` : "";
    const url = `https://api.vercel.com/billing/charges?from=${from}&to=${to}${teamParam}`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${config.token}` },
      });

      if (res.status === 403 || res.status === 401) {
        return { configured: true as const, total: null, breakdown: [] };
      }
      if (!res.ok) {
        return { configured: true as const, total: null, breakdown: [] };
      }

      // Vercel returns JSONL (newline-delimited JSON) — parse each line
      const text = await res.text();
      const lines = text.trim().split("\n").filter(Boolean);
      const charges: BillingChargeItem[] = lines.map((line) => {
        try {
          return JSON.parse(line) as BillingChargeItem;
        } catch {
          return {} as BillingChargeItem;
        }
      });

      // Aggregate by service name
      const byService = new Map<string, number>();
      let total = 0;
      for (const charge of charges) {
        const amount = charge.billedCost ?? 0;
        total += amount;
        const label = charge.serviceName ?? charge.chargeDescription ?? "Other";
        byService.set(label, (byService.get(label) ?? 0) + amount);
      }

      const breakdown = Array.from(byService.entries())
        .map(([label, amount]) => ({ label, amount }))
        .sort((a, b) => b.amount - a.amount);

      return { configured: true as const, total, breakdown };
    } catch {
      return { configured: true as const, total: null, breakdown: [] };
    }
  },
};

// biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
export const vercelDataSources: DataSourceDescriptor<any, any>[] = [
  vercelDeploymentsDataSource,
  vercelDomainsDataSource,
  vercelBillingDataSource,
];
