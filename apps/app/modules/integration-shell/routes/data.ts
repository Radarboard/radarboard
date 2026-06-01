/**
 * Unified data-fetching route for all integrations.
 * GET /api/integrations/[integration]/[action]
 *
 * Dispatches to DataSourceDescriptor implementations from the registry and
 * absorbs the remaining app-shell analytics bridge actions so no
 * concrete provider folders are needed under apps/app/app/api/integrations.
 */

import "@/lib/integrations-init";

import { findDataSource } from "@radarboard/integration-sdk/registry";
import type { TimeRange } from "@radarboard/integration-sdk/types";
import { createLogger } from "@radarboard/logger/logger";
import { withLogging } from "@radarboard/logger/middleware";
import { API_ROUTE_PATTERNS } from "@radarboard/types/api-routes";
import { normalizeTimeZone } from "@radarboard/utils/timezone";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCacheEntry, getCacheKeysByRoute, withCache } from "@/db/cache";
import { getSettingsRepo } from "@/db/repository";
import { errorJson, parseSearchParams } from "@/lib/api";
import { maybeAutoEmbed } from "@/lib/auto-embed";
import { CircuitOpenError, withCircuitBreaker } from "@/lib/circuit-breaker";
import { buildDataSourceContext } from "@/lib/data-source-context";
import { emitDebugEvent } from "@/lib/debug-events";
import { recordHealth } from "@/lib/health-tracker";
import { emitNotificationEvents } from "@/lib/notifications";
import { getDashboardPollingPreferences, resolvePollingTtlSeconds } from "@/lib/polling-settings";

const log = createLogger("api/integrations");
const ANALYTICS_PROVIDERS = ["openpanel", "umami"] as const;
const VALID_RANGES = new Set(["today", "7d", "15d", "30d", "3m", "1y", "all"]);
const INTEGRATION_LABELS: Record<string, string> = {
  "app-store-connect": "App Store Connect",
  betterstack: "Better Stack",
  github: "GitHub",
  "github-sponsors": "GitHub Sponsors",
  "google-search-console": "Google Search Console",
  linear: "Linear",
  npm: "npm",
  "open-collective": "Open Collective",
  openpanel: "OpenPanel",
  raindrop: "Raindrop",
  resend: "Resend",
  revenuecat: "RevenueCat",
  sentry: "Sentry",
  slack: "Slack",
  stripe: "Stripe",
  umami: "Umami",
  vercel: "Vercel",
};
const DEMO_CACHE_KEY_PREFIXES: Record<string, string[]> = {
  "/api/integrations/app-store-connect/data": ["app-store:"],
  "/api/integrations/betterstack/data": ["betterstack:"],
  "/api/integrations/github-sponsors/data": ["github-sponsors:"],
  "/api/integrations/github/commits": ["github:commits:"],
  "/api/integrations/github/pulls": ["github:pulls:"],
  "/api/integrations/github/stars": ["github:stars:"],
  "/api/integrations/google-search-console/data": ["seo:"],
  "/api/integrations/linear/roadmap": ["roadmap:"],
  "/api/integrations/npm/downloads": ["npm:"],
  "/api/integrations/open-collective/data": ["open-collective:"],
  "/api/integrations/openpanel/data": ["analytics:"],
  "/api/integrations/raindrop/data": ["raindrop:"],
  "/api/integrations/revenuecat/data": ["revenue:"],
  "/api/integrations/sentry/data": ["sentry:"],
  "/api/integrations/shipping/data": ["shipping:"],
  "/api/integrations/umami/data": ["analytics:"],
  "/api/integrations/vercel/deployments": ["vercel:deployments:"],
  "/api/integrations/vercel/domains": ["vercel:domains:"],
  "/api/integrations/vercel/projects": ["vercel:projects:"],
};
const integrationCommonQuerySchema = z.object({
  project: z.string().optional(),
  range: z.string().optional(),
  timezone: z.string().optional(),
  refresh: z.string().optional(),
  demo: z.string().optional(),
});
const integrationDemoQuerySchema = z.object({
  demo: z.string().optional(),
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
type ParsedIntegrationDemoParams =
  | { ok: true; forceDemoCache: boolean }
  | { ok: false; response: Response };

function parseRange(raw: string | null): TimeRange {
  return VALID_RANGES.has(raw ?? "") ? (raw as TimeRange) : "30d";
}

function formatIntegrationLabel(integration: string): string {
  return (
    INTEGRATION_LABELS[integration] ??
    integration
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
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

function parseIntegrationDemoParams(searchParams: URLSearchParams): ParsedIntegrationDemoParams {
  const parsed = parseSearchParams(searchParams, integrationDemoQuerySchema);
  if (!parsed.ok) {
    return { ok: false, response: parsed.response };
  }

  return { ok: true, forceDemoCache: parsed.data.demo === "1" };
}

async function evictCaches(_integration: string, _prefixes: string[]): Promise<void> {
  // Provider cache eviction belongs to installed extension runtimes. Core must
  // not dynamically import provider packages that may live outside this repo.
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

export async function handleAnalyticsAction(request: Request, action: string) {
  const searchParams = new URL(request.url).searchParams;
  const parsedDemo = parseIntegrationDemoParams(searchParams);
  if (!parsedDemo.ok) return parsedDemo.response;

  for (const provider of ANALYTICS_PROVIDERS) {
    const demoResponse = await serveDemoCacheByRoute(
      `/api/integrations/${provider}/${action}`,
      parsedDemo.forceDemoCache
    );
    if (demoResponse) return demoResponse;
  }

  const resolved = resolveAnalyticsProvider(action);
  if (!resolved) {
    return NextResponse.json({
      configured: false,
      setupMessage: "Add an analytics integration to enable analytics.",
      ctaLabel: "Add integration",
      ctaTarget: "/settings?section=integrations",
    });
  }

  const { provider, dataSource } = resolved;
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

/** In demo mode, serve cached data for integrations that aren't registered. */
async function serveDemoCacheByRoute(
  routePath: string,
  forceDemoCache = false
): Promise<Response | null> {
  try {
    let demoCacheActive = forceDemoCache;
    if (!forceDemoCache) {
      const settings = getSettingsRepo();
      const wl = await settings.getWidgetLayout();
      if (!wl?.preferences?.demoMode) return null;
      demoCacheActive = true;
    }
    const cacheKeys = await getCacheKeysByRoute(routePath);
    if (cacheKeys.length === 0) return null;
    const cacheEntries = (
      await Promise.all(
        cacheKeys.map(async (key) => {
          const entry = await getCacheEntry(key);
          return entry ? { key, ...entry } : null;
        })
      )
    ).filter(
      (
        entry
      ): entry is {
        key: string;
        data: unknown;
        fetchedAt: number;
        ttlSeconds: number;
      } => entry != null
    );
    if (cacheEntries.length === 0) return null;

    const configuredEntries = cacheEntries.filter((entry) => {
      if (!entry.data || typeof entry.data !== "object") return true;
      return (entry.data as { configured?: unknown }).configured !== false;
    });
    const preferredPrefixes = demoCacheActive ? DEMO_CACHE_KEY_PREFIXES[routePath] : undefined;
    const preferredEntries = preferredPrefixes
      ? configuredEntries.filter((entry) =>
          preferredPrefixes.some((prefix) => entry.key.startsWith(prefix))
        )
      : [];
    const candidates =
      preferredEntries.length > 0
        ? preferredEntries
        : configuredEntries.length > 0
          ? configuredEntries
          : cacheEntries;
    const cached = candidates.toSorted((a, b) => b.fetchedAt - a.fetchedAt)[0];
    return cached ? NextResponse.json(cached.data) : null;
  } catch {
    return null;
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: integration dispatch keeps demo cache, registry lookup, health, and stale fallback behavior in one route.
async function handleRegistryIntegrationAction(
  request: Request,
  integration: string,
  action: string
) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const routePath = `/api/integrations/${integration}/${action}`;
  const searchParams = new URL(request.url).searchParams;
  const parsedDemo = parseIntegrationDemoParams(searchParams);
  if (!parsedDemo.ok) return parsedDemo.response;

  const demoResponse = await serveDemoCacheByRoute(routePath, parsedDemo.forceDemoCache);
  if (demoResponse) return demoResponse;

  const dataSource = findDataSource(integration, action);
  if (!dataSource) {
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
    const integrationLabel = formatIntegrationLabel(integration);
    return NextResponse.json({
      configured: false,
      setupMessage: `Add the ${integrationLabel} integration to enable this data source.`,
      ctaLabel: `Add ${integrationLabel} integration`,
      ctaTarget: "/settings?section=integrations",
    });
  }

  const parsedCommon = parseCommonIntegrationParams(searchParams);
  if (!parsedCommon.ok) return parsedCommon.response;
  const { projectSlug, range, timeZone, forceRefresh } = parsedCommon.data;

  const extraParams = dataSource.parseParams?.(searchParams) ?? {};
  const mergedParams = { ...extraParams, projectSlug, range, timeZone, forceRefresh };

  if (forceRefresh && dataSource.evictPrefixes) {
    await evictCaches(integration, dataSource.evictPrefixes);
  }

  const ctx = buildDataSourceContext();
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

    return handleRegistryIntegrationAction(request, integration, action);
  }
);

export async function handleIntegrationActionPost(
  _request: Request,
  context: { params: Promise<{ integration: string; action: string }> }
) {
  await context.params;

  return errorJson(404, "Not found");
}
