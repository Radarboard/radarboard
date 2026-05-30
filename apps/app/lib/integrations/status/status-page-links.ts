import { INTEGRATION_REGISTRY } from "@radarboard/integration-sdk/registry";
import type { Platform, Project } from "@radarboard/types/project";
import type { StatusSource } from "@radarboard/types/status-page";
import { normalizeStatusSource } from "@radarboard/types/status-page";
import { PROJECTS } from "@/config/projects";
import type { ProjectIntegrationsMap } from "@/hooks/projects/use-project-integrations";
import {
  type IntegrationStatusPageOverrides,
  resolveIntegrationStatusPageUrl,
} from "./integration-status-pages";

const SYSTEM_KEY = "@@system";
const RELAY_PLATFORM = "relay";
const RELAY_SOURCE_ID = "integration:webhook-relay";

const USER_PROJECTS_KEY = "@@projects";
const USER_PROJECT_META_PREFIX = "@@proj_";
const USER_PLATFORM_IDS_KEY = "@@platforms";
const USER_PLATFORM_META_PREFIX = "@@plat_";

const INTEGRATION_LABELS: Record<string, string> = {
  appStoreConnect: "App Store Connect",
  astro: "Astro",
  betterstack: "Betterstack",
  github: "GitHub",
  googleSearchConsole: "Google Search Console",
  healthCheck: "Health Check",
  linear: "Linear",
  npm: "npm",
  openCollective: "Open Collective",
  openPanel: "OpenPanel",
  revenuecat: "RevenueCat",
  sentry: "Sentry",
  vercel: "Vercel",
};

interface IntegrationTarget {
  projectSlug: string;
  projectName: string;
  platformId: string;
  platformName: string;
}

function now(): string {
  return new Date().toISOString();
}

function humanizeIntegrationKey(integrationKey: string): string {
  const label = INTEGRATION_LABELS[integrationKey];
  if (label) return label;

  return integrationKey
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getUserProjectSlugs(projectIntegrations: ProjectIntegrationsMap): string[] {
  const ids = projectIntegrations[USER_PROJECTS_KEY]?._?.ids;
  return Array.isArray(ids)
    ? ids.filter((value): value is string => typeof value === "string")
    : [];
}

function getProjectDisplayName(
  projectIntegrations: ProjectIntegrationsMap,
  projectSlug: string,
  fallback: string
): string {
  const baseOverride = projectIntegrations[projectSlug]?._project?.name;
  if (typeof baseOverride === "string" && baseOverride.trim()) return baseOverride.trim();

  const customOverride = projectIntegrations[`${USER_PROJECT_META_PREFIX}${projectSlug}`]?._?.name;
  if (typeof customOverride === "string" && customOverride.trim()) return customOverride.trim();

  return fallback;
}

function getUserPlatformIds(
  projectIntegrations: ProjectIntegrationsMap,
  projectSlug: string
): string[] {
  const ids = projectIntegrations[projectSlug]?.[USER_PLATFORM_IDS_KEY]?.ids;
  return Array.isArray(ids)
    ? ids.filter((value): value is string => typeof value === "string")
    : [];
}

function buildUserPlatform(
  projectIntegrations: ProjectIntegrationsMap,
  projectSlug: string,
  platformId: string
): Platform {
  return {
    id: platformId,
    name:
      (projectIntegrations[projectSlug]?.[`${USER_PLATFORM_META_PREFIX}${platformId}`]?.name as
        | string
        | undefined) ?? platformId,
    type:
      (projectIntegrations[projectSlug]?.[`${USER_PLATFORM_META_PREFIX}${platformId}`]?.type as
        | Platform["type"]
        | undefined) ?? "website",
    integrations: {},
  };
}

function getAllProjects(projectIntegrations: ProjectIntegrationsMap): Project[] {
  const baseProjects = PROJECTS.map((project) => ({
    ...project,
    name: getProjectDisplayName(projectIntegrations, project.slug, project.name),
    platforms: [
      ...project.platforms,
      ...getUserPlatformIds(projectIntegrations, project.slug).map((platformId) =>
        buildUserPlatform(projectIntegrations, project.slug, platformId)
      ),
    ],
  }));

  const baseProjectSlugs = new Set(baseProjects.map((project) => project.slug));
  const customProjects = getUserProjectSlugs(projectIntegrations)
    .filter((projectSlug) => !baseProjectSlugs.has(projectSlug))
    .map((projectSlug) => ({
      id: projectSlug,
      slug: projectSlug,
      name: getProjectDisplayName(projectIntegrations, projectSlug, projectSlug),
      color:
        (projectIntegrations[`${USER_PROJECT_META_PREFIX}${projectSlug}`]?._?.color as
          | string
          | undefined) ?? "#666666",
      description:
        (projectIntegrations[`${USER_PROJECT_META_PREFIX}${projectSlug}`]?._?.description as
          | string
          | undefined) ?? "",
      platforms: getUserPlatformIds(projectIntegrations, projectSlug).map((platformId) =>
        buildUserPlatform(projectIntegrations, projectSlug, platformId)
      ),
    }));

  return [...baseProjects, ...customProjects];
}

function getStatusPageUrl(
  globalOverrides: IntegrationStatusPageOverrides,
  integrationKey: string
): string | null {
  return resolveIntegrationStatusPageUrl(
    integrationKey,
    globalOverrides,
    INTEGRATION_REGISTRY.get(integrationKey)?.defaultStatusPageUrl
  );
}

function getPlatformIntegrationKeys(
  platform: Platform,
  platformConfig: Record<string, unknown> | undefined
): string[] {
  const integrationKeys = new Set(Object.keys(platform.integrations));

  if (platformConfig) {
    for (const integrationKey of INTEGRATION_REGISTRY.keys()) {
      if (
        integrationKey in platformConfig ||
        Object.keys(platformConfig).some(
          (key) => key.startsWith(`${integrationKey}.`) || key.startsWith(`${integrationKey}._`)
        )
      ) {
        integrationKeys.add(integrationKey);
      }
    }
  }

  return Array.from(integrationKeys);
}

function createLinkedSource(
  integrationKey: string,
  statusPageUrl: string,
  targets: IntegrationTarget[],
  cachedSource?: StatusSource
): StatusSource {
  const timestamp = cachedSource?.addedAt ?? now();
  const linkedTargetSummary = targets
    .slice(0, 2)
    .map((target) => `${target.projectName} · ${target.platformName}`)
    .join(" · ");
  const linkedTargetCount = targets.length;
  const summary =
    linkedTargetCount > 2
      ? `${linkedTargetSummary} · +${linkedTargetCount - 2} more`
      : linkedTargetSummary;

  return normalizeStatusSource({
    id: `integration:${integrationKey}`,
    kind: "integration",
    name: humanizeIntegrationKey(integrationKey),
    url: statusPageUrl,
    statusPageUrl,
    status: cachedSource?.status ?? "unknown",
    lastCheckedAt: cachedSource?.lastCheckedAt ?? timestamp,
    addedAt: timestamp,
    alertsEnabled: undefined,
    remoteUpdatedAt: cachedSource?.remoteUpdatedAt ?? null,
    projectSlug: null,
    projectName: null,
    platformId: null,
    platformName: null,
    integrationKey,
    linkedTargetCount,
    linkedTargetSummary: summary || null,
  });
}

function appendIntegrationTargetsForPlatform(
  targetsByIntegration: Map<string, IntegrationTarget[]>,
  projectIntegrations: ProjectIntegrationsMap,
  globalOverrides: IntegrationStatusPageOverrides,
  project: Project,
  platform: Platform
) {
  const platformConfig = projectIntegrations[project.slug]?.[platform.id];
  for (const integrationKey of getPlatformIntegrationKeys(platform, platformConfig)) {
    if (!getStatusPageUrl(globalOverrides, integrationKey)) continue;

    const targets = targetsByIntegration.get(integrationKey) ?? [];
    targets.push({
      projectSlug: project.slug,
      projectName: project.name,
      platformId: platform.id,
      platformName: platform.name,
    });
    targetsByIntegration.set(integrationKey, targets);
  }
}

export function deriveLinkedStatusSources(
  projectIntegrations: ProjectIntegrationsMap,
  globalOverrides: IntegrationStatusPageOverrides = {},
  cachedSources: StatusSource[] = []
): StatusSource[] {
  const cachedById = new Map(
    cachedSources.map((source) => [source.id, normalizeStatusSource(source)])
  );
  const targetsByIntegration = new Map<string, IntegrationTarget[]>();

  for (const project of getAllProjects(projectIntegrations)) {
    for (const platform of project.platforms) {
      appendIntegrationTargetsForPlatform(
        targetsByIntegration,
        projectIntegrations,
        globalOverrides,
        project,
        platform
      );
    }
  }

  const sources = Array.from(targetsByIntegration.entries()).map(([integrationKey, targets]) =>
    createLinkedSource(
      integrationKey,
      getStatusPageUrl(globalOverrides, integrationKey) ?? "",
      targets,
      cachedById.get(`integration:${integrationKey}`)
    )
  );

  // Auto-add webhook relay health source when relay URL is configured
  const relayUrl = projectIntegrations[SYSTEM_KEY]?.[RELAY_PLATFORM]?.url;
  if (typeof relayUrl === "string" && relayUrl.startsWith("http")) {
    const cached = cachedById.get(RELAY_SOURCE_ID);
    sources.push(
      normalizeStatusSource({
        id: RELAY_SOURCE_ID,
        kind: "integration",
        name: "Webhook Relay",
        url: `${relayUrl.replace(/\/+$/, "")}/api/health`,
        status: cached?.status ?? "unknown",
        lastCheckedAt: cached?.lastCheckedAt ?? new Date().toISOString(),
        addedAt: cached?.addedAt ?? new Date().toISOString(),
        integrationKey: "webhook-relay",
      })
    );
  }

  return sources.sort((left, right) => left.name.localeCompare(right.name));
}
