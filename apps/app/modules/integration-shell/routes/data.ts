/**
 * Unified data-fetching route for all integrations.
 * GET /api/integrations/[integration]/[action]
 *
 * Dispatches to DataSourceDescriptor implementations from the registry and
 * absorbs the remaining app-shell analytics/GitHub bridge actions so no
 * concrete provider folders are needed under apps/app/app/api/integrations.
 */

import "@/lib/integrations-init";

import { getRepository } from "@radarboard/integration-github/client";
import {
  browseGitHubRepositoryContents,
  getGitHubRateLimitError,
  listGitHubRepos,
  parseGitHubRepositoryContents,
} from "@radarboard/integration-github/server/repo-browser";
import {
  initializeGitHubStarTracking,
  listGitHubStarTrackingStates,
  type RepoRef,
  resolveTrackedRepos as resolveTrackedGitHubRepos,
} from "@radarboard/integration-github/server/star-tracking";
import { findDataSource } from "@radarboard/integration-sdk/registry";
import { integrationRoute } from "@radarboard/integration-sdk/routes";
import type { TimeRange } from "@radarboard/integration-sdk/types";
import { createLogger } from "@radarboard/logger/logger";
import { withLogging } from "@radarboard/logger/middleware";
import { API_ROUTE_PATTERNS } from "@radarboard/types/api-routes";
import { normalizeTimeZone } from "@radarboard/utils/timezone";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCacheEntry, getCacheKeysByRoute, withCache } from "@/db/cache";
import {
  getCacheRepo,
  getCredentialRepo,
  getGitHubStarHistoryRepo,
  getSettingsRepo,
} from "@/db/repository";
import { errorJson, parseSearchParams } from "@/lib/api";
import { maybeAutoEmbed } from "@/lib/auto-embed";
import { CircuitOpenError, withCircuitBreaker } from "@/lib/circuit-breaker";
import { resolveGitHubConfig } from "@/lib/credential-resolver";
import { buildDataSourceContext } from "@/lib/data-source-context";
import { emitDebugEvent } from "@/lib/debug-events";
import { recordHealth } from "@/lib/health-tracker";
import { emitNotificationEvents } from "@/lib/notifications";
import { getDashboardPollingPreferences, resolvePollingTtlSeconds } from "@/lib/polling-settings";

const log = createLogger("api/integrations");
const ANALYTICS_PROVIDERS = ["openpanel", "umami"] as const;
const VALID_RANGES = new Set(["today", "7d", "15d", "30d", "3m", "1y", "all"]);
const integrationCommonQuerySchema = z.object({
  project: z.string().optional(),
  range: z.string().optional(),
  timezone: z.string().optional(),
  refresh: z.string().optional(),
});
const gitHubReposQuerySchema = z.object({
  q: z.string().optional(),
});
const gitHubContentsQuerySchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  path: z.string().optional(),
});
type IntegrationCommonParams = {
  projectSlug: string | null;
  range: TimeRange;
  timeZone: string;
  forceRefresh: boolean;
};
type ParsedIntegrationCommonParams =
  | { ok: true; data: IntegrationCommonParams }
  | { ok: false; response: Response };

function parseRange(raw: string | null): TimeRange {
  return VALID_RANGES.has(raw ?? "") ? (raw as TimeRange) : "30d";
}

function parseCommonIntegrationParams(
  searchParams: URLSearchParams
): ParsedIntegrationCommonParams {
  const parsed = parseSearchParams(searchParams, integrationCommonQuerySchema);
  if (!parsed.ok) {
    return { ok: false, response: parsed.response };
  }

  return {
    ok: true,
    data: {
      projectSlug: parsed.data.project ?? null,
      range: parseRange(parsed.data.range ?? null),
      timeZone: normalizeTimeZone(parsed.data.timezone),
      forceRefresh: parsed.data.refresh === "1",
    },
  };
}

async function evictCaches(integration: string, prefixes: string[]): Promise<void> {
  for (const prefix of prefixes) {
    try {
      const evictModule = await import(`@radarboard/integration-${integration}/client`);
      if (typeof evictModule.evictCacheByPrefix === "function") {
        evictModule.evictCacheByPrefix(prefix);
      } else if (typeof evictModule.evictSponsorsCache === "function") {
        evictModule.evictSponsorsCache();
      }
    } catch {
      // Integration may not have an eviction function; safe to skip.
    }
  }
}

function runDeltaDetection(
  dataSource: {
    delta?: {
      shouldDetect?: (d: unknown) => boolean;
      extractData: (d: unknown) => unknown;
      detector: { detect: (d: unknown, p: string | null) => unknown[] };
    };
  },
  data: unknown,
  projectSlug: string | null
): void {
  if (!dataSource.delta) return;
  const shouldDetect = dataSource.delta.shouldDetect ? dataSource.delta.shouldDetect(data) : true;
  if (!shouldDetect) return;
  const extracted = dataSource.delta.extractData(data);
  if (!extracted) return;
  const events = dataSource.delta.detector.detect(extracted, projectSlug);
  if (events.length > 0) {
    emitNotificationEvents(
      events as import("@radarboard/types/notifications").EmitNotificationInput[]
    );
  }
}

function resolveAnalyticsProvider(action: string) {
  for (const provider of ANALYTICS_PROVIDERS) {
    const ds = findDataSource(provider, action);
    if (ds) return { provider, dataSource: ds };
  }
  return null;
}

type SavedIntegrations = Record<string, Record<string, Record<string, unknown>>>;

async function resolveTrackedReposFromAppState(): Promise<RepoRef[]> {
  const settingsRepo = getSettingsRepo();
  const [{ PROJECTS }, widgetLayout, savedIntegrations] = await Promise.all([
    import("@/config/projects"),
    settingsRepo.getWidgetLayout().catch(() => null),
    settingsRepo.getProjectIntegrations().catch(() => ({}) as SavedIntegrations),
  ]);

  return resolveTrackedGitHubRepos(
    PROJECTS as unknown as Array<{
      slug: string;
      platforms: Array<{ id: string; integrations: Record<string, unknown> }>;
    }>,
    widgetLayout,
    savedIntegrations
  );
}

export async function handleAnalyticsAction(request: Request, action: string) {
  const resolved = resolveAnalyticsProvider(action);
  if (!resolved) {
    for (const provider of ANALYTICS_PROVIDERS) {
      const demoResponse = await serveDemoCacheByRoute(`/api/integrations/${provider}/${action}`);
      if (demoResponse) return demoResponse;
    }
    return errorJson(404, `No analytics provider found for action: ${action}`);
  }

  const { provider, dataSource } = resolved;
  const searchParams = new URL(request.url).searchParams;
  const parsedCommon = parseCommonIntegrationParams(searchParams);
  if (!parsedCommon.ok) return parsedCommon.response;
  const { projectSlug, range, timeZone, forceRefresh } = parsedCommon.data;
  const extraParams = dataSource.parseParams?.(searchParams) ?? {};
  const mergedParams = { ...extraParams, projectSlug, range, timeZone, forceRefresh };
  const ctx = buildDataSourceContext();
  const cacheKey = `analytics:${action}:${projectSlug ?? "all"}:${range}:${timeZone}`;
  const pollingPreferences = await getDashboardPollingPreferences();
  const circuitKey = `analytics/${action}`;
  const startedAt = Date.now();

  try {
    const { data, _stale, _fetchedAt } = await withCircuitBreaker(circuitKey, () =>
      withCache({
        key: cacheKey,
        route: `/api/integrations/analytics/${action}`,
        ttlSeconds: resolvePollingTtlSeconds(
          dataSource.pollingSourceId,
          dataSource.cacheTtlSeconds,
          pollingPreferences
        ),
        forceRefresh,
        fetchFn: async () => {
          const result = (await dataSource.fetch(mergedParams, ctx)) as Record<string, unknown>;
          if (result.configured === false) {
            const fallback = ANALYTICS_PROVIDERS.find((candidate) => candidate !== provider);
            if (fallback) {
              const fallbackDs = findDataSource(fallback, action);
              if (fallbackDs) {
                return fallbackDs.fetch(mergedParams, ctx);
              }
            }
          }
          return result;
        },
      })
    );

    const payload = (typeof data === "object" && data !== null ? data : { data }) as Record<
      string,
      unknown
    >;
    const durationMs = Date.now() - startedAt;
    recordHealth(`analytics/${action}`, true, durationMs);
    const ttl = resolvePollingTtlSeconds(
      dataSource.pollingSourceId,
      dataSource.cacheTtlSeconds,
      pollingPreferences
    );
    return NextResponse.json(
      { ...payload, _stale, _fetchedAt },
      {
        headers: {
          "Cache-Control": `public, max-age=${Math.min(ttl, 120)}, stale-while-revalidate=${ttl}`,
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const durationMs = Date.now() - startedAt;
    recordHealth(`analytics/${action}`, false, durationMs, message);
    log.error(`Analytics request failed: ${action} (provider=${provider})`, { error });
    return errorJson(500, message, { configured: true });
  }
}

async function handleGitHubRepos(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const parsed = parseSearchParams(new URL(request.url).searchParams, gitHubReposQuerySchema);
    if (!parsed.ok) return parsed.response;
    const query = parsed.data.q;
    const config = await resolveGitHubConfig();

    if (!config?.token) {
      await emitDebugEvent({
        level: "warn",
        source: "api/github/repos",
        eventType: "github.repos.rejected",
        message: "GitHub repositories request rejected: missing token",
        requestId,
        entityType: "integration",
        entityId: "github",
        status: "rejected",
        metadata: { query },
      });
      return errorJson(
        401,
        "GitHub not connected. Connect GitHub in Integrations settings to view your repositories."
      );
    }

    try {
      const repos = await listGitHubRepos(config, query ?? null);
      await emitDebugEvent({
        level: "info",
        source: "api/github/repos",
        eventType: "github.repos.completed",
        message: "GitHub repositories request completed",
        requestId,
        entityType: "integration",
        entityId: "github",
        status: "completed",
        durationMs: Date.now() - startedAt,
        metadata: { query, count: repos.length },
      });
      return NextResponse.json({ repos });
    } catch (error) {
      const response =
        error && typeof error === "object" && "response" in error
          ? ((error as { response?: Response }).response ?? undefined)
          : undefined;
      log.error("GitHub API error", {
        error,
        status: response?.status,
      });
      await emitDebugEvent({
        level: "error",
        source: "api/github/repos",
        eventType: "github.repos.failed",
        message: "GitHub repositories request failed",
        requestId,
        entityType: "integration",
        entityId: "github",
        status: "failed",
        durationMs: Date.now() - startedAt,
        metadata: { query, status: response?.status ?? null },
      });

      const rateLimitError = getGitHubRateLimitError(response);
      return rateLimitError
        ? errorJson(429, rateLimitError)
        : errorJson(response?.status ?? 500, `GitHub API returned ${response?.status ?? 500}`);
    }
  } catch (error) {
    log.error("Failed to fetch GitHub repos", { error });
    return errorJson(500, "Failed to fetch GitHub repos");
  }
}

async function handleGitHubContents(request: Request) {
  try {
    const parsed = parseSearchParams(new URL(request.url).searchParams, gitHubContentsQuerySchema);
    if (!parsed.ok) return parsed.response;
    const { owner, repo, path = "" } = parsed.data;

    if (!owner || !repo) {
      return errorJson(400, "Missing required parameters: owner and repo");
    }

    const config = await resolveGitHubConfig();
    if (!config?.token) {
      return errorJson(401, "GitHub not connected. Connect GitHub in Integrations settings.");
    }

    const response = await browseGitHubRepositoryContents(config, { owner, repo, path });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      log.error("GitHub contents API error", { status: response.status, body: errorText });
      return errorJson(response.status, `GitHub API returned ${response.status}`);
    }

    return NextResponse.json(await parseGitHubRepositoryContents(response, path));
  } catch (error) {
    log.error("Failed to fetch repository contents", { error });
    return errorJson(500, "Failed to fetch repository contents");
  }
}

async function handleGitHubStarTrackingGet() {
  try {
    const repos = await resolveTrackedReposFromAppState();
    const historyRepo = getGitHubStarHistoryRepo();
    return NextResponse.json({ repos: await listGitHubStarTrackingStates(repos, historyRepo) });
  } catch (error) {
    log.error("Failed to fetch GitHub star tracking states", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorJson(500, message);
  }
}

async function handleGitHubStarTrackingPost() {
  try {
    const repos = await resolveTrackedReposFromAppState();
    if (repos.length === 0) {
      return errorJson(400, "No GitHub repos resolved for star tracking");
    }

    const creds = await getCredentialRepo().getCredential("github");
    const token = creds?.token ?? creds?.accessToken ?? "";
    if (!token) {
      return errorJson(400, "GitHub credentials are not configured");
    }

    const historyRepo = getGitHubStarHistoryRepo();
    const cacheRepo = getCacheRepo();
    return NextResponse.json({
      repos: await initializeGitHubStarTracking({
        repos,
        token,
        historyRepo,
        cacheRepo,
        getRepository,
        starsHistoryRoute: integrationRoute("github", "stars-history"),
      }),
    });
  } catch (error) {
    log.error("Failed to initialize GitHub star tracking", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorJson(500, message);
  }
}

/** In demo mode, serve cached data for integrations that aren't registered. */
async function serveDemoCacheByRoute(routePath: string): Promise<Response | null> {
  try {
    const settings = getSettingsRepo();
    const wl = await settings.getWidgetLayout();
    if (!wl?.preferences?.demoMode) return null;
    const cacheKeys = await getCacheKeysByRoute(routePath);
    if (cacheKeys.length === 0) return null;
    const cached = await getCacheEntry(cacheKeys[0]!);
    return cached ? NextResponse.json(cached.data) : null;
  } catch {
    return null;
  }
}

/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: integration dispatch handles caching, circuit breaking, logging, and error fallbacks. */
async function handleRegistryIntegrationAction(
  request: Request,
  integration: string,
  action: string
) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const dataSource = findDataSource(integration, action);
  if (!dataSource) {
    const demoResponse = await serveDemoCacheByRoute(`/api/integrations/${integration}/${action}`);
    if (demoResponse) return demoResponse;

    await emitDebugEvent({
      level: "warn",
      source: "api/integrations",
      eventType: "integration.request.rejected",
      message: "Unknown integration data source",
      requestId,
      entityType: "integration",
      entityId: `${integration}/${action}`,
      status: "rejected",
      metadata: { integration, action },
    });
    return errorJson(404, `Unknown data source: ${integration}/${action}`);
  }

  const searchParams = new URL(request.url).searchParams;
  const parsedCommon = parseCommonIntegrationParams(searchParams);
  if (!parsedCommon.ok) return parsedCommon.response;
  const { projectSlug, range, timeZone, forceRefresh } = parsedCommon.data;

  const extraParams = dataSource.parseParams?.(searchParams) ?? {};
  const mergedParams = { ...extraParams, projectSlug, range, timeZone, forceRefresh };

  if (forceRefresh && dataSource.evictPrefixes) {
    await evictCaches(integration, dataSource.evictPrefixes);
  }

  const ctx = buildDataSourceContext();
  const routePath = `/api/integrations/${integration}/${action}`;
  const cacheKey = dataSource.buildCacheKey
    ? dataSource.buildCacheKey(mergedParams)
    : `${integration}:${action}:${projectSlug ?? "all"}:${range}:${timeZone}`;
  const pollingPreferences = await getDashboardPollingPreferences();

  await emitDebugEvent({
    level: "info",
    source: "api/integrations",
    eventType: "integration.request.started",
    message: "Integration request started",
    projectSlug,
    requestId,
    entityType: "integration",
    entityId: `${integration}/${action}`,
    status: "started",
    metadata: {
      integration,
      action,
      range,
      timeZone,
      forceRefresh,
      cacheKey,
    },
  });

  const circuitKey = `${integration}/${action}`;

  try {
    const { data, _stale, _fetchedAt } = await withCircuitBreaker(circuitKey, () =>
      withCache({
        key: cacheKey,
        route: routePath,
        ttlSeconds: resolvePollingTtlSeconds(
          dataSource.pollingSourceId,
          dataSource.cacheTtlSeconds,
          pollingPreferences
        ),
        forceRefresh,
        fetchFn: () => dataSource.fetch(mergedParams, ctx),
      })
    );

    if (!_stale) {
      runDeltaDetection(dataSource, data, projectSlug);
      maybeAutoEmbed(integration, action, data, projectSlug);
    }

    const payload = (typeof data === "object" && data !== null ? data : { data }) as Record<
      string,
      unknown
    >;
    const completedDurationMs = Date.now() - startedAt;
    recordHealth(`${integration}/${action}`, true, completedDurationMs);
    await emitDebugEvent({
      level: "info",
      source: "api/integrations",
      eventType: "integration.request.completed",
      message: "Integration request completed",
      projectSlug,
      requestId,
      entityType: "integration",
      entityId: `${integration}/${action}`,
      status: "completed",
      durationMs: completedDurationMs,
      metadata: {
        integration,
        action,
        range,
        timeZone,
        forceRefresh,
        cacheKey,
        stale: _stale,
      },
    });
    const ttl = resolvePollingTtlSeconds(
      dataSource.pollingSourceId,
      dataSource.cacheTtlSeconds,
      pollingPreferences
    );
    return NextResponse.json(
      { ...payload, _stale, _fetchedAt },
      {
        headers: {
          "Cache-Control": `public, max-age=${Math.min(ttl, 120)}, stale-while-revalidate=${ttl}`,
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const failedDurationMs = Date.now() - startedAt;
    recordHealth(`${integration}/${action}`, false, failedDurationMs, message);
    log.error(`Integration request failed: ${integration}/${action}`, { error });
    await emitDebugEvent({
      level: "error",
      source: "api/integrations",
      eventType: "integration.request.failed",
      message: "Integration request failed",
      projectSlug,
      requestId,
      entityType: "integration",
      entityId: `${integration}/${action}`,
      status: "failed",
      durationMs: failedDurationMs,
      metadata: {
        integration,
        action,
        range,
        timeZone,
        forceRefresh,
        cacheKey,
        error: message,
        circuitOpen: error instanceof CircuitOpenError,
      },
    });

    try {
      const staleEntry = await getCacheEntry(cacheKey);
      if (staleEntry?.data != null) {
        const payload = (
          typeof staleEntry.data === "object" && staleEntry.data !== null
            ? staleEntry.data
            : { data: staleEntry.data }
        ) as Record<string, unknown>;
        const retryAfter =
          error instanceof CircuitOpenError ? Math.ceil(error.retryAfterMs / 1000) : 30;
        return NextResponse.json(
          { ...payload, _stale: true, _fetchedAt: staleEntry.fetchedAt },
          {
            headers: {
              "X-Circuit-State": error instanceof CircuitOpenError ? "open" : "error",
              "Retry-After": String(retryAfter),
            },
          }
        );
      }
    } catch {
      // Stale lookup failed; fall through to error response.
    }

    if (error instanceof CircuitOpenError) {
      return errorJson(503, message, { configured: true, circuitOpen: true });
    }

    return errorJson(500, message, { configured: true });
  }
}

export const handleIntegrationData = withLogging(
  API_ROUTE_PATTERNS.integrationAction,
  async (request: Request, context?: unknown) => {
    const { integration, action } = await (
      context as { params: Promise<{ integration: string; action: string }> }
    ).params;

    if (integration === "analytics") {
      return handleAnalyticsAction(request, action);
    }

    if (integration === "github") {
      if (action === "repos") return handleGitHubRepos(request);
      if (action === "contents") return handleGitHubContents(request);
      if (action === "star-tracking") return handleGitHubStarTrackingGet();
    }

    return handleRegistryIntegrationAction(request, integration, action);
  }
);

export async function handleIntegrationActionPost(
  _request: Request,
  context: { params: Promise<{ integration: string; action: string }> }
) {
  const { integration, action } = await context.params;

  if (integration === "github" && action === "star-tracking") {
    return handleGitHubStarTrackingPost();
  }

  return errorJson(404, "Not found");
}
