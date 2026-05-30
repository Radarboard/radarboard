import type { Platform, Project } from "@radarboard/types/project";
import { PROJECTS } from "@/config/projects";

export type ProjectIntegrationsMap = Record<string, Record<string, Record<string, unknown>>>;

const USER_PROJECTS_KEY = "@@projects";
const USER_PROJECT_META_PREFIX = "@@proj_";
const USER_PLATFORM_IDS_KEY = "@@platforms";
const USER_PLATFORM_META_PREFIX = "@@plat_";

function trimString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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
  const baseOverride = trimString(projectIntegrations[projectSlug]?._project?.name);
  if (baseOverride) return baseOverride;

  const customOverride = trimString(
    projectIntegrations[`${USER_PROJECT_META_PREFIX}${projectSlug}`]?._?.name
  );
  if (customOverride) return customOverride;

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
      trimString(
        projectIntegrations[projectSlug]?.[`${USER_PLATFORM_META_PREFIX}${platformId}`]?.name
      ) ?? platformId,
    type:
      (projectIntegrations[projectSlug]?.[`${USER_PLATFORM_META_PREFIX}${platformId}`]?.type as
        | Platform["type"]
        | undefined) ?? "website",
    integrations: {},
  };
}

export function deriveAllProjects(projectIntegrations: ProjectIntegrationsMap): Project[] {
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
        trimString(projectIntegrations[`${USER_PROJECT_META_PREFIX}${projectSlug}`]?._?.color) ??
        "#666666",
      description:
        trimString(
          projectIntegrations[`${USER_PROJECT_META_PREFIX}${projectSlug}`]?._?.description
        ) ?? "",
      platforms: getUserPlatformIds(projectIntegrations, projectSlug).map((platformId) =>
        buildUserPlatform(projectIntegrations, projectSlug, platformId)
      ),
    }));

  return [...baseProjects, ...customProjects];
}
