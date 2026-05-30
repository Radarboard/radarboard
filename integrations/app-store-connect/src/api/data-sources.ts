import type {
  CommonRouteParams,
  DataSourceContext,
  DataSourceDescriptor,
} from "@radarboard/integration-sdk/types";
import { isSameDayInTimeZone } from "@radarboard/utils/timezone";
import type { ASCConfig } from "../types";
import {
  getAppInfo,
  getAppVersions,
  getCustomerReviewSummarizations,
  getCustomerReviews,
} from "./client";

type DbOverrides = Record<string, Record<string, Record<string, unknown>>>;

function resolveOverrideString(
  overrides: DbOverrides,
  projectSlug: string,
  platformId: string,
  key: string
): string | null {
  const val = overrides[projectSlug]?.[platformId]?.[key];
  return typeof val === "string" && val ? val : null;
}

function normalizeAppId(appId: string | null): string | null {
  if (!appId) return null;
  const trimmed = appId.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^id/i, "");
}

function resolveAppId(
  projects: Array<{
    slug: string;
    platforms: Array<{ id: string; integrations: Record<string, unknown> }>;
  }>,
  dbOverrides: DbOverrides,
  projectSlug: string | null
): string | null {
  if (projectSlug) {
    const project = projects.find((p) => p.slug === projectSlug);
    const ascPlatform = project?.platforms.find(
      (p) =>
        (p.integrations.appStoreConnect as { appId?: string } | undefined) ||
        dbOverrides[projectSlug]?.[p.id]?.["appStoreConnect.appId"]
    );
    if (!ascPlatform) return null;
    return normalizeAppId(
      resolveOverrideString(dbOverrides, projectSlug, ascPlatform.id, "appStoreConnect.appId") ??
        (ascPlatform.integrations.appStoreConnect as { appId?: string } | undefined)?.appId ??
        null
    );
  }
  for (const project of projects) {
    for (const platform of project.platforms) {
      const id = normalizeAppId(
        resolveOverrideString(dbOverrides, project.slug, platform.id, "appStoreConnect.appId") ??
          (platform.integrations.appStoreConnect as { appId?: string } | undefined)?.appId ??
          null
      );
      if (id) return id;
    }
  }
  return null;
}

async function resolveConfig(ctx: DataSourceContext): Promise<ASCConfig | null> {
  const creds = await ctx.resolveCredential("app-store-connect");
  if (creds?.keyId && creds?.issuerId && creds?.privateKey) {
    return {
      keyId: creds.keyId,
      issuerId: creds.issuerId,
      privateKey: creds.privateKey.replace(/\\n/g, "\n"),
    };
  }
  return null;
}

function isOnOrAfter(dateStr: string, cutoffStr: string): boolean {
  return new Date(dateStr).getTime() >= new Date(cutoffStr).getTime();
}

function averageRatingFor(
  reviews: Array<{
    rating: number;
  }>
): number {
  if (reviews.length === 0) return 0;
  return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
}

interface Review {
  id: string;
  rating: number;
  title: string;
  body: string;
  reviewer: string;
  createdAt: string;
  territory: string;
}

function buildMissingAppStoreProjectSetupState() {
  return {
    configured: false as const,
    ctaLabel: "Open Project Settings",
    ctaTarget: "intent:app-store-connect-project",
    projectMappingRequired: true,
    setupMessage:
      "App Store Connect is connected, but no app is linked yet. Add an App ID in Project Settings.",
  };
}

function processReviews(
  allReviews: Review[],
  range: string,
  timeZone: string,
  latestVersionCreatedAt: string | null
) {
  const recentReviews =
    range === "today"
      ? allReviews.filter((review) => isSameDayInTimeZone(review.createdAt, timeZone))
      : allReviews;

  const reviewsSinceLatestVersion = latestVersionCreatedAt
    ? recentReviews.filter((review) => isOnOrAfter(review.createdAt, latestVersionCreatedAt))
    : recentReviews;

  const recentNegativeReviews = recentReviews.filter((review) => review.rating <= 2).length;
  const recentPositiveReviews = recentReviews.filter((review) => review.rating >= 4).length;
  const negativeReviewsSinceLatestVersion = reviewsSinceLatestVersion.filter(
    (review) => review.rating <= 2
  ).length;

  const postReleaseAverageRating = averageRatingFor(reviewsSinceLatestVersion);
  const avgRating = averageRatingFor(recentReviews);

  const getReleaseRisk = (): "low" | "elevated" | "high" => {
    if (
      negativeReviewsSinceLatestVersion >= 2 ||
      (reviewsSinceLatestVersion.length >= 2 &&
        postReleaseAverageRating > 0 &&
        postReleaseAverageRating < 3.5)
    )
      return "high";
    if (
      negativeReviewsSinceLatestVersion >= 1 ||
      recentNegativeReviews >= 2 ||
      (avgRating > 0 && avgRating < 4)
    )
      return "elevated";
    return "low";
  };
  const releaseRisk = getReleaseRisk();

  return {
    recentReviews,
    avgRating,
    recentNegativeReviews,
    recentPositiveReviews,
    releaseRisk,
  };
}

export const appStoreConnectDataSource: DataSourceDescriptor = {
  action: "data",
  description: "Fetches app info, reviews, and version data from App Store Connect.",
  cacheTtlSeconds: 900,
  pollingSourceId: "app-store",
  buildCacheKey: (params) =>
    `app-store:${params.projectSlug ?? "all"}:${params.range}:${params.timeZone}`,
  async fetch(params: CommonRouteParams, ctx: DataSourceContext) {
    const { projectSlug, range, timeZone } = params;

    const [allProjects, dbOverrides] = await Promise.all([
      ctx.getAllProjects(),
      ctx.getProjectIntegrations().catch(() => ({}) as DbOverrides),
    ]);

    const config = await resolveConfig(ctx);
    if (!config) return { configured: false as const };

    const appId = resolveAppId(allProjects, dbOverrides, projectSlug);
    if (!appId) return buildMissingAppStoreProjectSetupState();

    const [appInfo, reviews, versions] = await Promise.all([
      getAppInfo(config, appId),
      getCustomerReviews(config, appId, { limit: 20 }),
      getAppVersions(config, appId, { limit: 5 }),
    ]);

    const latestVersion = versions[0] ?? null;
    const latestVersionCreatedAt = latestVersion?.attributes.createdDate ?? null;

    const reviewSummaries =
      latestVersion?.attributes.platform &&
      ["IOS", "MAC_OS", "TV_OS", "VISION_OS"].includes(latestVersion.attributes.platform)
        ? await getCustomerReviewSummarizations(config, appId, {
            platform: latestVersion.attributes.platform as "IOS" | "MAC_OS" | "TV_OS" | "VISION_OS",
            limit: 1,
          })
        : [];

    const mappedReviews: Review[] = reviews.map((review) => ({
      id: review.id,
      rating: review.attributes.rating,
      title: review.attributes.title ?? "",
      body: review.attributes.body ?? "",
      reviewer: review.attributes.reviewerNickname,
      createdAt: review.attributes.createdDate,
      territory: review.attributes.territory,
    }));

    const { recentReviews, avgRating, recentNegativeReviews, recentPositiveReviews, releaseRisk } =
      processReviews(mappedReviews, range, timeZone, latestVersionCreatedAt);

    const latestReviewSummary = reviewSummaries[0] ?? null;

    return {
      configured: true as const,
      appStore: {
        appName: appInfo.attributes.name,
        bundleId: appInfo.attributes.bundleId,
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews: recentReviews.length,
        recentReviews: recentReviews.slice(0, 10),
        reviewSummary: latestReviewSummary
          ? {
              text: latestReviewSummary.attributes.text,
              territory: latestReviewSummary.attributes.territory,
              platform: latestReviewSummary.attributes.platform,
              createdAt: latestReviewSummary.attributes.createdDate,
            }
          : null,
        latestVersion: latestVersion?.attributes.versionString ?? null,
        latestVersionState: latestVersion?.attributes.appStoreState ?? null,
        latestVersionCreatedAt,
        recentNegativeReviews,
        recentPositiveReviews,
        releaseRisk,
      },
    };
  },
};

export const appStoreConnectDataSources: DataSourceDescriptor[] = [appStoreConnectDataSource];
