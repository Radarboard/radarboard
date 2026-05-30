import type { StatusSource } from "@radarboard/types/status-page";
import { normalizeStatusSource } from "@radarboard/types/status-page";
import { PROJECTS } from "@/config/projects";
import type { ProjectIntegrationsMap } from "@/hooks/projects/use-project-integrations";

function getProjectDisplayName(
  projectIntegrations: ProjectIntegrationsMap,
  projectSlug: string,
  fallback: string
): string {
  const override = projectIntegrations[projectSlug]?._project?.name;
  return typeof override === "string" && override.trim() ? override.trim() : fallback;
}

function now(): string {
  return new Date().toISOString();
}

export function deriveProjectHealthSources(
  projectIntegrations: ProjectIntegrationsMap,
  cachedSources: StatusSource[] = []
): StatusSource[] {
  const cachedById = new Map(
    cachedSources
      .map((source) => normalizeStatusSource(source))
      .filter((source) => source.kind === "project")
      .map((source) => [source.id, source])
  );

  return PROJECTS.flatMap((project) =>
    project.platforms.flatMap((platform) => {
      const healthCheck = platform.integrations.healthCheck;
      if (!healthCheck?.url) return [];

      const sourceId = `project:${project.slug}:${platform.id}`;
      const cachedSource = cachedById.get(sourceId);
      const timestamp = cachedSource?.addedAt ?? now();

      return [
        normalizeStatusSource({
          id: sourceId,
          kind: "project",
          name: platform.name,
          url: healthCheck.url as string,
          statusPageUrl: healthCheck.url as string,
          status: cachedSource?.status ?? "unknown",
          lastCheckedAt: cachedSource?.lastCheckedAt ?? timestamp,
          addedAt: timestamp,
          remoteUpdatedAt: cachedSource?.remoteUpdatedAt ?? null,
          projectSlug: project.slug,
          projectName: getProjectDisplayName(projectIntegrations, project.slug, project.name),
          platformId: platform.id,
          platformName: platform.name,
          integrationKey: "healthCheck",
        }),
      ];
    })
  );
}
