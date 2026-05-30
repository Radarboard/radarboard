import type { DataSourceDescriptor } from "@radarboard/integration-sdk/types";

type DbOverrides = Record<string, Record<string, Record<string, unknown>>>;

interface AstroKeyword {
  keyword: string;
  currentRanking: number;
  previousRanking: number;
  rankingChange: number;
  difficulty: number;
  popularity: number;
  appsCount: number;
  lastUpdate: string;
  store: string;
}

interface AstroApp {
  appId: string;
  name: string;
  developer: string;
  platform: string;
  stores: string[];
  keywordCount: number;
  lastUpdate: string;
}

interface AsoKeyword {
  keyword: string;
  currentRanking: number;
  previousRanking: number;
  rankingChange: number;
  difficulty: number;
  popularity: number;
  appsCount: number;
  lastUpdate: string;
  store: string;
}

interface AsoKeywordsSummary {
  total: number;
  top1: number;
  top2: number;
  top3: number;
  top10: number;
  top50: number;
  improving: number;
  declining: number;
  avgRanking: number;
}

interface ProjectPlatform {
  id: string;
  integrations: Record<string, unknown>;
}

interface Project {
  slug: string;
  platforms: ProjectPlatform[];
}

function resolveString(
  overrides: DbOverrides,
  projectSlug: string,
  platformId: string,
  key: string
): string | null {
  const val = overrides[projectSlug]?.[platformId]?.[key];
  return typeof val === "string" && val ? val : null;
}

function buildSummary(keywords: AsoKeyword[]): AsoKeywordsSummary {
  const ranked = keywords.filter((k) => k.currentRanking < 1000);
  return {
    total: keywords.length,
    top1: keywords.filter((k) => k.currentRanking === 1).length,
    top2: keywords.filter((k) => k.currentRanking === 2).length,
    top3: keywords.filter((k) => k.currentRanking === 3).length,
    top10: keywords.filter((k) => k.currentRanking <= 10).length,
    top50: keywords.filter((k) => k.currentRanking <= 50).length,
    improving: keywords.filter((k) => k.rankingChange > 0).length,
    declining: keywords.filter((k) => k.rankingChange < 0).length,
    avgRanking:
      ranked.length > 0
        ? Math.round(ranked.reduce((sum, k) => sum + k.currentRanking, 0) / ranked.length)
        : 0,
  };
}

interface AsoParams {
  storeFilter: string | null;
}

interface ExplicitConfig {
  appId: string;
  store: string;
}

function tryPlatform(
  slug: string,
  platform: ProjectPlatform,
  dbOverrides: DbOverrides
): ExplicitConfig | null {
  const aid =
    resolveString(dbOverrides, slug, platform.id, "astro.appId") ??
    (platform.integrations.astro as { appId?: string } | undefined)?.appId ??
    null;
  const store =
    resolveString(dbOverrides, slug, platform.id, "astro.store") ??
    (platform.integrations.astro as { store?: string } | undefined)?.store ??
    null;
  if (aid && store) return { appId: aid, store };
  return null;
}

function resolveExplicitInProject(
  project: Project,
  dbOverrides: DbOverrides
): ExplicitConfig | null {
  for (const platform of project.platforms) {
    const explicit = tryPlatform(project.slug, platform, dbOverrides);
    if (explicit) return explicit;
  }
  return null;
}

function resolveExplicitConfig(
  projectSlug: string | null,
  allProjects: Project[],
  dbOverrides: DbOverrides
): ExplicitConfig | null {
  if (projectSlug) {
    const project = allProjects.find((p) => p.slug === projectSlug);
    return project ? resolveExplicitInProject(project, dbOverrides) : null;
  }
  for (const project of allProjects) {
    const explicit = resolveExplicitInProject(project, dbOverrides);
    if (explicit) return explicit;
  }
  return null;
}

function findAscAppId(project: Project, dbOverrides: DbOverrides): string | null {
  for (const platform of project.platforms) {
    const id =
      resolveString(dbOverrides, project.slug, platform.id, "appStoreConnect.appId") ??
      (platform.integrations.appStoreConnect as { appId?: string } | undefined)?.appId ??
      null;
    if (id) return id;
  }
  return null;
}

function resolveAscAppId(
  projectSlug: string | null,
  allProjects: Project[],
  dbOverrides: DbOverrides
): string | null {
  if (projectSlug) {
    const project = allProjects.find((p) => p.slug === projectSlug);
    return project ? findAscAppId(project, dbOverrides) : null;
  }
  for (const project of allProjects) {
    const id = findAscAppId(project, dbOverrides);
    if (id) return id;
  }
  return null;
}

async function resolveAppIdAndStores(
  projectSlug: string | null,
  allProjects: Project[],
  dbOverrides: DbOverrides,
  client: { callToolJson: <T>(tool: string, args: Record<string, unknown>) => Promise<T> }
): Promise<{ appId: string; availableStores: string[] } | null> {
  const explicit = resolveExplicitConfig(projectSlug, allProjects, dbOverrides);
  if (explicit) {
    return { appId: explicit.appId, availableStores: [explicit.store] };
  }

  const ascAppId = resolveAscAppId(projectSlug, allProjects, dbOverrides);
  const apps = await client.callToolJson<AstroApp[]>("list_apps", {});
  if (!apps || apps.length === 0) return null;

  const getApp = () => {
    if (apps.length === 1) return apps[0];
    if (ascAppId) return apps.find((a) => a.appId === ascAppId);
    return undefined;
  };
  const app = getApp();
  const resolved = app ?? apps[0];
  if (!resolved) return null;

  return { appId: resolved.appId, availableStores: resolved.stores.sort() };
}

export const astroKeywordsDataSource: DataSourceDescriptor<AsoParams> = {
  action: "keywords",
  description: "App Store keyword rankings from the configured Astro MCP server.",
  cacheTtlSeconds: 900,
  pollingSourceId: "aso-keywords",
  parseParams: (sp) => ({ storeFilter: sp.get("store") || null }),
  buildCacheKey: (params) =>
    `aso-keywords:${params.projectSlug ?? "all"}:${params.storeFilter ?? "all"}`,
  async fetch(params, ctx) {
    const { projectSlug, storeFilter } = params;

    const notConfigured = {
      configured: false,
      appId: "",
      store: undefined as string | undefined,
      availableStores: [] as string[],
      keywords: [] as AsoKeyword[],
      summary: buildSummary([]),
    };

    // 1. Check MCP credential
    const mcpCred = await ctx.resolveCredential("mcp::astro").catch(() => null);
    if (!mcpCred?.url || mcpCred.enabled === "false") return notConfigured;

    if (!ctx.getMcpClient) return notConfigured;
    const client = ctx.getMcpClient(mcpCred.url, mcpCred.authHeader);

    // 2. Resolve appId
    const [allProjects, dbOverrides] = await Promise.all([
      ctx.getAllProjects() as Promise<Project[]>,
      ctx.getProjectIntegrations().catch(() => ({}) as DbOverrides),
    ]);

    const resolved = await resolveAppIdAndStores(
      projectSlug ?? null,
      allProjects,
      dbOverrides,
      client
    );
    if (!resolved) return notConfigured;

    const { appId, availableStores } = resolved;

    // 3. Fetch keywords
    const mcpArgs: Record<string, unknown> = { appId };
    if (storeFilter) mcpArgs.store = storeFilter;

    const raw = await client.callToolJson<AstroKeyword[]>("get_app_keywords", mcpArgs);

    const keywords: AsoKeyword[] = raw
      .map((k) => ({
        keyword: k.keyword,
        currentRanking: k.currentRanking,
        previousRanking: k.previousRanking,
        rankingChange: k.rankingChange,
        difficulty: k.difficulty,
        popularity: k.popularity,
        appsCount: k.appsCount,
        lastUpdate: k.lastUpdate,
        store: k.store,
      }))
      .sort((a, b) => {
        if (a.currentRanking !== b.currentRanking) return a.currentRanking - b.currentRanking;
        if (a.store !== b.store) return a.store.localeCompare(b.store);
        return a.keyword.localeCompare(b.keyword);
      });

    const lastAstroUpdate = keywords.reduce<string | undefined>((latest, kw) => {
      if (!latest || kw.lastUpdate > latest) return kw.lastUpdate;
      return latest;
    }, undefined);

    return {
      configured: true,
      appId,
      store: storeFilter ?? undefined,
      availableStores,
      keywords,
      summary: buildSummary(keywords),
      lastAstroUpdate,
    };
  },
};

// biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
export const astroDataSources: DataSourceDescriptor<any, any>[] = [astroKeywordsDataSource];
